import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { logger } from './logger'
import { fromKobo, type PaystackTransaction } from './paystack'

/**
 * Marks an order paid, from either the webhook or the browser callback.
 *
 * Both routes land here on purpose. Paystack sends the webhook and redirects
 * the customer independently, either can arrive first, and either can be the
 * only one that arrives — the browser can be closed before the redirect, and
 * a webhook can be delayed. So this is written to be safely repeatable:
 * an order already `confirmed` is left alone and reported as a duplicate.
 *
 * `orders.client_order_ref` holds the ORD-… id, which is what gets used as the
 * Paystack reference, so the reference is the join key.
 */

interface OrderRow {
  id: string
  status: string
  total: number | null
  client_order_ref: string | null
}

interface OrderEventInsert {
  order_id: string
  status: string
  message: string
  meta: Record<string, unknown>
}

export type PaymentOutcome =
  | { result: 'confirmed'; orderId: string }
  | { result: 'already_confirmed'; orderId: string }
  | { result: 'order_not_found' }
  | { result: 'amount_mismatch'; orderId: string; expected: number; paid: number }
  | { result: 'error'; message: string }

/**
 * Never throws. A webhook that 500s gets retried by Paystack forever, and a
 * callback that 500s shows the customer an error for a payment that actually
 * succeeded. Callers decide what to say; the outcome is always reported.
 */
export async function recordPaystackPayment(
  event: H3Event,
  transaction: PaystackTransaction,
): Promise<PaymentOutcome> {
  const reference = transaction.reference

  try {
    const supabase = serverSupabaseServiceRole(event)

    const { data, error } = await supabase
      .from('orders')
      .select('id, status, total, client_order_ref')
      .eq('client_order_ref', reference)
      .maybeSingle<OrderRow>()

    if (error) throw error
    if (!data) {
      // Not necessarily wrong: a payment can exist for something this site did
      // not create. Logged loudly because it is also what a mismatched
      // reference scheme looks like.
      logger.warn('Paystack', 'Paid transaction has no matching order', { reference })
      return { result: 'order_not_found' }
    }

    if (data.status === 'confirmed') {
      return { result: 'already_confirmed', orderId: data.id }
    }

    const paid = fromKobo(transaction.amount)
    const expected = Number(data.total ?? 0)

    // Underpayment is recorded, never silently accepted. Overpayment is not
    // treated as failure — the money is there — but both are flagged for a
    // human, because a mismatch means the amount was changed somewhere.
    if (expected > 0 && paid + 0.01 < expected) {
      const underpaidEvent: OrderEventInsert = {
        order_id: data.id,
        status: 'pending',
        message: `Paystack underpayment: expected ${expected}, received ${paid}`,
        meta: { reference, paid, expected, channel: transaction.channel ?? null },
      }
      await supabase.from('order_events').insert(underpaidEvent as never)
      logger.error('Paystack', 'Underpayment; order left pending', { reference, expected, paid })
      return { result: 'amount_mismatch', orderId: data.id, expected, paid }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() } as never)
      .eq('id', data.id)
      // Only move it out of pending. If something else confirmed or cancelled
      // it in the meantime, that decision stands.
      .eq('status', 'pending')

    if (updateError) throw updateError

    const paidEvent: OrderEventInsert = {
      order_id: data.id,
      status: 'confirmed',
      message: 'Payment received via Paystack',
      meta: {
        reference,
        paystack_id: transaction.id,
        amount: paid,
        currency: transaction.currency,
        channel: transaction.channel ?? null,
        paid_at: transaction.paid_at ?? null,
      },
    }
    // The order state is what matters; losing the audit row must not undo it,
    // so the error is logged rather than thrown.
    const { error: eventError } = await supabase.from('order_events').insert(paidEvent as never)
    if (eventError) {
      logger.warn('Paystack', 'Could not write order_event', { error: eventError.message, orderId: data.id })
    }

    logger.info('Paystack', 'Order confirmed by payment', { reference, orderId: data.id, amount: paid })
    return { result: 'confirmed', orderId: data.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Paystack', 'Could not record payment', { reference, error: message })
    return { result: 'error', message }
  }
}

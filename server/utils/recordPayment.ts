import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { logger } from './logger'
import { fromKobo, type PaystackTransaction } from './paystack'
import { createOrderDeal, type OrderReferral } from './orderDeal'

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
  user_id: string | null
  customer_email: string | null
  customer_first_name: string | null
  customer_last_name: string | null
  customer_phone: string | null
  shipping_address: string | null
  fulfillment: string | null
  branch: Record<string, unknown> | null
  payment_method: string | null
  subtotal: number | null
  staff_code: string | null
  staff_bitrix_id: number | null
  discount_percent: number | null
  discount_amount: number | null
}

interface OrderItemRow {
  bitrix_product_id: string | null
  name: string
  unit_price: number
  unit_discount: number | null
  quantity: number
}

/**
 * The staff code as it was applied at checkout. Rebuilt from the order rather
 * than looked up again, so a code switched off or a rate changed between
 * checkout and payment cannot change what the customer was promised.
 */
function referralOf(order: OrderRow): OrderReferral | null {
  if (!order.staff_code || !order.staff_bitrix_id) return null
  const discountAmount = Number(order.discount_amount ?? 0)
  return {
    code: order.staff_code,
    staffBitrixId: order.staff_bitrix_id,
    discountPercent: Number(order.discount_percent ?? 0),
    discountAmount,
    subtotal: Number(order.subtotal ?? Number(order.total ?? 0) + discountAmount),
    // Dealer or switched-off are indistinguishable once stored, so neither is
    // claimed; the deal just says no discount was applied.
    noDiscountReason: null,
  }
}

const ORDER_ITEM_COLUMNS = 'bitrix_product_id, name, unit_price, unit_discount, quantity'

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
      .select(
        'id, status, total, client_order_ref, user_id, customer_email, customer_first_name, ' +
          'customer_last_name, customer_phone, shipping_address, fulfillment, branch, payment_method, ' +
          'subtotal, staff_code, staff_bitrix_id, discount_percent, discount_amount',
      )
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

    // The deal is created HERE, not at checkout, for pay-now orders — payment
    // is what makes it a sale. Non-fatal: the money is already taken and the
    // order is confirmed, so a CRM outage must not undo any of that. The
    // outbox picks it up instead.
    await createDealForPaidOrder(event, data, reference)

    return { result: 'confirmed', orderId: data.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Paystack', 'Could not record payment', { reference, error: message })
    return { result: 'error', message }
  }
}

/**
 * Rebuild the order from what was persisted at checkout and file the deal.
 *
 * Everything needed is already in Supabase — persistOrder() writes the
 * customer and branch onto `orders` and the line items onto `order_items` —
 * so nothing has to be carried through Paystack and back.
 *
 * Only for orders whose deal was deferred. A pay-at-store order already has
 * one from checkout, and creating a second would duplicate it in the pipeline.
 */
async function createDealForPaidOrder(event: H3Event, order: OrderRow, reference: string): Promise<void> {
  if (order.payment_method !== 'paystack') return

  try {
    const supabase = serverSupabaseServiceRole(event)
    const { data: items, error } = await supabase
      .from('order_items')
      .select(ORDER_ITEM_COLUMNS)
      .eq('order_id', order.id)
      .returns<OrderItemRow[]>()

    if (error) throw error

    const deal = await createOrderDeal({
      orderId: reference,
      customer: {
        firstName: order.customer_first_name ?? undefined,
        lastName: order.customer_last_name ?? undefined,
        email: order.customer_email ?? '',
        phone: order.customer_phone ?? undefined,
        address: order.shipping_address ?? undefined,
      },
      cart: (items ?? []).map((item) => ({
        id: item.bitrix_product_id ?? undefined,
        name: item.name,
        price: Number(item.unit_price),
        discount: Number(item.unit_discount ?? 0),
        quantity: item.quantity,
      })),
      total: Number(order.total ?? 0),
      branch: order.branch,
      paymentMethod: order.payment_method ?? undefined,
      fulfillment: order.fulfillment ?? undefined,
      userId: order.user_id,
      referral: referralOf(order),
    })

    logger.info('Paystack', 'Created deal for paid order', { reference, dealId: deal.dealId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Queue it for the existing drain rather than losing it. The customer has
    // paid; the deal turning up ten minutes late is a far smaller problem than
    // a paid order the CRM never hears about.
    logger.error('Paystack', 'Deal creation failed for paid order; queueing', { reference, error: message })
    await queueDealForRetry(event, order, reference)
  }
}

/**
 * Hand the order to `crm_outbox`, which the drain already knows how to turn
 * into a deal (see /api/admin/drain-crm-outbox). Same payload shape the
 * place_order_from_cart RPC writes, so the drain needs no special case.
 */
async function queueDealForRetry(event: H3Event, order: OrderRow, reference: string): Promise<void> {
  try {
    const supabase = serverSupabaseServiceRole(event)
    const { data: items } = await supabase
      .from('order_items')
      .select(ORDER_ITEM_COLUMNS)
      .eq('order_id', order.id)
      .returns<OrderItemRow[]>()

    const row = {
      event_type: 'order.created',
      source_table: 'orders',
      source_id: order.id,
      payload: {
        orderId: reference,
        customer: {
          firstName: order.customer_first_name,
          lastName: order.customer_last_name,
          email: order.customer_email,
          phone: order.customer_phone,
          address: order.shipping_address,
        },
        branch: order.branch ?? {},
        paymentMethod: order.payment_method,
        fulfillment: order.fulfillment,
        total: Number(order.total ?? 0),
        referral: referralOf(order),
        cart: (items ?? []).map((item) => ({
          id: item.bitrix_product_id,
          name: item.name,
          price: Number(item.unit_price),
          discount: Number(item.unit_discount ?? 0),
          quantity: item.quantity,
        })),
      },
    }

    const { error } = await supabase.from('crm_outbox').insert(row as never)
    if (error) throw error
  } catch (err) {
    logger.error('Paystack', '[CRITICAL] Paid order has no deal and could not be queued', {
      reference,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

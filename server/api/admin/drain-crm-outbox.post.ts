import { serverSupabaseServiceRole } from '#supabase/server'
import { logger } from '../../utils/logger'
import { createOrderDeal } from '../../utils/orderDeal'
import { STOCK_REQUEST_EVENT, deliverStockRequest, type StockRequestPayload } from '../../utils/stockRequest'

/**
 * Deliver queued orders to Bitrix.
 *
 * Orders placed through `place_order_from_cart()` cannot reach the CRM at the
 * moment they are created — a Postgres function has no outbound HTTP — so the
 * function writes a `crm_outbox` row instead and this drains it. Without this
 * running, an order placed from the mobile app exists in Supabase and nowhere
 * else, which is the exact failure the endpoint-based flow avoids.
 *
 * It also retries stock requests (`stock.requested`) whose first delivery
 * from /api/stock-request failed — see server/utils/stockRequest.ts.
 *
 * Guarded by `adminGuard`, so it takes either an admin session or
 * `Authorization: Bearer $CRON_SECRET`.
 */

const BATCH_SIZE = 25
const MAX_ATTEMPTS = 5

type OutboxRow = {
  id: string
  event_type: string
  source_id: string | null
  payload: {
    orderId?: string
    customer?: { firstName?: string; lastName?: string; email?: string; phone?: string; address?: string }
    // Whatever the client sent. A bitrixId here puts the deal on that branch.
    branch?: Record<string, unknown> | null
    paymentMethod?: string
    fulfillment?: string
    total?: number
    cart?: Array<{ id?: string; name?: string; price?: number; quantity?: number }>
  }
  attempts: number
}

type OutboxUpdate = {
  status?: string
  attempts?: number
  last_error?: string | null
  next_retry_at?: string | null
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const nowIso = new Date().toISOString()

  const { data, error } = (await supabase
    .from('crm_outbox')
    .select('id, event_type, source_id, payload, attempts')
    .eq('status', 'pending')
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)) as { data: OutboxRow[] | null; error: { message: string } | null }

  if (error) {
    logger.error('CrmOutbox', 'Failed to read the queue', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not read the CRM outbox.' })
  }

  const rows = data || []
  let sent = 0
  let failed = 0

  for (const row of rows) {
    try {
      if (row.event_type === STOCK_REQUEST_EVENT) {
        // The payload was built and verified by /api/stock-request; deliver it
        // exactly as that endpoint would have.
        const { leadId } = await deliverStockRequest(row.payload as unknown as StockRequestPayload)
        const update: OutboxUpdate = { status: 'sent', last_error: null, updated_at: new Date().toISOString() }
        await supabase.from('crm_outbox').update(update as never).eq('id', row.id)
        sent++
        logger.info('CrmOutbox', 'Delivered stock request to Bitrix', { outboxId: row.id, leadId })
        continue
      }

      if (row.event_type !== 'order.created') {
        // Not something this drain knows how to deliver. Park it rather than
        // retrying forever.
        const update: OutboxUpdate = {
          status: 'failed',
          last_error: `Unsupported event_type: ${row.event_type}`,
          updated_at: new Date().toISOString(),
        }
        await supabase.from('crm_outbox').update(update as never).eq('id', row.id)
        failed++
        continue
      }

      // A sale is a Deal, not a Lead. See server/utils/orderDeal.ts.
      const deal = await createOrderDeal({
        orderId: row.payload.orderId || `outbox-${row.id}`,
        customer: {
          firstName: row.payload.customer?.firstName,
          lastName: row.payload.customer?.lastName,
          email: row.payload.customer?.email || '',
          phone: row.payload.customer?.phone,
          address: row.payload.customer?.address,
        },
        cart: (row.payload.cart ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity ?? 1,
        })),
        total: row.payload.total ?? 0,
        branch: row.payload.branch,
        paymentMethod: row.payload.paymentMethod,
        fulfillment: row.payload.fulfillment,
      })

      const update: OutboxUpdate = { status: 'sent', last_error: null, updated_at: new Date().toISOString() }
      await supabase.from('crm_outbox').update(update as never).eq('id', row.id)

      if (row.source_id) {
        const orderUpdate = { status: 'confirmed', updated_at: new Date().toISOString() }
        await supabase.from('orders').update(orderUpdate as never).eq('id', row.source_id)
      }

      sent++
      logger.info('CrmOutbox', 'Delivered order to Bitrix', {
        outboxId: row.id,
        orderId: row.payload.orderId,
        dealId: deal.dealId,
      })
    } catch (err) {
      const attempts = (row.attempts || 0) + 1
      const message = err instanceof Error ? err.message : String(err)

      // Exponential backoff, capped. Past MAX_ATTEMPTS the row is parked for a
      // human rather than retried forever.
      const backoffMinutes = Math.min(2 ** attempts, 60)
      const update: OutboxUpdate = {
        attempts,
        last_error: message.slice(0, 500),
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        next_retry_at:
          attempts >= MAX_ATTEMPTS ? null : new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      }
      await supabase.from('crm_outbox').update(update as never).eq('id', row.id)

      failed++
      logger.error('CrmOutbox', 'Delivery failed', {
        outboxId: row.id,
        orderId: row.payload.orderId,
        attempts,
        parked: attempts >= MAX_ATTEMPTS,
        error: message,
      })
    }
  }

  return { success: true, claimed: rows.length, sent, failed }
})

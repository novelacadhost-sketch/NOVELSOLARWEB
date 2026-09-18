import { serverSupabaseServiceRole } from '#supabase/server'
import { bitrixFetch } from '../../utils/bitrixAuth'
import { logger } from '../../utils/logger'
import type { BitrixLeadResponse } from '../../types/bitrix'

/**
 * Deliver queued orders to Bitrix.
 *
 * Orders placed through `place_order_from_cart()` cannot reach the CRM at the
 * moment they are created — a Postgres function has no outbound HTTP — so the
 * function writes a `crm_outbox` row instead and this drains it. Without this
 * running, an order placed from the mobile app exists in Supabase and nowhere
 * else, which is the exact failure the endpoint-based flow avoids.
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
    branch?: { address?: string } | null
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

function buildLeadFields(payload: OutboxRow['payload']) {
  const customer = payload.customer || {}
  const cart = Array.isArray(payload.cart) ? payload.cart : []

  const items = cart
    .map((item) => `- ${item.quantity}x ${item.name} (₦${Number(item.price || 0).toLocaleString()})`)
    .join('\n')

  return {
    TITLE: `Web Order: ${customer.firstName || 'Customer'} ${customer.lastName || ''} (${payload.orderId})`,
    NAME: customer.firstName || 'Customer',
    LAST_NAME: customer.lastName || '',
    EMAIL: [{ VALUE: customer.email || '', VALUE_TYPE: 'WORK' }],
    PHONE: [{ VALUE: customer.phone || '0000000000', VALUE_TYPE: 'WORK' }],
    ADDRESS: customer.address || '',
    OPPORTUNITY: payload.total || 0,
    CURRENCY_ID: 'NGN',
    SOURCE_ID: 'WEB',
    COMMENTS: [
      `NEW MOBILE ORDER (${payload.orderId})`,
      `Fulfillment: ${payload.fulfillment === 'pickup' ? 'Store Pickup' : 'Delivery'}`,
      `Branch: ${payload.branch?.address || 'N/A'}`,
      `Payment: ${payload.paymentMethod || 'N/A'}`,
      '',
      'ITEMS:',
      items,
    ].join('\n'),
  }
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

      const response = await bitrixFetch<BitrixLeadResponse>('crm.lead.add', {
        method: 'POST',
        body: { fields: buildLeadFields(row.payload) },
      })

      if (response.error) throw new Error(response.error_description || String(response.error))

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
        leadId: response.result,
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

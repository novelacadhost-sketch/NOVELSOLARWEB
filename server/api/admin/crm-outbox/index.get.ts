import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'

/**
 * What is waiting to reach Bitrix, or gave up trying: orders whose deal could
 * not be created, enquiries queued while Bitrix was down, stock requests. The
 * drain retries pending rows; a row is 'failed' after 5 attempts, and before
 * this screen nothing showed those to anyone.
 */

interface OutboxRow {
  id: string
  event_type: string
  status: string
  attempts: number
  last_error: string | null
  next_retry_at: string | null
  created_at: string
  source_id: string | null
  payload: Record<string, unknown> | null
}

/** A line a person can recognise, from whichever payload shape the row has. */
function describe(row: OutboxRow): { title: string; contact: string | null; orderRef: string | null } {
  const p = row.payload ?? {}
  if (row.event_type === 'lead.create') {
    const fields = (p.fields ?? {}) as Record<string, unknown>
    const email = (fields.EMAIL as { VALUE?: string }[] | undefined)?.[0]?.VALUE ?? null
    return { title: String(fields.TITLE ?? `Enquiry (${p.source ?? 'form'})`), contact: email, orderRef: null }
  }
  const customer = (p.customer ?? {}) as Record<string, unknown>
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ')
  const title = row.event_type === 'order.created' ? `Order ${p.orderId ?? ''}`.trim() : row.event_type
  return {
    title: name ? `${title} — ${name}` : title,
    contact: (customer.email as string | undefined) ?? null,
    orderRef: typeof p.orderId === 'string' ? p.orderId : null,
  }
}

export default defineEventHandler(async (event) => {
  const status = String(getQuery(event).status ?? 'open')
  let request = getSupabaseAdminClient()
    .from('crm_outbox')
    .select('id, event_type, status, attempts, last_error, next_retry_at, created_at, source_id, payload')
    .order('created_at', { ascending: false })
    .limit(200)
  request = status === 'sent' ? request.eq('status', 'sent') : request.in('status', ['pending', 'failed'])

  const { data, error } = (await request) as { data: OutboxRow[] | null; error: { message: string } | null }
  if (error) {
    logger.error('AdminOutbox', 'Could not read the outbox', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load the CRM queue.' })
  }

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      type: row.event_type,
      status: row.status,
      attempts: row.attempts,
      lastError: row.last_error,
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
      orderId: row.source_id,
      ...describe(row),
    })),
  }
})

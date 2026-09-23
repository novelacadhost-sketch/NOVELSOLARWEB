import { logger } from './logger'
import { bitrixFetch } from './bitrixAuth'
import { messageStaff } from './staffMessage'
import { BITRIX_SOURCE, BITRIX_STAFF } from './bitrixProperties'

/**
 * A customer checkout turned away for lack of stock, asking to be called.
 *
 * Delivered by /api/stock-request straight away, and by the CRM outbox drain
 * when that first attempt fails — which is why this lives in a util: the two
 * must file the request identically.
 */

export const STOCK_REQUEST_EVENT = 'stock.requested'

export interface StockRequestItem {
  id: string
  name: string
  requested: number
  /** Verified against the catalog when the request was made. Null if that lookup failed. */
  available: number | null
}

export interface StockRequestPayload {
  customer: { firstName: string; lastName: string; phone: string; email: string | null }
  items: StockRequestItem[]
  branch: { name: string | null; bitrixId: string | null } | null
  note: string | null
  client: 'web' | 'app'
  requestedAt: string
}

const PORTAL_URL = 'https://nisl.bitrix24.com'

/** Procurement and sales support, unless STOCK_REQUEST_NOTIFY_USER_IDS says otherwise. */
function recipients(): number[] {
  const override = String(useRuntimeConfig().stockRequestNotifyUserIds || '')
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
  return override.length ? override : [BITRIX_STAFF.PROCUREMENT, BITRIX_STAFF.SALES_SUPPORT]
}

function itemLine(item: StockRequestItem): string {
  const stock = item.available === null ? 'stock unknown' : `${item.available} in stock`
  return `- ${item.requested} x ${item.name} (${stock})`
}

function customerName(payload: StockRequestPayload): string {
  return `${payload.customer.firstName} ${payload.customer.lastName}`.trim()
}

/**
 * Create the lead, then message procurement and sales support about it.
 *
 * The lead is what counts: it throws if the lead cannot be created, so the
 * outbox retries — and messages are only sent after it exists, so a retry
 * never double-messages anyone. Messages are best-effort once the lead is in:
 * a missed ping still leaves a lead sitting in the CRM, which is findable.
 */
export async function deliverStockRequest(payload: StockRequestPayload): Promise<{ leadId: string }> {
  const first = payload.items[0]
  const more = payload.items.length > 1 ? ` +${payload.items.length - 1} more` : ''

  const comments = [
    'STOCK REQUEST — checkout could not fill this order.',
    `Customer asked to be called about supply (${payload.client === 'app' ? 'mobile app' : 'website'}).`,
    '',
    `Phone: ${payload.customer.phone}`,
    payload.customer.email ? `Email: ${payload.customer.email}` : null,
    payload.branch?.name ? `Branch chosen: ${payload.branch.name}` : null,
    payload.note ? `Note: ${payload.note}` : null,
    '',
    'WANTED:',
    ...payload.items.map(itemLine),
  ]
    .filter((line): line is string => line !== null)
    .join('\n')

  const fields: Record<string, unknown> = {
    TITLE: `Stock request: ${first?.name ?? 'products'}${more}`,
    NAME: payload.customer.firstName,
    LAST_NAME: payload.customer.lastName,
    PHONE: [{ VALUE: payload.customer.phone, VALUE_TYPE: 'WORK' }],
    COMMENTS: comments,
    SOURCE_ID: BITRIX_SOURCE.WEBSITE_FORM,
    OPENED: 'Y',
  }
  if (payload.customer.email) fields.EMAIL = [{ VALUE: payload.customer.email, VALUE_TYPE: 'WORK' }]

  const response = await bitrixFetch<{ result?: string | number; error?: string; error_description?: string }>(
    'crm.lead.add',
    { method: 'POST', body: { fields, params: { REGISTER_SONET_EVENT: 'Y' } } },
  )
  if (response.error) throw new Error(response.error_description || String(response.error))
  if (!response.result) throw new Error('crm.lead.add returned no lead id')

  const leadId = String(response.result)
  const leadUrl = `${PORTAL_URL}/crm/lead/details/${leadId}/`

  const message = [
    '[B]Stock request — a customer needs a call back.[/B]',
    'Checkout could not fill their order, and they asked to be contacted about supply.',
    '',
    `Customer: ${customerName(payload)}`,
    `Phone: ${payload.customer.phone}`,
    payload.customer.email ? `Email: ${payload.customer.email}` : null,
    payload.branch?.name ? `Branch: ${payload.branch.name}` : null,
    `Lead: [URL=${leadUrl}]#${leadId}[/URL]`,
    '',
    'Wanted:',
    ...payload.items.map(itemLine),
    payload.note ? `\nNote from customer: ${payload.note}` : null,
    '',
    'Procurement: arrange the supply. Sales support: call the customer about availability.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n')

  const ids = recipients()
  const results = await Promise.all(ids.map((id) => messageStaff(id, message)))
  const reached = ids.filter((_, index) => results[index])

  if (reached.length < ids.length) {
    logger.warn('StockRequest', 'Lead created but not everyone was messaged', {
      leadId,
      recipients: ids,
      reached,
    })
  }

  logger.info('StockRequest', 'Stock request filed', { leadId, items: payload.items.length, reached })
  return { leadId }
}

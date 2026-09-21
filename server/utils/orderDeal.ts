import { logger } from './logger'
import { bitrixFetch } from './bitrixAuth'
import { BITRIX_DEAL } from './bitrixProperties'
import { findOrCreateBitrixContact, resolveBitrixContactId } from './bitrixContact'
import { notifyBranchManagerOfOrder } from './branchManagerNotify'

/**
 * Files a web order in Bitrix as a DEAL.
 *
 * Orders used to be created with `crm.lead.add`, which put every sale in the
 * lead funnel alongside contact-form enquiries. A lead is an unqualified
 * enquiry; an order is a committed purchase with a customer, a total and line
 * items, and it belongs in the sales pipeline. The enquiry endpoints
 * (contact / quote / book-service) still create leads — that is correct for
 * them.
 *
 * Three call sites share this: the website checkout, the outbox drain that
 * delivers mobile-app orders, and the failed-order retry.
 */

export interface OrderDealCartItem {
  id?: string | number
  ID?: string | number
  name?: string
  price?: number
  quantity: number
}

export interface OrderDealInput {
  orderId: string
  customer: {
    firstName?: string
    lastName?: string
    email: string
    phone?: string
    address?: string
    note?: string
  }
  cart: OrderDealCartItem[]
  total: number
  branch?: Record<string, unknown> | null
  paymentMethod?: string
  /**
   * 'pickup' | 'delivery'. The website encodes this in paymentMethod; the
   * mobile RPC sends it as its own field. Prefer it when present.
   */
  fulfillment?: string
  /**
   * Supabase user id when the buyer was signed in. Guests have none, and
   * neither does the mobile outbox payload — those resolve the contact by
   * email instead, which costs the profiles cache write, not correctness.
   */
  userId?: string | null
  /** Marks a deal recreated from the failed-order queue. */
  recovered?: boolean
}

export interface OrderDealResult {
  dealId: string
  contactId: string | null
  productRowsSet: boolean
  branchManagerNotified: boolean
}

function productIdOf(item: OrderDealCartItem): string | null {
  const raw = item.id ?? item.ID
  if (raw === null || raw === undefined || raw === '') return null
  return String(raw)
}

/**
 * The branch the customer chose, as an iblock 28 element id.
 *
 * `app/utils/locations.ts` carries `bitrixId` on every branch and the client
 * posts the whole branch object, which survives the zod schema because it is
 * `.passthrough()`. Anything else — a hand-built branch, an older client —
 * yields null and the deal is simply filed without a branch rather than with
 * a wrong one.
 */
function branchElementId(branch: Record<string, unknown> | null | undefined): string | null {
  const raw = branch?.bitrixId
  if (raw === null || raw === undefined || raw === '') return null
  const text = String(raw).trim()
  return /^\d+$/.test(text) ? text : null
}

function buildComments(order: OrderDealInput): string {
  const items = order.cart
    .map((item) => {
      const label = item.name || `product #${productIdOf(item) ?? 'unknown'}`
      const price = typeof item.price === 'number' ? ` (₦${item.price.toLocaleString()})` : ''
      return `- ${item.quantity}x ${label}${price}`
    })
    .join('\n')

  const branchLabel =
    (order.branch?.name as string | undefined) || (order.branch?.address as string | undefined) || 'N/A'

  const isPickup = (order.fulfillment || order.paymentMethod) === 'pickup'

  return [
    `${order.recovered ? 'RECOVERED WEB ORDER' : 'WEB ORDER'} (${order.orderId})`,
    `Fulfillment: ${isPickup ? 'Store Pickup' : 'Delivery'}`,
    `Branch: ${branchLabel}`,
    `Payment: ${order.paymentMethod || 'Bank Transfer'}`,
    `Notes: ${order.customer.note || 'None'}`,
    '',
    'ITEMS:',
    items,
  ].join('\n')
}

/**
 * Resolve the contact to hang the deal on.
 *
 * Never fatal. A deal with no contact is still a recorded sale that staff can
 * work; losing the order because the CRM contact lookup blipped would be far
 * worse.
 */
async function resolveContact(order: OrderDealInput): Promise<string | null> {
  const email = order.customer.email?.trim()
  if (!email) return null

  try {
    if (order.userId) {
      // Also caches the link on profiles.bitrix_contact_id.
      return await resolveBitrixContactId(order.userId, email)
    }
    return await findOrCreateBitrixContact(email, {
      firstName: order.customer.firstName,
      lastName: order.customer.lastName,
      phone: order.customer.phone,
    })
  } catch (err) {
    logger.warn('OrderDeal', 'Contact resolution failed; filing deal without a contact', {
      error: err instanceof Error ? err.message : String(err),
      orderId: order.orderId,
    })
    return null
  }
}

/**
 * Attach the cart as real deal product rows.
 *
 * Worth doing separately from the COMMENTS blob: rows are what Bitrix reports
 * on, and they let the CRM total reconcile against ours. Prices are the
 * server-resolved ones already on the order — the dealer gate was applied
 * upstream, so this must not re-derive anything.
 *
 * Non-fatal. The deal already exists by this point and carries OPPORTUNITY
 * and the itemised comments; failing the order over a rows call would throw
 * away a sale to gain a nicety.
 */
async function setProductRows(dealId: string, order: OrderDealInput): Promise<boolean> {
  const rows = order.cart
    .filter((item) => productIdOf(item) !== null && typeof item.price === 'number')
    .map((item) => ({
      PRODUCT_ID: productIdOf(item),
      PRICE: item.price,
      QUANTITY: item.quantity,
    }))

  if (rows.length === 0) return false

  try {
    const response = await bitrixFetch<{ error?: string; error_description?: string }>(
      'crm.deal.productrows.set',
      { method: 'POST', body: { id: dealId, rows } },
    )
    if (response.error) throw new Error(response.error_description || String(response.error))
    return true
  } catch (err) {
    logger.warn('OrderDeal', 'Failed to attach product rows; deal kept', {
      error: err instanceof Error ? err.message : String(err),
      orderId: order.orderId,
      dealId,
    })
    return false
  }
}

/**
 * Throws if the deal itself cannot be created — callers treat that as the CRM
 * being down and fall back to their own queue.
 */
export async function createOrderDeal(order: OrderDealInput): Promise<OrderDealResult> {
  const contactId = await resolveContact(order)

  const name = `${order.customer.firstName || 'Guest'} ${order.customer.lastName || ''}`.trim()
  const fields: Record<string, unknown> = {
    TITLE: `Web Order: ${name} (${order.orderId})${order.recovered ? ' [RECOVERED]' : ''}`,
    CATEGORY_ID: BITRIX_DEAL.CATEGORY_ID,
    STAGE_ID: BITRIX_DEAL.STAGE_ID,
    OPPORTUNITY: order.total,
    CURRENCY_ID: 'NGN',
    COMMENTS: buildComments(order),
    SOURCE_ID: 'WEB',
    TYPE_ID: 'SALE',
    [BITRIX_DEAL.WEB_ORDER_FLAG]: BITRIX_DEAL.WEB_ORDER_FLAG_YES,
  }

  if (contactId) fields.CONTACT_ID = contactId

  const branchId = branchElementId(order.branch)
  if (branchId) fields[BITRIX_DEAL.BRANCH_FIELD] = branchId

  const response = await bitrixFetch<{ result?: string | number; error?: string; error_description?: string }>(
    'crm.deal.add',
    { method: 'POST', body: { fields, params: { REGISTER_SONET_EVENT: 'Y' } } },
  )

  if (response.error) throw new Error(response.error_description || String(response.error))
  if (!response.result) throw new Error('crm.deal.add returned no deal id')

  const dealId = String(response.result)
  const productRowsSet = await setProductRows(dealId, order)

  // The warehouse on a product row cannot be set over REST, so the branch
  // manager is told to pick it. Never fatal; see branchManagerNotify.ts.
  const branchManagerNotified = branchId
    ? await notifyBranchManagerOfOrder({ branchElementId: branchId, dealId, orderId: order.orderId, total: order.total })
    : false

  logger.info('OrderDeal', 'Created deal in Bitrix', {
    orderId: order.orderId,
    dealId,
    contactId,
    branchId,
    productRowsSet,
    branchManagerNotified,
  })

  return { dealId, contactId, productRowsSet, branchManagerNotified }
}

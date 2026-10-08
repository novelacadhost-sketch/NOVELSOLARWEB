import { logger } from './logger'
import { bitrixFetch } from './bitrixAuth'
import { BITRIX_DEAL, BITRIX_SOURCE } from './bitrixProperties'
import { findOrCreateBitrixContact, resolveBitrixContactId } from './bitrixContact'
import { commentOnDeal, notifyBranchManagerOfOrder } from './branchManagerNotify'
import { describeFulfillment, describePaymentMethod } from './paymentMethod'
import { messageStaff } from './staffMessage'
import { staffNameFor } from './staffCodes'

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
  /** Before any staff-code discount. */
  price?: number
  /** Staff-code discount per unit, in naira. */
  discount?: number
  quantity: number
}

/** A staff code used on the order. See server/utils/promotions.ts. */
export interface OrderReferral {
  code: string
  staffBitrixId: number
  discountPercent: number
  discountAmount: number
  /** Before the discount; `total` on the order is after it. */
  subtotal: number
  /** Set when the staff member is credited but the customer got no discount. */
  noDiscountReason?: 'dealer' | 'disabled' | 'below_minimum' | null
  /** The cap, when the discount was scaled down to fit under it. */
  cappedAt?: number | null
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
  referral?: OrderReferral | null
}

export interface OrderDealResult {
  dealId: string
  contactId: string | null
  productRowsSet: boolean
  branchManagerNotified: boolean
  staffNotified: boolean
}

const PORTAL_URL = 'https://nisl.bitrix24.com'

const naira = (amount: number) => `₦${Number(amount || 0).toLocaleString()}`

function describeReferral(referral: OrderReferral): string {
  if (referral.noDiscountReason === 'dealer') return 'dealer order, no discount on dealer pricing'
  if (referral.noDiscountReason === 'disabled') return 'no discount running'
  if (referral.noDiscountReason === 'below_minimum') return 'order below the minimum for a discount'
  if (!(referral.discountAmount > 0)) return 'no discount applied'
  const cap = referral.cappedAt ? `, capped at ${naira(referral.cappedAt)}` : ''
  return `${referral.discountPercent}% staff-code discount${cap}, -${naira(referral.discountAmount)} on ${naira(referral.subtotal)}`
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

function buildComments(order: OrderDealInput, staffName: string | null): string {
  const items = order.cart
    .map((item) => {
      const label = item.name || `product #${productIdOf(item) ?? 'unknown'}`
      const discount = item.discount ? `, -${naira(item.discount)} each` : ''
      const price = typeof item.price === 'number' ? ` (${naira(item.price)}${discount})` : ''
      return `- ${item.quantity}x ${label}${price}`
    })
    .join('\n')

  const branchLabel =
    (order.branch?.name as string | undefined) || (order.branch?.address as string | undefined) || 'N/A'

  const isPickup = (order.fulfillment || order.paymentMethod) === 'pickup'

  const lines = [
    `${order.recovered ? 'RECOVERED WEB ORDER' : 'WEB ORDER'} (${order.orderId})`,
    `Fulfillment: ${describeFulfillment(isPickup)}`,
    `Branch: ${branchLabel}`,
    `Payment: ${describePaymentMethod(order.paymentMethod, isPickup)}`,
  ]

  // The customer was told an agent would call about the cost, so whoever works
  // the deal needs to know the total excludes it.
  if (!isPickup) lines.push('Delivery cost: NOT quoted - agent to contact the customer')

  if (order.referral) {
    const who = staffName ? ` (${staffName})` : ''
    lines.push(`Staff code: ${order.referral.code}${who} - ${describeReferral(order.referral)}`)
  }

  return [...lines, `Notes: ${order.customer.note || 'None'}`, '', 'ITEMS:', items].join('\n')
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

  // Applied only if the contact does not exist yet. Someone whose first
  // appearance in the CRM is a purchase came from a website sale, not from
  // the contact form that 'WEB' actually denotes on this portal. An existing
  // contact keeps whatever source sales gave it.
  const details = {
    firstName: order.customer.firstName,
    lastName: order.customer.lastName,
    phone: order.customer.phone,
    source: BITRIX_SOURCE.WEBSITE_SALE,
  }

  try {
    if (order.userId) {
      // Also caches the link on profiles.bitrix_contact_id.
      return await resolveBitrixContactId(order.userId, email, details)
    }
    return await findOrCreateBitrixContact(email, details)
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
    .map((item) => {
      const price = item.price as number
      const discount = item.discount && item.discount > 0 ? item.discount : 0
      if (!discount) return { PRODUCT_ID: productIdOf(item), PRICE: price, QUANTITY: item.quantity }
      // PRICE is what the customer pays per unit; the discount is recorded as an
      // absolute amount (type 1) so the line reads "price, less N" in Bitrix and
      // the deal total matches what Paystack charged to the naira.
      return {
        PRODUCT_ID: productIdOf(item),
        PRICE: price - discount,
        QUANTITY: item.quantity,
        DISCOUNT_TYPE_ID: 1,
        DISCOUNT_SUM: discount,
        DISCOUNT_RATE: Math.round((discount / price) * 10000) / 100,
      }
    })

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
  const staffName = order.referral ? await staffNameFor(order.referral.staffBitrixId) : null

  const name = `${order.customer.firstName || 'Guest'} ${order.customer.lastName || ''}`.trim()
  const summary = buildComments(order, staffName)
  const fields: Record<string, unknown> = {
    TITLE: `Web Order: ${name} (${order.orderId})${order.recovered ? ' [RECOVERED]' : ''}`,
    CATEGORY_ID: BITRIX_DEAL.CATEGORY_ID,
    STAGE_ID: BITRIX_DEAL.STAGE_ID,
    OPPORTUNITY: order.total,
    CURRENCY_ID: 'NGN',
    COMMENTS: summary,
    SOURCE_ID: 'WEB',
    TYPE_ID: 'SALE',
    [BITRIX_DEAL.WEB_ORDER_FLAG]: BITRIX_DEAL.WEB_ORDER_FLAG_YES,
  }

  if (contactId) fields.CONTACT_ID = contactId
  if (order.referral) fields[BITRIX_DEAL.REFERRED_BY_FIELD] = order.referral.staffBitrixId

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

  // The same summary again as a timeline comment. A portal automation replaces
  // COMMENTS on every new Product Sales deal with the source name ("Website
  // Contact Form") about three seconds after creation — measured 2026-10-08 —
  // which silently wiped the items, fulfilment, payment and staff code from
  // every web order. Timeline comments are not touched by it. Never fatal.
  const summaryOnTimeline = await commentOnDeal(dealId, summary)

  // The warehouse on a product row cannot be set over REST, so the branch
  // manager is told to pick it. Never fatal; see branchManagerNotify.ts.
  const branchManagerNotified = branchId
    ? await notifyBranchManagerOfOrder({ branchElementId: branchId, dealId, orderId: order.orderId, total: order.total })
    : false

  const staffNotified = order.referral ? await notifyReferringStaff(order, dealId) : false

  logger.info('OrderDeal', 'Created deal in Bitrix', {
    orderId: order.orderId,
    dealId,
    contactId,
    branchId,
    productRowsSet,
    branchManagerNotified,
    staffCode: order.referral?.code ?? null,
    staffNotified,
    summaryOnTimeline,
  })

  return { dealId, contactId, productRowsSet, branchManagerNotified, staffNotified }
}

/**
 * Tell the staff member their code was used.
 *
 * Sent from here, once the deal exists, rather than at checkout: a pay-now
 * order only gets its deal after Paystack confirms payment, so nobody is told
 * about a sale that was never paid for. Never fatal.
 */
async function notifyReferringStaff(order: OrderDealInput, dealId: string): Promise<boolean> {
  const referral = order.referral!
  const customer = [order.customer.firstName, order.customer.lastName?.charAt(0)].filter(Boolean).join(' ')
  const message = [
    `[B]Your staff code ${referral.code} was used.[/B]`,
    '',
    `Customer: ${customer || 'Guest'}${order.customer.lastName ? '.' : ''}`,
    `Order: ${order.orderId}`,
    `Value: ${naira(order.total)} (${describeReferral(referral)})`,
    `Deal: [URL=${PORTAL_URL}/crm/deal/details/${dealId}/]#${dealId}[/URL]`,
  ].join('\n')

  const sent = await messageStaff(referral.staffBitrixId, message)
  if (!sent) {
    logger.warn('OrderDeal', 'Could not notify the staff member whose code was used', {
      orderId: order.orderId,
      dealId,
      staffBitrixId: referral.staffBitrixId,
    })
  }
  return sent
}

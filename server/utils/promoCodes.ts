import { getSupabaseAdminClient } from './supabaseAdmin'
import { logger } from './logger'

/**
 * Promo codes an admin creates on the Promotions page (NOVEL10 and the like),
 * each with its own terms. Staff codes are in staffCodes.ts; the two share a
 * checkout box, and promotions.ts decides which one a typed code is.
 */

export interface PromoCode {
  code: string
  description: string | null
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderAmount: number
  maxDiscountAmount: number
  startsAt: string | null
  expiresAt: string | null
  usageLimit: number | null
  oncePerCustomer: boolean
  allowDealers: boolean
  enabled: boolean
}

export interface PromoCodeRow {
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number | string
  min_order_amount: number | string
  max_discount_amount: number | string
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  once_per_customer: boolean
  allow_dealers: boolean
  enabled: boolean
}

export const PROMO_CODE_COLUMNS =
  'code, description, discount_type, discount_value, min_order_amount, max_discount_amount, ' +
  'starts_at, expires_at, usage_limit, once_per_customer, allow_dealers, enabled'

export const PROMO_CODE_PATTERN = /^[A-Z0-9]{3,20}$/

export function toPromoCode(row: PromoCodeRow): PromoCode {
  return {
    code: row.code,
    description: row.description,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    minOrderAmount: Number(row.min_order_amount) || 0,
    maxDiscountAmount: Number(row.max_discount_amount) || 0,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    usageLimit: row.usage_limit,
    oncePerCustomer: row.once_per_customer,
    allowDealers: row.allow_dealers,
    enabled: row.enabled,
  }
}

/** Null when there is no such code or it cannot be read. */
export async function findPromoCode(code: string): Promise<PromoCode | null> {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from('promo_codes')
      .select(PROMO_CODE_COLUMNS)
      .eq('code', code)
      .maybeSingle()
    if (error) throw error
    return data ? toPromoCode(data as unknown as PromoCodeRow) : null
  } catch (error) {
    logger.warn('PromoCodes', 'Promo code lookup failed; not applied', {
      code,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * How long an unpaid Paystack order holds its use of a code. Long enough to
 * finish paying; short enough that an abandoned card form gives the use back.
 */
const PAYMENT_HOLD_MS = 60 * 60 * 1000

/**
 * The orders that count as a use: paid online, placed with another payment
 * method (pay at store) and not cancelled, or a card payment still in
 * progress. A card form someone walked away from stops counting after the
 * hold, so it does not use up a limited code.
 */
export function countedOrdersFilter(now = Date.now()): string {
  const holdFrom = new Date(now - PAYMENT_HOLD_MS).toISOString()
  return [
    'status.eq.confirmed',
    'and(payment_method.neq.paystack,status.not.in.(cancelled,failed))',
    `and(payment_method.eq.paystack,status.eq.pending,created_at.gte.${holdFrom})`,
  ].join(',')
}

/** Same rule as countedOrdersFilter(), for rows already fetched. */
export function isCountedOrder(order: { status: string; payment_method: string | null; created_at: string }, now = Date.now()): boolean {
  if (order.status === 'confirmed') return true
  if (order.status === 'cancelled' || order.status === 'failed') return false
  if (order.payment_method !== 'paystack') return true
  return new Date(order.created_at).getTime() >= now - PAYMENT_HOLD_MS
}

/** LIKE treats % and _ as wildcards, and an email can contain _. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Uses of a code so far, overall and by this customer's email.
 *
 * Throws if they cannot be counted: a limited code that cannot be checked is
 * refused rather than handed out past its limit.
 */
export async function countPromoCodeUses(code: string, email?: string | null): Promise<{ total: number; byCustomer: number }> {
  const supabase = getSupabaseAdminClient()
  const filter = countedOrdersFilter()

  const { count: total, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('promo_code', code)
    .or(filter)
  if (error) throw error

  let byCustomer = 0
  const address = email?.trim()
  // PostgREST reads * as a wildcard and cannot escape it; such an address is
  // compared exactly instead.
  if (address) {
    const query = supabase.from('orders').select('id', { count: 'exact', head: true }).eq('promo_code', code).or(filter)
    const { count, error: customerError } = await (address.includes('*')
      ? query.eq('customer_email', address)
      : query.ilike('customer_email', escapeLike(address)))
    if (customerError) throw customerError
    byCustomer = count ?? 0
  }

  return { total: total ?? 0, byCustomer }
}

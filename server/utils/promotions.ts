import { getSupabaseAdminClient } from './supabaseAdmin'
import { lookupStaffCode, normaliseStaffCode, type StaffCode } from './staffCodes'
import { logger } from './logger'

export interface PromotionSettings {
  discountEnabled: boolean
  discountPercent: number
  /** The order, before discount, must reach this for any discount. 0 = no minimum. */
  minOrderAmount: number
  /** The discount never exceeds this. 0 = no cap. */
  maxDiscountAmount: number
}

/** The typo guard from the migration, repeated so the admin form can say why. */
export const MAX_DISCOUNT_PERCENT = 20

// Read on every checkout; a minute is short enough that an admin turning the
// discount off sees it take effect almost at once.
const CACHE_TTL_MS = 60_000
let cache: { at: number; settings: PromotionSettings } | null = null

/** Off if the settings cannot be read: an outage must never hand out money. */
const FAIL_CLOSED: PromotionSettings = { discountEnabled: false, discountPercent: 0, minOrderAmount: 0, maxDiscountAmount: 0 }

const money = (value: unknown) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export async function getPromotionSettings(fresh = false): Promise<PromotionSettings> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.settings

  try {
    const { data, error } = await getSupabaseAdminClient()
      .from('promotion_settings')
      .select('discount_enabled, discount_percent, min_order_amount, max_discount_amount')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error

    const row = data as {
      discount_enabled: boolean
      discount_percent: number | string
      min_order_amount: number | string
      max_discount_amount: number | string
    } | null
    const percent = Number(row?.discount_percent ?? 0)
    const settings: PromotionSettings = {
      discountEnabled: Boolean(row?.discount_enabled),
      discountPercent: Number.isFinite(percent) ? Math.min(Math.max(percent, 0), MAX_DISCOUNT_PERCENT) : 0,
      minOrderAmount: money(row?.min_order_amount),
      maxDiscountAmount: money(row?.max_discount_amount),
    }
    cache = { at: Date.now(), settings }
    return settings
  } catch (error) {
    logger.warn('Promotions', 'Settings unreadable; no discount applied', {
      error: error instanceof Error ? error.message : String(error),
    })
    return FAIL_CLOSED
  }
}

/** Called after an admin saves, so this instance does not serve the old rate for a minute. */
export function clearPromotionSettingsCache(): void {
  cache = null
}

export type ReferralStatus = 'none' | 'invalid' | 'applied'

export interface Referral {
  status: ReferralStatus
  /** The code as the customer gave it, normalised. Null when none was given. */
  code: string | null
  staff: StaffCode | null
  /**
   * The rate this code earns. Zero for a dealer, when the discount is switched
   * off, or when there is no valid code — the staff member is still credited in
   * the first two cases. The order can still get less: see applyDiscount().
   */
  discountPercent: number
  /** The money limits in force, which applyDiscount() needs the cart to apply. */
  minOrderAmount: number
  maxDiscountAmount: number
  /** Why there is no discount on an applied code, for the customer and the deal. */
  noDiscountReason: NoDiscountReason | null
}

/** 'below_minimum' is only known once the cart is priced; see applyDiscount(). */
export type NoDiscountReason = 'dealer' | 'disabled' | 'below_minimum'

/**
 * What a code earns this customer. Dealers are credited to the staff member
 * but never discounted: dealer pricing already is their discount.
 */
export async function resolveReferral(rawCode: unknown, isDealer: boolean): Promise<Referral> {
  const given = typeof rawCode === 'string' && rawCode.trim() !== ''
  const none = { discountPercent: 0, minOrderAmount: 0, maxDiscountAmount: 0 }
  if (!given) return { status: 'none', code: null, staff: null, ...none, noDiscountReason: null }

  const staff = await lookupStaffCode(rawCode)
  if (!staff) {
    return {
      status: 'invalid',
      code: normaliseStaffCode(rawCode),
      staff: null,
      ...none,
      noDiscountReason: null,
    }
  }

  if (isDealer) {
    return { status: 'applied', code: staff.code, staff, ...none, noDiscountReason: 'dealer' }
  }

  const settings = await getPromotionSettings()
  if (!settings.discountEnabled || settings.discountPercent <= 0) {
    return { status: 'applied', code: staff.code, staff, ...none, noDiscountReason: 'disabled' }
  }

  return {
    status: 'applied',
    code: staff.code,
    staff,
    discountPercent: settings.discountPercent,
    minOrderAmount: settings.minOrderAmount,
    maxDiscountAmount: settings.maxDiscountAmount,
    noDiscountReason: null,
  }
}

/**
 * The discount on one unit, in whole naira.
 *
 * Worked out per unit rather than once on the order total so that the deal's
 * product lines, the order record and the Paystack charge all add up to
 * exactly the same figure — rounding the order total alone would leave the
 * lines a few naira out from what was charged.
 */
export function unitDiscount(unitPrice: number, percent: number): number {
  if (!(percent > 0) || !(unitPrice > 0)) return 0
  return Math.round((unitPrice * percent) / 100)
}

export interface DiscountedTotals<T> {
  cart: Array<T & { discount: number }>
  subtotal: number
  discountAmount: number
  total: number
  /** The order did not reach the minimum, so nothing was taken off. */
  belowMinimum: boolean
  /** The cap was reached and the discount was scaled down to fit under it. */
  capped: boolean
}

export interface DiscountTerms {
  discountPercent: number
  minOrderAmount?: number
  maxDiscountAmount?: number
}

/**
 * Apply the discount to a priced cart.
 *
 * Every line carries a whole-naira discount PER UNIT, and the order's discount
 * is the sum of those — never a separately rounded figure — so the deal's
 * product lines, the order record and the Paystack charge always agree.
 *
 * When the rate would go over the cap, the rate is lowered to cap / subtotal
 * and each unit's discount is rounded DOWN, so the total lands at or a few
 * naira under the cap and never over it.
 */
export function applyDiscount<T extends { price: number; quantity: number }>(
  cart: T[],
  terms: DiscountTerms,
): DiscountedTotals<T> {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const min = terms.minOrderAmount ?? 0
  const cap = terms.maxDiscountAmount ?? 0
  const belowMinimum = terms.discountPercent > 0 && min > 0 && subtotal < min

  const withDiscounts = (perUnit: (price: number) => number) => {
    const lines = cart.map((item) => ({ ...item, discount: perUnit(item.price) }))
    return { lines, amount: lines.reduce((sum, item) => sum + item.discount * item.quantity, 0) }
  }

  let { lines, amount } = withDiscounts((price) => (belowMinimum ? 0 : unitDiscount(price, terms.discountPercent)))
  let capped = false

  if (cap > 0 && amount > cap) {
    // Multiply before dividing, and allow for float error, so an exact share
    // such as 650000 * 10000 / 1300000 = 5000 is not floored to 4999.
    ;({ lines, amount } = withDiscounts((price) => Math.floor((price * cap) / subtotal + 1e-9)))
    capped = true
  }

  return { cart: lines, subtotal, discountAmount: amount, total: subtotal - amount, belowMinimum, capped }
}

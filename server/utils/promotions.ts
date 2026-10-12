import { getSupabaseAdminClient } from './supabaseAdmin'
import { lookupStaffCode, type StaffCode } from './staffCodes'
import { countPromoCodeUses, findPromoCode, PROMO_CODE_PATTERN } from './promoCodes'
import { logger } from './logger'

/** The global terms that staff codes carry. Promo codes carry their own; see promoCodes.ts. */
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

/**
 * What a discount is worth before it meets a cart: a percentage or a fixed
 * naira amount, with the money limits that come with it. 0 = no limit.
 */
export interface DiscountTerms {
  type: 'percent' | 'fixed'
  value: number
  minOrderAmount: number
  maxDiscountAmount: number
}

/** Why a typed code was refused. Checkout answers 409 with it; see checkout.post.ts. */
export type RejectReason =
  | 'not_found'
  | 'expired'
  | 'not_started'
  | 'used_up'
  | 'already_used'
  | 'disabled'
  | 'dealers_excluded'
  | 'unavailable'

/** What the customer is told, by checkout and by the code check alike. */
export const REJECT_MESSAGES: Record<RejectReason, string> = {
  not_found: "We don't recognise that promo code.",
  expired: 'This promo code has expired.',
  not_started: "This promo code isn't active yet.",
  used_up: 'This promo code has been fully used.',
  already_used: "You've already used this promo code.",
  disabled: 'This promo code is no longer available.',
  dealers_excluded: "This promo code can't be used with dealer pricing.",
  unavailable: "We couldn't check this promo code just now. Please try again.",
}

/** Why an accepted code took nothing off. 'below_minimum' is only known once the cart is priced. */
export type NoDiscountReason = 'dealer' | 'disabled' | 'below_minimum'

export interface ResolvedPromotion {
  /** The typed code, normalised. Null when none was typed. */
  code: string | null
  kind: 'staff' | 'promo' | null
  status: 'none' | 'applied' | 'rejected'
  rejectReason: RejectReason | null
  /** Who is credited: the typed staff code, or else the staff link the customer came through. */
  staff: StaffCode | null
  /** Null when no discount applies. */
  terms: DiscountTerms | null
  noDiscountReason: NoDiscountReason | null
}

/** What a customer typed or a link carried, in the form codes are stored. */
export function normaliseCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.replace(/[\s-]/g, '').toUpperCase()
  return PROMO_CODE_PATTERN.test(code) ? code : null
}

export interface ResolvePromotionInput {
  /** What the customer typed in the promo code box. */
  typed?: unknown
  /** A staff code remembered from a ?ref= link. Credits; never discounts on its own. */
  ref?: unknown
  isDealer: boolean
  /** For once-per-customer codes. Absent on the code check, which has no email yet. */
  email?: string | null
}

/**
 * Work out who is credited and what discount applies.
 *
 * A typed STAFF code credits that person and carries the global terms
 * (promotion_settings). A typed PROMO code carries its own terms, and the
 * staff member whose link the customer arrived through is still credited —
 * so a marketing code never takes the sale away from the person who sent the
 * customer. Dealers get no staff-code discount, and a promo code only if it
 * allows dealers.
 */
export async function resolvePromotion(input: ResolvePromotionInput): Promise<ResolvedPromotion> {
  const typed = normaliseCode(input.typed)
  const given = typeof input.typed === 'string' && input.typed.trim() !== ''
  const linkStaff = input.ref ? await lookupStaffCode(input.ref) : null

  const result = (patch: Partial<ResolvedPromotion>): ResolvedPromotion => ({
    code: typed,
    kind: null,
    status: 'none',
    rejectReason: null,
    staff: linkStaff,
    terms: null,
    noDiscountReason: null,
    ...patch,
  })

  if (!given) return result({})
  if (!typed) return result({ status: 'rejected', rejectReason: 'not_found' })

  const staff = await lookupStaffCode(typed)
  if (staff) {
    if (input.isDealer) return result({ kind: 'staff', status: 'applied', staff, noDiscountReason: 'dealer' })
    const settings = await getPromotionSettings()
    if (!settings.discountEnabled || settings.discountPercent <= 0) {
      return result({ kind: 'staff', status: 'applied', staff, noDiscountReason: 'disabled' })
    }
    return result({
      kind: 'staff',
      status: 'applied',
      staff,
      terms: {
        type: 'percent',
        value: settings.discountPercent,
        minOrderAmount: settings.minOrderAmount,
        maxDiscountAmount: settings.maxDiscountAmount,
      },
    })
  }

  const promo = await findPromoCode(typed)
  if (!promo) return result({ status: 'rejected', rejectReason: 'not_found' })

  const reject = (rejectReason: RejectReason) => result({ kind: 'promo', status: 'rejected', rejectReason })
  const now = Date.now()
  if (!promo.enabled) return reject('disabled')
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now) return reject('not_started')
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() <= now) return reject('expired')
  if (input.isDealer && !promo.allowDealers) return reject('dealers_excluded')

  if (promo.usageLimit || (promo.oncePerCustomer && input.email)) {
    try {
      const uses = await countPromoCodeUses(promo.code, promo.oncePerCustomer ? input.email : null)
      if (promo.usageLimit && uses.total >= promo.usageLimit) return reject('used_up')
      if (promo.oncePerCustomer && uses.byCustomer > 0) return reject('already_used')
    } catch (error) {
      // A limited code that cannot be counted is refused, not handed out past
      // its limit.
      logger.warn('Promotions', 'Could not count promo code uses; refused', {
        code: promo.code,
        error: error instanceof Error ? error.message : String(error),
      })
      return reject('unavailable')
    }
  }

  return result({
    kind: 'promo',
    status: 'applied',
    terms: {
      type: promo.discountType,
      value: promo.discountValue,
      minOrderAmount: promo.minOrderAmount,
      maxDiscountAmount: promo.discountType === 'percent' ? promo.maxDiscountAmount : 0,
    },
  })
}

export interface DiscountedTotals<T> {
  cart: Array<T & { discount: number }>
  subtotal: number
  discountAmount: number
  total: number
  /** The order did not reach the minimum, so nothing was taken off. */
  belowMinimum: boolean
  /** A percentage reached the cap and was brought down to it. */
  capped: boolean
}

/**
 * Spread an exact naira amount over the cart, as whole-naira discounts per unit.
 *
 * Each unit first gets its proportional share rounded down, which can leave a
 * few naira over. Those go one naira per unit to the lines with the fewest
 * units first — a single-unit line can absorb any remainder exactly — so a
 * "₦5,000 off" code takes off ₦5,000, not ₦4,997. Only a cart made entirely of
 * multiples can leave a naira or two unplaced, and then it stays under.
 *
 * Mirrored in app/utils/promoDiscount.ts for the checkout preview; change both.
 */
function spread<T extends { price: number; quantity: number }>(cart: T[], amount: number, subtotal: number): number[] {
  // Multiply before dividing, and allow for float error, so an exact share
  // such as 650000 * 10000 / 1300000 = 5000 is not floored to 4999.
  const perUnit = cart.map((item) => Math.floor((item.price * amount) / subtotal + 1e-9))
  let remainder = amount - perUnit.reduce((sum, d, i) => sum + d * cart[i]!.quantity, 0)

  const order = cart.map((_, i) => i).sort((a, b) => cart[a]!.quantity - cart[b]!.quantity || a - b)
  for (const i of order) {
    const item = cart[i]!
    while (remainder >= item.quantity && perUnit[i]! + 1 <= item.price) {
      perUnit[i]!++
      remainder -= item.quantity
    }
    if (remainder <= 0) break
  }
  return perUnit
}

/** The discount on one unit at a percentage, in whole naira. */
export function unitDiscount(unitPrice: number, percent: number): number {
  if (!(percent > 0) || !(unitPrice > 0)) return 0
  return Math.round((unitPrice * percent) / 100)
}

/**
 * Apply a discount to a priced cart.
 *
 * Every line carries a whole-naira discount PER UNIT, and the order's discount
 * is the sum of those — never a separately rounded figure — so the deal's
 * product lines, the order record and the Paystack charge always agree.
 *
 * A fixed amount never takes more than the order is worth, and a percentage
 * over its cap is brought down to the cap.
 */
export function applyDiscount<T extends { price: number; quantity: number }>(
  cart: T[],
  terms: DiscountTerms | null,
): DiscountedTotals<T> {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const none = (belowMinimum: boolean): DiscountedTotals<T> => ({
    cart: cart.map((item) => ({ ...item, discount: 0 })),
    subtotal,
    discountAmount: 0,
    total: subtotal,
    belowMinimum,
    capped: false,
  })

  if (!terms || !(terms.value > 0) || !(subtotal > 0)) return none(false)
  if (terms.minOrderAmount > 0 && subtotal < terms.minOrderAmount) return none(true)

  let perUnit: number[]
  let capped = false
  if (terms.type === 'fixed') {
    perUnit = spread(cart, Math.min(Math.round(terms.value), subtotal), subtotal)
  } else {
    perUnit = cart.map((item) => unitDiscount(item.price, terms.value))
    const amount = perUnit.reduce((sum, d, i) => sum + d * cart[i]!.quantity, 0)
    if (terms.maxDiscountAmount > 0 && amount > terms.maxDiscountAmount) {
      perUnit = spread(cart, Math.round(terms.maxDiscountAmount), subtotal)
      capped = true
    }
  }

  const lines = cart.map((item, i) => ({ ...item, discount: perUnit[i]! }))
  const discountAmount = lines.reduce((sum, item) => sum + item.discount * item.quantity, 0)
  return { cart: lines, subtotal, discountAmount, total: subtotal - discountAmount, belowMinimum: false, capped }
}

/** "1%", "10%" or "₦5,000 off", for receipts, deals and staff messages. */
export function describeTerms(terms: Pick<DiscountTerms, 'type' | 'value'>): string {
  return terms.type === 'fixed' ? `₦${Math.round(terms.value).toLocaleString()} off` : `${terms.value}%`
}

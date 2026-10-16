/**
 * The checkout preview of a promo-code discount.
 *
 * A copy of applyDiscount() in server/utils/promotions.ts, rounding included,
 * so the total shown is the total charged. The server decides; this only
 * shows. Change both together.
 */

export interface PromoTerms {
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderAmount: number
  maxDiscountAmount: number
  /** 'all', or a narrower target whose covered cart lines are in eligibleProductIds. */
  appliesTo: 'all' | 'sections' | 'products'
  /** From /api/promo-code with the cart's ids. Null when not known. */
  eligibleProductIds: string[] | null
}

export interface PromoPreview {
  amount: number
  belowMinimum: boolean
  capped: boolean
  /** Nothing in the cart is covered by the code. */
  notApplicable: boolean
}

const PROMO_CODE_PATTERN = /^[A-Z0-9]{3,20}$/

export function normalisePromoCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.replace(/[\s-]/g, '').toUpperCase()
  return PROMO_CODE_PATTERN.test(code) ? code : null
}

function spread(cart: Array<{ price: number; quantity: number }>, amount: number, subtotal: number): number[] {
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

export function previewPromoDiscount(
  cart: Array<{ id: string | number; price: number; quantity: number }>,
  terms: PromoTerms | null,
): PromoPreview {
  const none = (patch: Partial<PromoPreview> = {}): PromoPreview => ({
    amount: 0,
    belowMinimum: false,
    capped: false,
    notApplicable: false,
    ...patch,
  })
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  if (!terms || !(terms.discountValue > 0) || !(subtotal > 0)) return none()

  // Only covered lines take part; the minimum and the cap are measured on them.
  // A narrower target with no answer yet previews nothing rather than too much.
  const eligible = terms.appliesTo === 'all' ? null : new Set(terms.eligibleProductIds ?? [])
  const lines = eligible ? cart.filter((item) => eligible.has(String(item.id))) : cart
  const base = lines.reduce((sum, item) => sum + item.price * item.quantity, 0)
  if (!(base > 0)) return none({ notApplicable: true })
  if (terms.minOrderAmount > 0 && base < terms.minOrderAmount) return none({ belowMinimum: true })

  const total = (perUnit: number[]) => perUnit.reduce((sum, d, i) => sum + d * lines[i]!.quantity, 0)

  if (terms.discountType === 'fixed') {
    return none({ amount: total(spread(lines, Math.min(Math.round(terms.discountValue), base), base)) })
  }

  const perUnit = lines.map((item) => (item.price > 0 ? Math.round((item.price * terms.discountValue) / 100) : 0))
  const amount = total(perUnit)
  if (terms.maxDiscountAmount > 0 && amount > terms.maxDiscountAmount) {
    return none({ amount: total(spread(lines, Math.round(terms.maxDiscountAmount), base)), capped: true })
  }
  return none({ amount })
}

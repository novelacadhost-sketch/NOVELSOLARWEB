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
}

export interface PromoPreview {
  amount: number
  belowMinimum: boolean
  capped: boolean
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

export function previewPromoDiscount(cart: Array<{ price: number; quantity: number }>, terms: PromoTerms | null): PromoPreview {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  if (!terms || !(terms.discountValue > 0) || !(subtotal > 0)) return { amount: 0, belowMinimum: false, capped: false }
  if (terms.minOrderAmount > 0 && subtotal < terms.minOrderAmount) return { amount: 0, belowMinimum: true, capped: false }

  const total = (perUnit: number[]) => perUnit.reduce((sum, d, i) => sum + d * cart[i]!.quantity, 0)

  if (terms.discountType === 'fixed') {
    return { amount: total(spread(cart, Math.min(Math.round(terms.discountValue), subtotal), subtotal)), belowMinimum: false, capped: false }
  }

  const perUnit = cart.map((item) => (item.price > 0 ? Math.round((item.price * terms.discountValue) / 100) : 0))
  const amount = total(perUnit)
  if (terms.maxDiscountAmount > 0 && amount > terms.maxDiscountAmount) {
    return { amount: total(spread(cart, Math.round(terms.maxDiscountAmount), subtotal)), belowMinimum: false, capped: true }
  }
  return { amount, belowMinimum: false, capped: false }
}

/**
 * The order just placed, for the thank-you page.
 *
 * Kept in this tab's sessionStorage rather than fetched by reference: the
 * thank-you page has to work for guests, and a lookup by reference alone would
 * let anyone holding (or guessing) a reference read someone's name, address
 * and order. Survives the Paystack redirect because it is the same tab.
 */

const KEY = 'ns-last-order'

export interface LastOrder {
  reference: string
  placedAt: string
  items: { name: string; quantity: number; image: string | null }[]
  subtotal: number | null
  discount: number | null
  total: number | null
  fulfillment: 'pickup' | 'delivery'
  branch: string | null
  paymentMethod: string
}

export function saveLastOrder(order: LastOrder): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(order))
  } catch {
    // Private mode or storage full: the page falls back to the reference alone.
  }
}

export function readLastOrder(reference?: string | null): LastOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const order = JSON.parse(raw) as LastOrder
    return !reference || order.reference === reference ? order : null
  } catch {
    return null
  }
}

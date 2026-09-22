/**
 * Human labels for the payment choice.
 *
 * Two vocabularies are in flight. The pay-now checkout sends machine values
 * ('paystack', 'pay_at_store'); the checkout it replaces sent display strings
 * ('Cash on Delivery', 'Financing / Installment'). Orders already in the
 * failed-orders queue and the CRM outbox carry the old ones, so both have to
 * render for as long as those rows can still be drained or retried.
 */

export const PAYMENT_METHOD = {
  PAYSTACK: 'paystack',
  PAY_AT_STORE: 'pay_at_store',
} as const

const LABELS: Record<string, string> = {
  [PAYMENT_METHOD.PAYSTACK]: 'Paid online (Paystack)',
  [PAYMENT_METHOD.PAY_AT_STORE]: 'Pay at store on collection',
}

/**
 * `isPickup` only decides the fallback. A recognised method is labelled the
 * same either way — how someone pays and how they receive the goods are
 * separate facts, and conflating them is what made every store pickup read as
 * a delivery until 2026-09-22.
 */
export function describePaymentMethod(method: string | undefined, isPickup: boolean): string {
  const raw = String(method ?? '').trim()
  if (!raw) return isPickup ? 'Pay at store on collection' : 'Bank Transfer'

  const known = LABELS[raw.toLowerCase()]
  if (known) return known

  // An older client's display string — already human, pass it through.
  return raw
}

export function describeFulfillment(isPickup: boolean): string {
  return isPickup ? 'Store Pickup' : 'Delivery'
}

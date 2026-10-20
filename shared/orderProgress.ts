/**
 * The steps an order goes through, as the customer sees them. Staff move an
 * order along by hand on the admin Orders page (orders.fulfilment_status);
 * nothing is read from Bitrix. Keep the keys in step with the check constraint
 * in supabase/migrations/20261020140000_order_fulfilment_status.sql.
 *
 * The steps depend on what the customer chose at checkout:
 * - pickup skips "out for delivery";
 * - pickup paid at the store skips "payment confirmed" (they pay at the
 *   counter), and its last step is "paid and picked up".
 */

export const FULFILMENT_STEPS = [
  'received',
  'payment_confirmed',
  'preparing',
  'shipped',
  'at_fulfilment_centre',
  'out_for_delivery',
  'completed',
] as const

export type FulfilmentStep = (typeof FULFILMENT_STEPS)[number]

export interface OrderKind {
  fulfilment: 'pickup' | 'delivery'
  /** Pickup paid at the counter on collection. */
  payAtStore: boolean
}

export function orderKind(order: { fulfillment?: string | null; payment_method?: string | null }): OrderKind {
  const fulfilment = order.fulfillment === 'pickup' ? 'pickup' : 'delivery'
  // Pay at store only means something for pickup; a delivery order has no counter.
  const payAtStore = fulfilment === 'pickup' && String(order.payment_method ?? '').toLowerCase() === 'pay_at_store'
  return { fulfilment, payAtStore }
}

export function isFulfilmentStep(value: unknown): value is FulfilmentStep {
  return typeof value === 'string' && (FULFILMENT_STEPS as readonly string[]).includes(value)
}

export function stepsFor(kind: OrderKind): FulfilmentStep[] {
  return FULFILMENT_STEPS.filter((step) => {
    if (step === 'out_for_delivery') return kind.fulfilment === 'delivery'
    if (step === 'payment_confirmed') return !kind.payAtStore
    return true
  })
}

/** Why a step does not apply to this order, or null when it does. */
export function stepNotAllowed(step: FulfilmentStep, kind: OrderKind): string | null {
  if (step === 'out_for_delivery' && kind.fulfilment === 'pickup') return 'A pickup order cannot be out for delivery.'
  if (step === 'payment_confirmed' && kind.payAtStore) {
    return 'This customer pays at the store. Mark it "Paid and picked up" when they pay and collect.'
  }
  return null
}

export function stepLabel(step: FulfilmentStep, kind: OrderKind): string {
  switch (step) {
    case 'received':
      return 'Order received'
    case 'payment_confirmed':
      return 'Payment confirmed'
    case 'preparing':
      return 'Preparing order'
    case 'shipped':
      return 'Order shipped'
    case 'at_fulfilment_centre':
      return 'At fulfilment centre'
    case 'out_for_delivery':
      return 'Out for delivery'
    case 'completed':
      if (kind.fulfilment === 'delivery') return 'Delivered'
      return kind.payAtStore ? 'Paid and picked up' : 'Picked up'
  }
}

export function stepDetail(step: FulfilmentStep, kind: OrderKind): string {
  switch (step) {
    case 'received':
      return kind.payAtStore ? 'You will pay when you collect.' : 'We are confirming your payment.'
    case 'payment_confirmed':
      return 'Your payment has been confirmed.'
    case 'preparing':
      return 'We are preparing your order.'
    case 'shipped':
      return 'Your order is on its way to the fulfilment centre.'
    case 'at_fulfilment_centre':
      if (kind.fulfilment === 'delivery') return 'Your order is at the fulfilment centre, ready for delivery.'
      return kind.payAtStore
        ? 'Your order is ready for pickup. Pay when you collect.'
        : 'Your order is ready for pickup.'
    case 'out_for_delivery':
      return 'Your order is out for delivery.'
    case 'completed':
      if (kind.fulfilment === 'delivery') return 'Your order has been delivered.'
      return kind.payAtStore ? 'You have paid for and picked up your order.' : 'You have picked up your order.'
  }
}

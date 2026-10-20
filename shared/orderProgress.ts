/**
 * The steps an order goes through, as the customer sees them. Staff move an
 * order along by hand on the admin Orders page (orders.fulfilment_status);
 * nothing is read from Bitrix. Keep the keys in step with the check constraint
 * in supabase/migrations/20261020140000_order_fulfilment_status.sql.
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
export type Fulfilment = 'pickup' | 'delivery'

export function isFulfilmentStep(value: unknown): value is FulfilmentStep {
  return typeof value === 'string' && (FULFILMENT_STEPS as readonly string[]).includes(value)
}

/** Pickup orders skip "out for delivery". */
export function stepsFor(fulfilment: Fulfilment): FulfilmentStep[] {
  return FULFILMENT_STEPS.filter((step) => fulfilment === 'delivery' || step !== 'out_for_delivery')
}

export function stepLabel(step: FulfilmentStep, fulfilment: Fulfilment): string {
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
      return fulfilment === 'pickup' ? 'Picked up' : 'Delivered'
  }
}

export function stepDetail(step: FulfilmentStep, fulfilment: Fulfilment): string {
  switch (step) {
    case 'received':
      return 'We are confirming your payment.'
    case 'payment_confirmed':
      return 'Your payment has been confirmed.'
    case 'preparing':
      return 'We are preparing your order.'
    case 'shipped':
      return 'Your order is on its way to the fulfilment centre.'
    case 'at_fulfilment_centre':
      return fulfilment === 'pickup'
        ? 'Your order is ready for pickup.'
        : 'Your order is at the fulfilment centre, ready for delivery.'
    case 'out_for_delivery':
      return 'Your order is out for delivery.'
    case 'completed':
      return fulfilment === 'pickup' ? 'You have picked up your order.' : 'Your order has been delivered.'
  }
}

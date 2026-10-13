/**
 * How an order is described to the person who placed it, and to staff.
 *
 * The database only knows payment: a Paystack order goes pending -> confirmed
 * when the payment lands, and a pay-at-store order stays pending. Collection
 * and delivery happen in Bitrix deal stages, which are not mirrored here, so
 * nothing below claims an order was delivered.
 */

export const ORDER_COLUMNS =
  'id, client_order_ref, created_at, status, payment_method, fulfillment, branch, subtotal, discount_amount, total, promo_code, staff_code'

export const ORDER_ITEM_COLUMNS = 'bitrix_product_id, name, quantity, unit_price, unit_discount, image_url'

export interface OrderRow {
  id: string
  client_order_ref: string | null
  created_at: string
  status: string
  payment_method: string | null
  fulfillment: string | null
  branch: Record<string, unknown> | null
  subtotal: number | string | null
  discount_amount: number | string | null
  total: number | string | null
  promo_code: string | null
  staff_code: string | null
}

export interface OrderItemRow {
  bitrix_product_id: string | null
  name: string | null
  quantity: number | null
  unit_price: number | string | null
  unit_discount: number | string | null
  image_url: string | null
}

export type StatusTone = 'ok' | 'warn' | 'bad' | 'info'

/** A Paystack order still unpaid after this long is treated as abandoned. */
const PAYMENT_WINDOW_MS = 60 * 60_000

export function describeOrderStatus(order: Pick<OrderRow, 'status' | 'payment_method' | 'created_at'>): {
  label: string
  tone: StatusTone
} {
  if (order.status === 'cancelled') return { label: 'Cancelled', tone: 'bad' }
  if (order.status === 'failed') return { label: 'Failed', tone: 'bad' }

  const paystack = String(order.payment_method ?? '').toLowerCase() === 'paystack'
  if (paystack) {
    if (order.status === 'confirmed') return { label: 'Paid', tone: 'ok' }
    const age = Date.now() - new Date(order.created_at).getTime()
    return age > PAYMENT_WINDOW_MS
      ? { label: 'Payment not completed', tone: 'bad' }
      : { label: 'Awaiting payment', tone: 'warn' }
  }

  if (order.status === 'confirmed') return { label: 'Confirmed', tone: 'ok' }
  return { label: 'Pay at collection', tone: 'info' }
}

export function branchName(branch: Record<string, unknown> | null | undefined): string | null {
  const name = branch?.name ?? branch?.title ?? branch?.address
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

const num = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** The shape both the account pages and the admin screen send to the browser. */
export function presentOrder(order: OrderRow, items: OrderItemRow[] = []) {
  return {
    id: order.id,
    reference: order.client_order_ref ?? order.id,
    createdAt: order.created_at,
    status: describeOrderStatus(order),
    paymentMethod: order.payment_method,
    fulfillment: order.fulfillment === 'pickup' ? 'pickup' : 'delivery',
    branch: branchName(order.branch),
    subtotal: num(order.subtotal),
    discount: num(order.discount_amount),
    total: num(order.total),
    promoCode: order.promo_code ?? order.staff_code ?? null,
    items: items.map((item) => ({
      productId: item.bitrix_product_id,
      name: item.name ?? 'Product',
      quantity: num(item.quantity) || 1,
      unitPrice: num(item.unit_price),
      unitDiscount: num(item.unit_discount),
      image: item.image_url,
    })),
  }
}

export type PresentedOrder = ReturnType<typeof presentOrder>

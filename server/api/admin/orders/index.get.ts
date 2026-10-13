import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { ORDER_COLUMNS, ORDER_ITEM_COLUMNS, presentOrder, type OrderItemRow, type OrderRow } from '../../../utils/orderView'
import { logger } from '../../../utils/logger'

/**
 * Website and app orders for the admin Orders screen, newest first, 50 a page.
 *
 *   ?q=      order reference, email, phone, name, promo or staff code (partial)
 *   ?filter= paid | awaiting | abandoned | store | all
 *   ?page=   1-based
 */

const PAGE_SIZE = 50
const PAYMENT_WINDOW_MS = 60 * 60_000

type AdminOrderRow = OrderRow & {
  customer_email: string | null
  customer_first_name: string | null
  customer_last_name: string | null
  customer_phone: string | null
  user_id: string | null
  order_items: OrderItemRow[] | null
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().slice(0, 100)
  const filter = String(query.filter ?? 'all')
  const page = Math.max(1, Math.min(1000, Number(query.page) || 1))

  let request = getSupabaseAdminClient()
    .from('orders')
    .select(
      `${ORDER_COLUMNS}, customer_email, customer_first_name, customer_last_name, customer_phone, user_id, order_items(${ORDER_ITEM_COLUMNS})`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (q) {
    // PostgREST or-filter values: commas and parentheses would break the list,
    // and % and _ are LIKE wildcards.
    const term = q.replace(/[,()%_*\\]/g, ' ').trim()
    if (term) {
      request = request.or(
        [
          'client_order_ref',
          'customer_email',
          'customer_phone',
          'customer_first_name',
          'customer_last_name',
          'promo_code',
          'staff_code',
        ]
          .map((column) => `${column}.ilike.%${term}%`)
          .join(','),
      )
    }
  }

  const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MS).toISOString()
  if (filter === 'paid') request = request.eq('payment_method', 'paystack').eq('status', 'confirmed')
  if (filter === 'awaiting') request = request.eq('payment_method', 'paystack').eq('status', 'pending').gte('created_at', cutoff)
  if (filter === 'abandoned') request = request.eq('payment_method', 'paystack').eq('status', 'pending').lt('created_at', cutoff)
  if (filter === 'store') request = request.neq('payment_method', 'paystack')

  const { data, error, count } = (await request) as {
    data: AdminOrderRow[] | null
    error: { message: string } | null
    count: number | null
  }

  if (error) {
    logger.error('AdminOrders', 'Could not list orders', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load orders.' })
  }

  return {
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    orders: (data ?? []).map((order) => ({
      ...presentOrder(order, order.order_items ?? []),
      customer: {
        name: [order.customer_first_name, order.customer_last_name].filter(Boolean).join(' ') || null,
        email: order.customer_email,
        phone: order.customer_phone,
        hasAccount: Boolean(order.user_id),
      },
    })),
  }
})

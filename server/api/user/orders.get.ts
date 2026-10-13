import { resolveUserIdFromEvent } from '../../utils/dealerCheck'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { ORDER_COLUMNS, ORDER_ITEM_COLUMNS, presentOrder, type OrderItemRow, type OrderRow } from '../../utils/orderView'
import { logger } from '../../utils/logger'

/**
 * The signed-in customer's orders, newest first. Cookie or Bearer, like
 * checkout. Guest orders on the same confirmed email are attached by
 * claimGuestOrders() when the profile loads, so they appear here too.
 */
export default defineEventHandler(async (event) => {
  const userId = await resolveUserIdFromEvent(event)
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Please sign in to see your orders.' })

  setHeader(event, 'Cache-Control', 'private, no-store')

  const { data, error } = (await getSupabaseAdminClient()
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items(${ORDER_ITEM_COLUMNS})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)) as {
    data: (OrderRow & { order_items: OrderItemRow[] | null })[] | null
    error: { message: string } | null
  }

  if (error) {
    logger.error('UserOrders', 'Could not read orders', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load your orders.' })
  }

  return { orders: (data ?? []).map((order) => presentOrder(order, order.order_items ?? [])) }
})

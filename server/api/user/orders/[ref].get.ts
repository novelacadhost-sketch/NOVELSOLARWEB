import { resolveUserIdFromEvent } from '../../../utils/dealerCheck'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import {
  ORDER_COLUMNS,
  ORDER_ITEM_COLUMNS,
  presentOrder,
  type OrderItemRow,
  type OrderRow,
} from '../../../utils/orderView'
import { logger } from '../../../utils/logger'

/**
 * One of the signed-in customer's orders, by its ORD- reference. Someone
 * else's reference is a 404, the same as a reference that does not exist.
 */
export default defineEventHandler(async (event) => {
  const userId = await resolveUserIdFromEvent(event)
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Please sign in to see your orders.' })

  const ref = String(getRouterParam(event, 'ref') ?? '')
  if (!/^ORD-[\w-]{4,80}$/.test(ref)) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  setHeader(event, 'Cache-Control', 'private, no-store')

  const { data, error } = (await getSupabaseAdminClient()
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items(${ORDER_ITEM_COLUMNS}), order_events(status, message, created_at)`)
    .eq('user_id', userId)
    .eq('client_order_ref', ref)
    .maybeSingle()) as {
    data:
      | (OrderRow & {
          order_items: OrderItemRow[] | null
          order_events: { status: string; message: string | null; created_at: string }[] | null
        })
      | null
    error: { message: string } | null
  }

  if (error) {
    logger.error('UserOrders', 'Could not read order', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load this order.' })
  }
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  return {
    order: {
      ...presentOrder(data, data.order_items ?? []),
      // Messages only: an event's meta holds the Paystack transaction details.
      events: (data.order_events ?? [])
        .filter((e) => e.message)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((e) => ({ message: e.message, at: e.created_at })),
    },
  }
})

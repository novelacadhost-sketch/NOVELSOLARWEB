import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { ORDER_COLUMNS, ORDER_ITEM_COLUMNS, presentOrder, type OrderItemRow, type OrderRow } from '../../../utils/orderView'
import { logger } from '../../../utils/logger'

/**
 * One order for the admin detail screen: customer, items, the payment trail,
 * and every CRM outbox row that concerns it, so staff can see whether it
 * reached Bitrix and retry it if not.
 */

type AdminOrderDetail = OrderRow & {
  customer_email: string | null
  customer_first_name: string | null
  customer_last_name: string | null
  customer_phone: string | null
  shipping_address: string | null
  user_id: string | null
  staff_bitrix_id: number | null
  order_items: OrderItemRow[] | null
  order_events: { status: string; message: string | null; meta: Record<string, unknown> | null; created_at: string }[] | null
}

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  const supabase = getSupabaseAdminClient()
  const { data, error } = (await supabase
    .from('orders')
    .select(
      `${ORDER_COLUMNS}, customer_email, customer_first_name, customer_last_name, customer_phone, shipping_address, user_id, staff_bitrix_id, order_items(${ORDER_ITEM_COLUMNS}), order_events(status, message, meta, created_at)`,
    )
    .eq('id', id)
    .maybeSingle()) as { data: AdminOrderDetail | null; error: { message: string } | null }

  if (error) {
    logger.error('AdminOrders', 'Could not read order', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load this order.' })
  }
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  // Linked by source_id (app orders, payment-time retries) or, for website
  // orders queued at checkout, by the reference in the payload.
  const ref = data.client_order_ref
  const outboxQuery = supabase
    .from('crm_outbox')
    .select('id, event_type, status, attempts, last_error, next_retry_at, created_at, updated_at')
    .order('created_at', { ascending: true })
  const { data: outbox } = (await (ref
    ? outboxQuery.or(`source_id.eq.${id},payload->>orderId.eq.${ref.replace(/[,()]/g, '')}`)
    : outboxQuery.eq('source_id', id))) as { data: Record<string, unknown>[] | null }

  return {
    order: {
      ...presentOrder(data, data.order_items ?? []),
      customer: {
        name: [data.customer_first_name, data.customer_last_name].filter(Boolean).join(' ') || null,
        email: data.customer_email,
        phone: data.customer_phone,
        address: data.shipping_address,
        hasAccount: Boolean(data.user_id),
      },
      staffBitrixId: data.staff_bitrix_id,
      events: (data.order_events ?? [])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((e) => ({
          status: e.status,
          message: e.message,
          at: e.created_at,
          // Payment facts staff need to match a bank statement; nothing more.
          paystack: e.meta
            ? {
                reference: e.meta.reference ?? null,
                channel: e.meta.channel ?? null,
                amount: e.meta.amount ?? null,
                paidAt: e.meta.paid_at ?? e.meta.paidAt ?? null,
              }
            : null,
        })),
      outbox: outbox ?? [],
    },
  }
})

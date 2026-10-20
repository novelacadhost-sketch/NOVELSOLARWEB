import { getSupabaseAdminClient } from '../../../../utils/supabaseAdmin'
import { logger } from '../../../../utils/logger'
import { isFulfilmentStep, orderKind, stepLabel, stepNotAllowed } from '#shared/orderProgress'

/**
 * Move an order to a fulfilment step (admin Orders page). The customer sees it
 * in their order history. Any step may be chosen, backwards included, so a
 * mistake can be put right; each change is logged as an order event.
 */
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  const body = await readBody<{ step?: unknown }>(event)
  const step = body?.step
  if (!isFulfilmentStep(step)) throw createError({ statusCode: 400, statusMessage: 'Unknown status.' })

  const supabase = getSupabaseAdminClient()
  const { data: order } = (await supabase
    .from('orders')
    .select('id, status, fulfillment, payment_method, fulfilment_status')
    .eq('id', id)
    .maybeSingle()) as {
    data: {
      id: string
      status: string
      fulfillment: string | null
      payment_method: string | null
      fulfilment_status: string | null
    } | null
  }
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  const kind = orderKind(order)
  const notAllowed = stepNotAllowed(step, kind)
  if (notAllowed) throw createError({ statusCode: 400, statusMessage: notAllowed })
  if (order.fulfilment_status === step) return { success: true, step }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('orders')
    .update({ fulfilment_status: step, fulfilment_updated_at: now, updated_at: now } as never)
    .eq('id', id)
  if (error) {
    logger.error('AdminOrders', 'Could not update fulfilment status', { id, step, error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not update the order.' })
  }

  // The message is shown to the customer in the order's history, and customers
  // can read their own order_events rows, so meta holds the admin's id, never
  // their email; the admin screen turns it back into a username.
  const by = (event.context.admin as { user_id?: string } | undefined)?.user_id ?? null
  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: id,
    status: order.status,
    message: stepLabel(step, kind),
    meta: { fulfilment_status: step, by },
  } as never)
  if (eventError) logger.warn('AdminOrders', 'Fulfilment event not recorded', { id, error: eventError.message })

  logger.info('AdminOrders', 'Fulfilment status changed', { id, from: order.fulfilment_status, to: step, by })
  return { success: true, step }
})

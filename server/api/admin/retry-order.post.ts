import { z } from 'zod'
import { createOrderDeal } from '../../utils/orderDeal'
import { logger } from '../../utils/logger'
import type { FailedOrder } from '../../types/database'

const bodySchema = z.object({
  orderId: z.string().trim().min(1).max(120),
})

export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'orderId is required.' })
  }
  const { orderId } = parsed.data

  const storage = useStorage('data:failed-orders')
  const stored = await storage.getItem<FailedOrder>(orderId)
  if (!stored) {
    throw createError({ statusCode: 404, statusMessage: 'Failed order not found.' })
  }

  try {
    // A sale is a Deal, not a Lead. See server/utils/orderDeal.ts.
    // The stored FailedOrder keeps cart items as {id, quantity} only — names
    // and prices were resolved from Bitrix at the original checkout and are
    // not persisted — so the recovered deal gets no product rows, just the
    // preserved total.
    const deal = await createOrderDeal({
      orderId: stored.orderId,
      customer: stored.customer,
      cart: stored.cart,
      total: stored.total,
      branch: stored.branch,
      paymentMethod: stored.paymentMethod,
      recovered: true,
    })

    try {
      await storage.removeItem(orderId)
    } catch (cleanupError) {
      logger.error(
        'Retry Order',
        '[CRITICAL] Deal created but failed to remove from queue — possible duplicate on next retry',
        {
          error: cleanupError,
          orderId,
          dealId: deal.dealId,
        },
      )
    }

    logger.info('Retry Order', `✅ Recovered order ${orderId}`, { orderId, dealId: deal.dealId })
    return { success: true, dealId: deal.dealId }
  } catch (error: unknown) {
    const err = error as { statusCode?: number; data?: unknown }
    if (err.statusCode) throw error
    logger.error('Retry Order', 'Retry submission failed', { error: err.data || error, orderId })
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not reach Bitrix. The order remains in the failed queue.',
    })
  }
})

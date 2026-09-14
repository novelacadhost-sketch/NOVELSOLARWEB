import { z } from 'zod'
import { bitrixFetch } from '../../utils/bitrixAuth'
import { buildOrderLeadPayload } from '../../utils/leadPayloads'
import { logger } from '../../utils/logger'
import type { FailedOrder } from '../../types/database'
import type { BitrixLeadResponse } from '../../types/bitrix'

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
    const response = await bitrixFetch<BitrixLeadResponse>('crm.lead.add', {
      method: 'POST',
      body: buildOrderLeadPayload(stored),
    })

    if (response.error) {
      logger.error('Retry Order', 'Bitrix error response', {
        error: response.error,
        error_description: response.error_description,
        orderId,
      })
      throw createError({
        statusCode: 502,
        statusMessage: response.error_description || 'Bitrix rejected the retry.',
      })
    }

    try {
      await storage.removeItem(orderId)
    } catch (cleanupError) {
      logger.error(
        'Retry Order',
        '[CRITICAL] Lead created but failed to remove from queue — possible duplicate on next retry',
        {
          error: cleanupError,
          orderId,
          leadId: response.result,
        },
      )
    }

    logger.info('Retry Order', `✅ Recovered order ${orderId}`, { orderId, leadId: response.result })
    return { success: true, leadId: response.result }
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

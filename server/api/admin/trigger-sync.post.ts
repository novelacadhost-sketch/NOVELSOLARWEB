import { runTask } from 'nitropack/runtime'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  const { cronSecret } = useRuntimeConfig()

  if (!event.context.admin) {
    if (!cronSecret) {
      throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET is not configured' })
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  logger.info('ProductSync', 'Sync triggered', {
    user: event.context.admin?.email || 'cron',
  })

  // Awaited deliberately. This previously fired and forgot, which does not
  // work on serverless: the instance is frozen once the response is sent, so
  // the task was killed before it wrote anything and the endpoint reported
  // success regardless. The task caps its own Bitrix fetch at 30s.
  try {
    const result = await runTask('sync:products')
    return { success: true, ...(result?.result as Record<string, unknown>) }
  } catch (error) {
    logger.error('ProductSync', 'Task failed from trigger', { error })
    throw createError({
      statusCode: 502,
      statusMessage: `Product sync failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    })
  }
})

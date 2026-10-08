import { logger } from '../../utils/logger'
import { syncAllProducts } from '../../utils/syncAllProducts'
import { syncStaffCodes } from '../../utils/staffCodes'

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

  // Called directly and awaited, rather than via runTask(). Nitro tasks are
  // not registered in Vercel's serverless runtime ("Task is not available"),
  // and firing without awaiting is killed when the instance freezes on
  // response — which is why this endpoint used to report success while
  // writing nothing. The sync caps its own Bitrix fetch at 30s.
  try {
    const result = await syncAllProducts()

    // Rides on the nightly run so a new hire has a code by the next morning.
    // Never fails the product sync: the two are unrelated, and the admin
    // Promotions page has its own "refresh now".
    let staffCodes: Awaited<ReturnType<typeof syncStaffCodes>> | { error: string }
    try {
      staffCodes = await syncStaffCodes()
    } catch (error) {
      staffCodes = { error: error instanceof Error ? error.message : String(error) }
      logger.warn('ProductSync', 'Staff code sync failed; products unaffected', staffCodes)
    }

    return { success: true, ...result, staffCodes }
  } catch (error) {
    logger.error('ProductSync', 'Task failed from trigger', { error })
    throw createError({
      statusCode: 502,
      statusMessage: `Product sync failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    })
  }
})

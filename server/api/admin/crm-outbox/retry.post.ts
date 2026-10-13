import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'

/**
 * Put a failed or waiting row back at the front of the queue: pending, zero
 * attempts, due now. The caller then runs the drain, which delivers it.
 *
 * A row already sent is refused — retrying it would create a second deal or
 * lead in Bitrix.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: string }>(event)
  const id = String(body?.id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid queue item.' })

  const { data, error } = (await getSupabaseAdminClient()
    .from('crm_outbox')
    .update({
      status: 'pending',
      attempts: 0,
      next_retry_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .in('status', ['pending', 'failed'])
    .select('id')) as { data: { id: string }[] | null; error: { message: string } | null }

  if (error) {
    logger.error('AdminOutbox', 'Retry failed', { id, error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not queue the retry.' })
  }
  if (!data?.length) throw createError({ statusCode: 409, statusMessage: 'That item was already sent or no longer exists.' })

  logger.info('AdminOutbox', 'Row re-queued by admin', { id, by: event.context.admin?.email })
  return { success: true }
})

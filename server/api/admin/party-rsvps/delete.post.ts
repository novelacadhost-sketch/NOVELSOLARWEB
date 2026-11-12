import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'
import { PARTY_EVENT } from '#shared/party'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/admin/party-rsvps/delete { id }
 *
 * Removes one RSVP (test entries, mistakes), whether from Bitrix staff or
 * someone not on Bitrix. Admins only, via adminGuard; the HR results link has
 * no way to reach this. The person can register again while the form is open.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: unknown }>(event)
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!UUID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Missing or invalid RSVP id.' })

  const { data, error } = (await getSupabaseAdminClient()
    .from('party_rsvps')
    .delete()
    .eq('event', PARTY_EVENT)
    .eq('id', id)
    .select('id, staff_code')) as {
    data: { id: string; staff_code: string | null }[] | null
    error: { message: string } | null
  }

  if (error) {
    logger.error('Party', 'RSVP delete failed', { id, error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not delete the RSVP.' })
  }
  if (!data?.length) throw createError({ statusCode: 404, statusMessage: 'That RSVP no longer exists.' })

  const admin = event.context.admin as { email?: string } | undefined
  logger.info('Party', 'RSVP deleted by admin', {
    id,
    staffCode: data[0]?.staff_code ?? 'not-on-bitrix',
    admin: admin?.email ?? null,
  })
  return { deleted: id }
})

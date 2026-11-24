import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'
import { PARTNER_EVENT } from '#shared/partnerParty'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** POST /api/admin/partner-rsvps/delete { id }: removes one partner RSVP (tests, mistakes). Admins only. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: unknown }>(event)
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!UUID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Missing or invalid RSVP id.' })

  const { data, error } = (await getSupabaseAdminClient()
    .from('partner_rsvps')
    .delete()
    .eq('event', PARTNER_EVENT)
    .eq('id', id)
    .select('id')) as { data: { id: string }[] | null; error: { message: string } | null }

  if (error) {
    logger.error('Partner party', 'RSVP delete failed', { id, error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not delete the RSVP.' })
  }
  if (!data?.length) throw createError({ statusCode: 404, statusMessage: 'That RSVP no longer exists.' })

  const admin = event.context.admin as { email?: string } | undefined
  logger.info('Partner party', 'RSVP deleted by admin', { id, admin: admin?.email ?? null })
  return { deleted: id }
})

import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'
import { PARTY_EVENT } from '#shared/party'

/**
 * POST /api/admin/party-rsvps/delete { staffCode }
 *
 * Removes one staff member's RSVP (test entries, mistakes). Admins only, via
 * adminGuard; the HR results link has no way to reach this. The staff member
 * can register again afterwards while the form is open.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ staffCode?: unknown }>(event)
  const staffCode = typeof body?.staffCode === 'string' ? body.staffCode.trim().toUpperCase() : ''
  if (!/^[A-Z]{2,4}\d{1,6}$/.test(staffCode)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid staff code.' })
  }

  const { data, error } = (await getSupabaseAdminClient()
    .from('party_rsvps')
    .delete()
    .eq('event', PARTY_EVENT)
    .eq('staff_code', staffCode)
    .select('staff_code')) as { data: { staff_code: string }[] | null; error: { message: string } | null }

  if (error) {
    logger.error('Party', 'RSVP delete failed', { staffCode, error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not delete the RSVP.' })
  }
  if (!data?.length) throw createError({ statusCode: 404, statusMessage: 'That RSVP no longer exists.' })

  const admin = event.context.admin as { email?: string } | undefined
  logger.info('Party', 'RSVP deleted by admin', { staffCode, admin: admin?.email ?? null })
  return { deleted: staffCode }
})

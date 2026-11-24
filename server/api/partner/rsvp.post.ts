import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { logger } from '../../utils/logger'
import { PARTNER_COLUMNS, type PartnerRsvpRow } from '../../utils/partnerRsvp'
import {
  PARTNER_CLOSES_LABEL,
  PARTNER_EVENT,
  parsePartnerRsvp,
  partnerKey,
  partnerRsvpClosed,
} from '#shared/partnerParty'

/**
 * POST /api/partner/rsvp { fullName, company, plusOne, arriveHour, leaveHour }
 *
 * Saves a dealer or partner RSVP. Sending the same name and company again
 * replaces the earlier answer. Write-only: nothing saved is ever read back to
 * the public, so typing someone else's name shows nothing about them.
 * Rate limited in 1.rate-limit.ts.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (partnerRsvpClosed()) {
    throw createError({ statusCode: 403, statusMessage: `Registration closed at ${PARTNER_CLOSES_LABEL}.` })
  }

  const parsed = parsePartnerRsvp(await readBody(event))
  if ('error' in parsed) throw createError({ statusCode: 400, statusMessage: parsed.error })
  const { rsvp } = parsed

  const { data, error } = (await getSupabaseAdminClient()
    .from('partner_rsvps')
    .upsert(
      {
        event: PARTNER_EVENT,
        full_name: rsvp.fullName,
        company: rsvp.company,
        name_key: partnerKey(rsvp.fullName),
        company_key: partnerKey(rsvp.company),
        plus_one: rsvp.plusOne,
        arrive_hour: rsvp.arriveHour,
        leave_hour: rsvp.leaveHour,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'event,name_key,company_key' },
    )
    .select(PARTNER_COLUMNS)
    .single()) as { data: PartnerRsvpRow | null; error: { message: string } | null }

  if (error || !data) {
    logger.error('Partner party', 'RSVP save failed', { error: error?.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not save your RSVP just now. Please try again.' })
  }

  logger.info('Partner party', 'RSVP saved', { id: data.id })
  return { firstName: rsvp.fullName.split(' ')[0] }
})

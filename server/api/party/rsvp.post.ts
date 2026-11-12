import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { RSVP_COLUMNS, rowToRsvp, verifyPartyStaff, type PartyRsvpRow } from '../../utils/partyRsvp'
import { logger } from '../../utils/logger'
import { PARTY, PARTY_EVENT, parsePartyRsvp, partyRsvpClosed } from '#shared/party'

/**
 * POST /api/party/rsvp { code, name, attending, adultGuests, children, arriveHour,
 * leaveHour, noveltyMatch, lane4Stay }
 *
 * Saves the staff member's RSVP. Sending it again replaces the earlier one.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (partyRsvpClosed()) {
    throw createError({
      statusCode: 403,
      statusMessage: `Registration closed at ${PARTY.closesLabel}. Answers can no longer be changed.`,
    })
  }
  const body = await readBody(event)
  const staff = await verifyPartyStaff(body)

  const parsed = parsePartyRsvp(body)
  if ('error' in parsed) throw createError({ statusCode: 400, statusMessage: parsed.error })
  const { rsvp } = parsed

  const { data, error } = (await getSupabaseAdminClient()
    .from('party_rsvps')
    .upsert(
      {
        event: PARTY_EVENT,
        staff_code: staff.code,
        attending: rsvp.attending,
        match_only: rsvp.matchOnly,
        adult_guests: rsvp.adultGuests,
        children: rsvp.children,
        arrive_hour: rsvp.arriveHour,
        leave_hour: rsvp.leaveHour,
        novelty_match: rsvp.noveltyMatch,
        lane4_stay: rsvp.lane4Stay,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'event,staff_code' },
    )
    .select(RSVP_COLUMNS)
    .single()) as { data: PartyRsvpRow | null; error: { message: string } | null }

  if (error || !data) {
    logger.error('Party', 'RSVP save failed', { code: staff.code, error: error?.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not save your RSVP just now. Please try again.' })
  }

  logger.info('Party', 'RSVP saved', { code: staff.code, attending: rsvp.attending })
  return { firstName: staff.firstName, rsvp: rowToRsvp(data) }
})

import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { RSVP_COLUMNS, guestLogId, identifyPartyGuest, rowToRsvp, type PartyRsvpRow } from '../../utils/partyRsvp'
import { logger } from '../../utils/logger'
import { PARTY, PARTY_EVENT, parsePartyRsvp, partyRsvpClosed } from '#shared/party'

/**
 * POST /api/party/rsvp { name, notOnBitrix?, attending, matchOnly, adultGuests, children, arriveHour,
 * leaveHour, noveltyMatch, lane4Stay }
 *
 * Saves the RSVP. Sending it again replaces the earlier one: by staff code for
 * Bitrix staff, by name for someone not on Bitrix.
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
  const guest = await identifyPartyGuest(body)

  const parsed = parsePartyRsvp(body)
  if ('error' in parsed) throw createError({ statusCode: 400, statusMessage: parsed.error })
  const { rsvp } = parsed

  const { data, error } = (await getSupabaseAdminClient()
    .from('party_rsvps')
    .upsert(
      {
        event: PARTY_EVENT,
        staff_code: guest.kind === 'staff' ? guest.code : null,
        full_name: guest.kind === 'unlisted' ? guest.fullName : null,
        name_key: guest.kind === 'unlisted' ? guest.nameKey : null,
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
      { onConflict: guest.kind === 'staff' ? 'event,staff_code' : 'event,name_key' },
    )
    .select(RSVP_COLUMNS)
    .single()) as { data: PartyRsvpRow | null; error: { message: string } | null }

  if (error || !data) {
    logger.error('Party', 'RSVP save failed', { who: guestLogId(guest), error: error?.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not save your RSVP just now. Please try again.' })
  }

  logger.info('Party', 'RSVP saved', { who: guestLogId(guest), attending: rsvp.attending })
  return { firstName: guest.firstName, onBitrix: guest.kind === 'staff', rsvp: rowToRsvp(data) }
})

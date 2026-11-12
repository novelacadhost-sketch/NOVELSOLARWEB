import { readPartyRsvp, rowToRsvp, verifyPartyStaff } from '../../utils/partyRsvp'

/**
 * POST /api/party/lookup { code, name }
 *
 * Step one of /party: checks the staff code against the name and returns the
 * RSVP already saved, if any, so the form opens filled in for a change.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const staff = await verifyPartyStaff(await readBody(event))
  const row = await readPartyRsvp(staff.code)
  return { firstName: staff.firstName, rsvp: row ? rowToRsvp(row) : null }
})

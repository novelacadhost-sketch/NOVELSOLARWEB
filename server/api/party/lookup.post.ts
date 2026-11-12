import { identifyPartyGuest, readPartyRsvp, rowToRsvp } from '../../utils/partyRsvp'

/**
 * POST /api/party/lookup { name, notOnBitrix? }
 *
 * Step one of /party: finds the person (Bitrix staff by name, or someone not on
 * Bitrix once they say so) and returns the RSVP already saved, if any, so the
 * form opens filled in for a change. A name not on the staff list is a 404 with
 * data.code NOT_ON_STAFF_LIST, which the page turns into the "not on Bitrix" offer.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const guest = await identifyPartyGuest(await readBody(event))
  const row = await readPartyRsvp(guest)
  return { firstName: guest.firstName, onBitrix: guest.kind === 'staff', rsvp: row ? rowToRsvp(row) : null }
})

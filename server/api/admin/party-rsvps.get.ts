import { listPartyRsvps } from '../../utils/partyRsvp'

/** GET /api/admin/party-rsvps: every RSVP for the party, with the staff member's name. */
export default defineEventHandler(async () => ({ rsvps: await listPartyRsvps() }))

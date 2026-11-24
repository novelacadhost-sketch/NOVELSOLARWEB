import { listPartnerRsvps } from '../../utils/partnerRsvp'

/** GET /api/admin/partner-rsvps: every dealer and partner RSVP for the party. Admins only, via adminGuard. */
export default defineEventHandler(async () => ({ rsvps: await listPartnerRsvps() }))

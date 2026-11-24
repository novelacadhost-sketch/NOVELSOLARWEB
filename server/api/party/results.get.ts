import { isPartyResultsKey, listPartyRsvps } from '../../utils/partyRsvp'
import { listPartnerRsvps } from '../../utils/partnerRsvp'

/**
 * GET /api/party/results, header `x-results-key: <secret>`
 *
 * HR's view of every RSVP, staff and partners (each from its own table), behind the secret in their link rather than a
 * login. The secret comes in a header, not the URL, so it stays out of server
 * logs. A wrong or missing key is a plain 404.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (!isPartyResultsKey(getHeader(event, 'x-results-key'))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const [rsvps, partners] = await Promise.all([listPartyRsvps(), listPartnerRsvps()])
  return { rsvps, partners }
})

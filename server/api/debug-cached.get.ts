// TEMPORARY diagnostic — does a cached event handler still see the
// Authorization header, in getKey and in the handler body?
import { resolveIsDealerFromEvent } from '../utils/dealerCheck'

export default defineCachedEventHandler(
  async (event) => {
    return {
      inHandler: {
        authHeaderPresent: Boolean(getHeader(event, 'authorization')),
        cookieHeaderPresent: Boolean(getHeader(event, 'cookie')),
        isDealer: await resolveIsDealerFromEvent(event),
      },
    }
  },
  {
    getKey: async (event) => {
      const auth = Boolean(getHeader(event, 'authorization'))
      const cookie = Boolean(getHeader(event, 'cookie'))
      const dealer = await resolveIsDealerFromEvent(event)
      // Key is deliberately unique per observation so nothing is ever served
      // from cache while we measure.
      return `debug-cached:${auth}:${cookie}:${dealer}:${Date.now()}`
    },
    maxAge: 1,
  },
)

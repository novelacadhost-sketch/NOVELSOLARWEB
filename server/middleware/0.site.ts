import { siteIdForHost } from '#shared/sites'

/**
 * Which storefront this request is for, on `event.context.siteId`.
 *
 * Middleware for the same reason as 0.bearer-auth.ts: `defineCachedEventHandler`
 * rebuilds the event without its raw headers, so the Host header is gone by the
 * time /api/inventory runs. The context survives.
 */
export default defineEventHandler((event) => {
  event.context.siteId = siteIdForHost(getRequestHost(event, { xForwardedHost: true }))
})

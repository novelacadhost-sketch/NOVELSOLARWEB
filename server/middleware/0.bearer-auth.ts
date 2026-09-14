import { resolveBearerUser } from '../utils/bearerAuth'

/**
 * Resolve an `Authorization: Bearer` session into `event.context.bearerUser`.
 *
 * This has to happen in middleware, not inside the route handler.
 * `defineCachedEventHandler` rebuilds the event before invoking the handler
 * and drops the raw headers — `getHeader(event, 'authorization')` and even
 * `cookie` both come back empty inside a cached handler. `event.context`
 * survives, which is why the cookie path kept working: @nuxtjs/supabase
 * resolves the user in its own middleware and leaves it on the context.
 *
 * So we do the same. Middleware runs on the original event, where the headers
 * are still intact.
 *
 * Numeric prefix `0.` orders this ahead of rate-limit and CSRF, so anything
 * downstream can rely on the context being populated.
 */
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return

  // Only pay for token verification when a Bearer token is actually present.
  // Browser traffic carries none, so this is a no-op on the common path.
  const header = getHeader(event, 'authorization') || ''
  if (header.slice(0, 7).toLowerCase() !== 'bearer ') return

  const user = await resolveBearerUser(event)
  if (user) {
    event.context.bearerUser = user
  }
})

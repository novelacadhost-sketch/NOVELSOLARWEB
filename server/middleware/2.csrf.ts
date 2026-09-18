import { randomUUID } from 'node:crypto'

export default defineEventHandler((event) => {
  // Only apply CSRF protection to explicit internal API routes
  if (!event.path.startsWith('/api/')) return

  // Exclude bitrix callbacks, webhooks, or open APIs that don't originate from a browser session
  if (
    event.path.startsWith('/api/bitrix/') ||
    event.path.includes('webhook') ||
    event.path.startsWith('/api/admin/trigger-sync')
  )
    return

  // Scheduled jobs. They run from GitHub Actions with a Bearer cron secret and
  // no cookie jar, so the token dance is impossible for them — and pointless:
  // CSRF defends ambient credentials a browser attaches on its own, and a
  // secret held deliberately by the caller is the opposite of ambient.
  //
  // A header check rather than another hardcoded path. The path above exempts
  // /api/admin/trigger-sync for EVERY caller; this exempts only a caller that
  // already holds the secret, which adminGuard then treats as admin anyway —
  // so it grants nothing that the secret did not already grant. New cron
  // endpoints are covered without editing this list, which is what the drain
  // needed: it was answering 403 here before ever reaching adminGuard.
  const { cronSecret } = useRuntimeConfig()
  if (cronSecret && getHeader(event, 'authorization') === `Bearer ${cronSecret}`) return

  const method = event.method.toUpperCase()

  if (method === 'GET' || method === 'HEAD') {
    // Distribute token on safe fetching methods
    let token = getCookie(event, 'csrf-token')
    if (!token) {
      token = randomUUID()
      setCookie(event, 'csrf-token', token, {
        httpOnly: false, // Explicitly false so the JS client-side fetch interceptor can read it
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      })
    }
  } else {
    // Native clients (the mobile app) authenticate with an Authorization
    // header and have no cookie jar. CSRF defends against a browser attaching
    // *ambient* credentials to a cross-site request — a Bearer token is never
    // ambient, the caller must hold it deliberately, so the attack CSRF
    // prevents cannot happen here. Requiring the token dance would only block
    // legitimate native clients.
    //
    // Deliberately narrow: this applies only when the request carries a
    // Bearer token AND no session cookie. A browser request keeps the full
    // check even if it also sets an Authorization header, so a cookie-bearing
    // victim is never exempted.
    // `0.bearer-auth.ts` has already verified the token against GoTrue, so
    // this is a genuine authenticated caller — not merely a well-formed
    // header, which anyone could send.
    const hasVerifiedBearer = Boolean(event.context.bearerUser)
    const hasSessionCookie = hasAmbientCredentials(event)
    if (hasVerifiedBearer && !hasSessionCookie) return

    // Guest lead capture from a native client: no cookie jar, no token, and
    // nothing to forge. CSRF protects a victim's *ambient* credentials, so a
    // request carrying none of them is not an attack it can prevent — the same
    // POST can be made directly with curl, and always could: a script need only
    // GET one page to be handed a csrf-token cookie and echo it back.
    //
    // Narrow on purpose. It applies to four lead-capture paths, and only when
    // the request has no credentials at all. /api/checkout is the reason for
    // that second condition: forcing a signed-in dealer's browser to place an
    // order IS a real CSRF target, so anything cookie-bearing keeps the full
    // check. Abuse is bounded by the stricter anonymous bucket in 1.rate-limit.
    if (ANONYMOUS_WRITE_PATHS.has(event.path.split('?')[0] ?? '') && !hasSessionCookie && !hasVerifiedBearer) {
      return
    }

    // Mutating requests must matching header and cookie to prevent forgery
    const headerToken = getHeader(event, 'x-csrf-token')
    const cookieToken = getCookie(event, 'csrf-token')

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Invalid or missing CSRF security token. Please refresh the page.',
      })
    }
  }
})

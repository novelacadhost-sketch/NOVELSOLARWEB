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
    const authHeader = getHeader(event, 'authorization') || ''
    const hasBearer = authHeader.slice(0, 7).toLowerCase() === 'bearer ' && authHeader.slice(7).trim().length > 0
    const hasSessionCookie = Boolean(
      getCookie(event, 'csrf-token') || getCookie(event, 'admin_token') || getCookie(event, 'auth_token'),
    )
    if (hasBearer && !hasSessionCookie) return

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

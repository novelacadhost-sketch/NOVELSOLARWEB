import type { H3Event } from 'h3'

/**
 * Does this request carry credentials a browser attaches on its own?
 *
 * This is the distinction CSRF actually turns on. A forged cross-site request
 * is dangerous because the browser supplies the victim's cookies without the
 * attacker ever seeing them. A request with no cookies has nothing to forge:
 * whatever it can do, the attacker can do directly with curl.
 *
 * `csrf-token` is the broadest signal — it is set on any GET, so a browser that
 * has loaded a single page of this site carries it, logged in or not. The
 * Supabase session cookie is matched by shape (`sb-<project-ref>-auth-token`)
 * because the project ref is part of the name and changes with the project.
 */
export function hasAmbientCredentials(event: H3Event): boolean {
  const cookies = parseCookies(event)

  for (const name of Object.keys(cookies)) {
    if (name === 'csrf-token' || name === 'admin_token') return true
    if (name.startsWith('sb-') && name.includes('auth-token')) return true
  }

  return false
}

/**
 * Endpoints a guest may POST to without a session of any kind.
 *
 * All five are lead capture: they create a CRM record from the body and act on
 * nobody's behalf. Requiring a CSRF token here blocked native clients — which
 * have no cookie jar — while stopping no attack, since an anonymous POST has no
 * ambient credentials to abuse.
 *
 * `/api/checkout` is on the list for guest orders, and is exactly why the
 * exemption checks for the ABSENCE of credentials rather than just allowing the
 * path: a signed-in dealer's browser being forced to place an order is a real
 * CSRF target, so a cookie-bearing request keeps the full check.
 */
export const ANONYMOUS_WRITE_PATHS = new Set([
  '/api/contact',
  '/api/quote',
  '/api/book-service',
  '/api/checkout',
  // A customer asking to be called about stock checkout could not fill. Same
  // shape as the enquiry forms: it creates a lead and acts on nobody's behalf.
  '/api/stock-request',
])

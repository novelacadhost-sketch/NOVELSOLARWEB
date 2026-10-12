import type { H3Event } from 'h3'

/**
 * The caller's IP, for rate limiting. Only headers the platform itself writes
 * are trusted.
 *
 * On Vercel, `x-vercel-forwarded-for`, `x-real-ip` and `x-forwarded-for` are
 * set by the edge and overwrite whatever the client sent. `cf-connecting-ip`
 * is NOT: there is no Cloudflare in front of this app, so that header arrived
 * straight from the client, and it used to be read first. Sending a fresh
 * value with every request gave each attempt its own rate-limit bucket, which
 * made every limit — admin login included — unlimited.
 *
 * If the app moves behind Cloudflare, or to a host whose proxy does not
 * overwrite these, revisit the order here before trusting it.
 */
export function getClientIp(event: H3Event): string {
  const header =
    getHeader(event, 'x-vercel-forwarded-for') || getHeader(event, 'x-real-ip') || getHeader(event, 'x-forwarded-for')
  const raw = header || event.node.req.socket.remoteAddress || ''
  return (
    raw
      .split(',')[0]!
      .trim()
      .replace(/^\[|\]$/g, '')
      .replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1') || 'unknown-ip'
  )
}

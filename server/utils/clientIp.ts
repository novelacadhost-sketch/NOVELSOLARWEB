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
 * Anywhere else (the Namecheap/LiteSpeed host) there is exactly one proxy, and
 * it appends the address it saw to `x-forwarded-for`. Only that last entry is
 * trustworthy; everything before it, and `x-real-ip`, came from the client.
 *
 * If the app moves behind Cloudflare, or gains a second proxy, revisit this
 * before trusting it.
 */
export function getClientIp(event: H3Event): string {
  const raw = process.env.VERCEL ? vercelClientIp(event) : proxiedClientIp(event)
  return (
    (raw || event.node.req.socket.remoteAddress || '')
      .trim()
      .replace(/^\[|\]$/g, '')
      .replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1') || 'unknown-ip'
  )
}

function vercelClientIp(event: H3Event): string | undefined {
  const header =
    getHeader(event, 'x-vercel-forwarded-for') || getHeader(event, 'x-real-ip') || getHeader(event, 'x-forwarded-for')
  return header?.split(',')[0]
}

function proxiedClientIp(event: H3Event): string | undefined {
  return getHeader(event, 'x-forwarded-for')?.split(',').pop()
}

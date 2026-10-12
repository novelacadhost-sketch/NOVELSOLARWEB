import type { H3Event } from 'h3'
import { getClientIp } from './clientIp'

interface RateLimitConfig {
  /** Maximum allowed attempts in the window */
  maxAttempts: number
  /** Window size in seconds */
  windowSeconds: number
  /** Storage key prefix */
  prefix: string
}

const defaults: RateLimitConfig = {
  maxAttempts: 5,
  windowSeconds: 900, // 15 minutes
  prefix: 'auth-rl',
}

/**
 * Per-endpoint rate limiter for auth-sensitive routes.
 * Keys by IP + endpoint so limits are independent per route.
 * Uses the same 'rateLimit' storage namespace as the global middleware
 * (memory in dev, Vercel KV in production).
 *
 * The endpoint is the path WITHOUT its query string — keying on the full URL
 * let `?1`, `?2`, … each start a fresh count — and the IP comes from the shared
 * getClientIp(), which ignores headers the client can set.
 *
 * Pass `account` (e.g. the email being tried) to also cap attempts on that one
 * account from any number of addresses. It is counted under its own key, so a
 * guesser spreading over many IPs still runs into it.
 */
export async function enforceAuthRateLimit(
  event: H3Event,
  opts?: Partial<RateLimitConfig> & { account?: string | null },
) {
  const config = { ...defaults, ...opts }
  const storage = useStorage('rateLimit')

  const endpoint = event.path.split('?')[0] || 'unknown'
  const window = Math.floor(Date.now() / 1000 / config.windowSeconds)
  const keys = [`${config.prefix}:${getClientIp(event)}:${endpoint}:${window}`]
  const account = opts?.account?.trim().toLowerCase()
  // Twice the per-IP allowance: a person mistyping from two devices is fine.
  if (account) keys.push(`${config.prefix}:acct:${account}:${endpoint}:${window}`)

  const counts = await Promise.all(keys.map(async (key) => (await storage.getItem<number>(key)) || 0))
  const limits = [config.maxAttempts, config.maxAttempts * 2]

  if (counts.some((count, i) => count >= limits[i]!)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts. Please try again later.',
    })
  }

  await Promise.all(keys.map((key, i) => storage.setItem(key, counts[i]! + 1, { ttl: config.windowSeconds })))
}

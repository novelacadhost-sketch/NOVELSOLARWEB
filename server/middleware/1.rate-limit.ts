import { getClientIp } from '../utils/clientIp'
import { isSignedCallbackPath } from '../utils/requestCredentials'

function getRateLimitConfig(path: string, isAnonymous: boolean) {
  if (path.startsWith('/api/admin/auth/')) return { maxRequests: 20, windowSizeInSeconds: 60, bucket: 'admin-auth' }
  if (path.startsWith('/api/auth/')) return { maxRequests: 20, windowSizeInSeconds: 60, bucket: 'auth' }
  if (['/api/checkout', '/api/contact', '/api/quote', '/api/book-service', '/api/stock-request'].includes(path)) {
    // Credential-less callers skip the CSRF check (see 2.csrf.ts) so that the
    // mobile app can take guest enquiries and guest orders. Nothing else stands
    // between them and the CRM, so they get a tighter budget than the website:
    // still far more than a person filling in a form, little use for flooding.
    if (isAnonymous) return { maxRequests: 10, windowSizeInSeconds: 60, bucket: 'lead-anon' }
    return { maxRequests: 30, windowSizeInSeconds: 60, bucket: 'lead' }
  }
  // Enough for someone typing a code and fixing a typo; too few to try codes
  // until one works.
  if (path === '/api/promo-code' || path === '/api/staff-code') {
    return { maxRequests: 15, windowSizeInSeconds: 60, bucket: 'promo-code' }
  }
  if (path.startsWith('/api/admin/')) return { maxRequests: 60, windowSizeInSeconds: 60, bucket: 'admin' }
  return { maxRequests: 100, windowSizeInSeconds: 60, bucket: 'api' }
}

export default defineEventHandler(async (event) => {
  // Only rate limit API routes and exclude internal or static paths
  if (!event.path.startsWith('/api/')) return

  if (isSignedCallbackPath(event)) return

  const storage = useStorage('rateLimit')

  const ip = getClientIp(event)

  // Query string stripped: the lead paths are matched exactly, and a stray `?`
  // would drop the caller into the default 100/min bucket.
  const path = event.path.split('?')[0] ?? event.path
  const isAnonymous = !event.context.bearerUser && !hasAmbientCredentials(event)
  const { maxRequests, windowSizeInSeconds, bucket } = getRateLimitConfig(path, isAnonymous)

  // The KV key for this IP's current window bucket
  const currentMinute = Math.floor(Date.now() / 1000 / windowSizeInSeconds)
  const key = `${bucket}:${ip}:${currentMinute}`

  let requestCount = (await storage.getItem<number>(key)) || 0

  if (requestCount >= maxRequests) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Temporarily blocked due to too many requests. Try again in a minute.',
    })
  }

  requestCount++
  await storage.setItem(key, requestCount, { ttl: windowSizeInSeconds })
})

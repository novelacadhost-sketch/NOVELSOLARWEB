import type { H3Event } from 'h3'
import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

/**
 * Resolve a Supabase user from an `Authorization: Bearer <access_token>` header.
 *
 * `serverSupabaseUser()` only reads the session from cookies, which is correct
 * for the browser but useless to a native mobile client — the Supabase mobile
 * SDKs hold tokens and send them as a Bearer header. Without this, a signed-in
 * dealer on mobile resolves as anonymous and is quietly served retail pricing.
 *
 * The token is verified by asking GoTrue to decode it (`auth.getUser(token)`),
 * never by trusting its contents. An expired, forged, or revoked token yields
 * null.
 */

export interface BearerUser {
  id: string
  email: string | null
}

const BEARER_PREFIX = 'bearer '

export function getBearerToken(event: H3Event): string | null {
  const header = getHeader(event, 'authorization') || ''
  // Plain slicing rather than a regex: `/^Bearer\s+(.+)$/` backtracks
  // polynomially on a crafted header (flagged by regexp/no-super-linear-backtracking).
  if (header.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX) return null
  const token = header.slice(BEARER_PREFIX.length).trim()
  if (!token) return null

  // The CRON secret also arrives as a Bearer token on /api/admin/* (see
  // adminGuard). It is not a JWT, so skip anything without the three-part
  // shape rather than sending it to GoTrue.
  if (token.split('.').length !== 3) return null

  return token
}

export async function resolveBearerUser(event: H3Event): Promise<BearerUser | null> {
  const token = getBearerToken(event)
  if (!token) return null

  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const anonKey = config.public.supabaseAnonKey as string
  if (!url || !anonKey) return null

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.getUser(token)

    if (error || !data?.user?.id) return null
    return { id: data.user.id, email: data.user.email ?? null }
  } catch (err) {
    logger.warn('BearerAuth', 'Token verification threw', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

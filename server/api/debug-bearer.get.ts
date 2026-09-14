// TEMPORARY diagnostic — remove once Bearer auth is confirmed working.
// Reports each step of the Bearer resolution path. Never echoes the token.
import { serverSupabaseUser } from '#supabase/server'
import { getBearerToken, resolveBearerUser } from '../utils/bearerAuth'
import { resolveIsDealerFromEvent } from '../utils/dealerCheck'
import { getAuthUserId } from '../utils/authUserId'

export default defineEventHandler(async (event) => {
  const out: Record<string, unknown> = {}
  const config = useRuntimeConfig()

  const auth = getHeader(event, 'authorization') || ''
  out.authHeaderPresent = auth.length > 0
  out.authHeaderPrefix = auth.slice(0, 7)

  const token = getBearerToken(event)
  out.tokenExtracted = !!token
  out.tokenSegments = token ? token.split('.').length : 0

  out.runtimeSupabaseUrlSet = !!config.public.supabaseUrl
  out.runtimeAnonKeySet = !!config.public.supabaseAnonKey
  out.anonKeyLooksJwt = String(config.public.supabaseAnonKey || '').split('.').length === 3

  try {
    const cookieUser = await serverSupabaseUser(event)
    out.cookieUserResolved = !!cookieUser
    out.cookieUserId = cookieUser ? getAuthUserId(cookieUser) : null
  } catch (e) {
    out.cookieUserStep = 'THREW: ' + (e instanceof Error ? e.message : String(e))
  }

  try {
    const bearerUser = await resolveBearerUser(event)
    out.bearerUserResolved = !!bearerUser
    out.bearerUserId = bearerUser?.id ?? null
    out.bearerUserEmail = bearerUser?.email ?? null
  } catch (e) {
    out.bearerStep = 'THREW: ' + (e instanceof Error ? e.message : String(e))
  }

  out.resolveIsDealerFromEvent = await resolveIsDealerFromEvent(event)
  return out
})

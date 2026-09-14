import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import { getAuthUserId } from './authUserId'
import { resolveBearerUser } from './bearerAuth'
import { logger } from './logger'

/**
 * Identify the caller, whether they authenticated by cookie (browser) or by
 * `Authorization: Bearer` (native mobile client). Returns null for anonymous.
 */
async function resolveUserId(event: H3Event): Promise<string | null> {
  // Cookie session first — this is the common path and costs no network call.
  try {
    const user = await serverSupabaseUser(event)
    if (user) {
      const id = getAuthUserId(user)
      if (id) return id
      logger.warn('DealerCheck', 'Cookie session has no resolvable id', { keys: Object.keys(user) })
    }
  } catch {
    // No cookie session; fall through to the Bearer path.
  }

  const bearer = await resolveBearerUser(event)
  return bearer?.id ?? null
}

export async function resolveIsDealerFromEvent(event: H3Event): Promise<boolean> {
  try {
    const userId = await resolveUserId(event)
    if (!userId) return false

    const supabase = await serverSupabaseServiceRole(event)
    const { data, error } = (await supabase
      .from('profiles')
      .select('role, dealer_status')
      .eq('user_id', userId)
      .single()) as { data: { role: string; dealer_status: string } | null; error: { message: string } | null }

    // PGRST116 = no rows, which is normal for a retail customer. Anything
    // else is a real fault and was previously swallowed in silence.
    if (error && !/no rows/i.test(error.message)) {
      logger.warn('DealerCheck', 'Profile lookup failed', { error: error.message })
      return false
    }

    return data?.role === 'dealer' && data?.dealer_status === 'approved'
  } catch (err) {
    logger.warn('DealerCheck', 'Dealer resolution threw', { error: err instanceof Error ? err.message : String(err) })
    return false
  }
}

import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import { getAuthUserId } from './authUserId'
import { logger } from './logger'

export async function resolveIsDealerFromEvent(event: H3Event): Promise<boolean> {
  try {
    const user = await serverSupabaseUser(event)
    if (!user) return false

    // The module returns JWT claims, where the id is `sub`, not `id`.
    const userId = getAuthUserId(user)
    if (!userId) {
      logger.warn('DealerCheck', 'Authenticated user has no resolvable id', { keys: Object.keys(user) })
      return false
    }

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

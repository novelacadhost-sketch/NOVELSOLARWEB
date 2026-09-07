// TEMPORARY diagnostic — remove after debugging dealer pricing.
// Reports what resolveIsDealerFromEvent() sees, step by step. No secrets.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { resolveIsDealerFromEvent } from '../utils/dealerCheck'

export default defineEventHandler(async (event) => {
  const out: Record<string, unknown> = {}

  out.cookieNames = (getHeader(event, 'cookie') || '')
    .split(';')
    .map((c) => c.split('=')[0]?.trim())
    .filter(Boolean)

  try {
    const user = await serverSupabaseUser(event)
    out.userResolved = !!user
    out.userId = user?.id ?? null
    out.userKeys = user ? Object.keys(user) : []
    out.userSub = (user as unknown as Record<string, unknown>)?.sub ?? null
    out.userEmail = user?.email ?? null

    if (user) {
      try {
        const supabase = await serverSupabaseServiceRole(event)
        out.serviceRoleClient = 'created'
        const { data, error } = await supabase
          .from('profiles')
          .select('role, dealer_status, user_id')
          .eq('user_id', user.id)
          .single()
        out.profileQueryError = error ? { message: error.message, code: error.code } : null
        out.profileRow = data ?? null
      } catch (e) {
        out.serviceRoleClient = 'THREW: ' + (e instanceof Error ? e.message : String(e))
      }
    }
  } catch (e) {
    out.userStep = 'THREW: ' + (e instanceof Error ? e.message : String(e))
  }

  try {
    out.resolveIsDealerFromEvent = await resolveIsDealerFromEvent(event)
  } catch (e) {
    out.resolveIsDealerFromEvent = 'THREW: ' + (e instanceof Error ? e.message : String(e))
  }

  return out
})

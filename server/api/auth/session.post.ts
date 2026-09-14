import { serverSupabaseUser } from '#supabase/server'
import { resolveBitrixContactId } from '../../utils/bitrixContact'
import { getAuthUserId } from '../../utils/authUserId'
import { logger } from '../../utils/logger'

/**
 * Called by /confirm once the magic-link exchange has produced a Supabase
 * session. It links the new user to their CRM contact and creates their
 * `profiles` row.
 *
 * This used to mint a second session (`auth_token` cookie + `user_sessions`
 * row) on top of the Supabase one. It no longer issues anything: Supabase
 * Auth is the session, and this endpoint only warms the contact link.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  const userId = getAuthUserId(user)

  if (!user || !userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized. No Supabase session found.',
    })
  }

  const email = user.email
  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User email not found in Supabase session.',
    })
  }

  try {
    await resolveBitrixContactId(userId, email)
    return { success: true, redirect: '/account' }
  } catch (error) {
    // The customer is already authenticated; a CRM outage must not block
    // them. /api/user/profile retries the link on the next request.
    logger.error('Auth Session', 'CRM contact link failed', {
      error: error instanceof Error ? error.message : error,
    })
    return { success: true, message: 'Signed in; CRM link pending', redirect: '/account' }
  }
})

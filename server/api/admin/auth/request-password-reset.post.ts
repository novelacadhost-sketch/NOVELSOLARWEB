import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string }>(event)
  await enforceAuthRateLimit(event, { account: body?.email })
  const config = useRuntimeConfig()

  if (!body?.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email is required.',
    })
  }

  if (!isValidEmail(body.email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide a valid email address.',
    })
  }

  const trimmedEmail = body.email.trim().toLowerCase()

  try {
    const supabase = getSupabaseAdminClient()
    const { data: usersData } = await supabase.auth.admin.listUsers()
    const authUser = usersData.users.find((user) => user.email?.toLowerCase() === trimmedEmail)

    if (authUser) {
      const { data: adminProfile } = await supabase
        .from('admin_profiles')
        .select('user_id')
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (adminProfile) {
        await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${config.public.baseUrl || 'http://localhost:3000'}/admin/reset-password`,
        })
      }
    }
  } catch (error) {
    logger.error('Admin Password Reset', 'Request failed', { error })
  }

  return {
    success: true,
    message: 'If that admin account exists, a password reset link has been sent.',
  }
})

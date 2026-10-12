import { createAdminSession } from '../../../utils/adminSession'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; password?: string }>(event)
  await enforceAuthRateLimit(event, { account: body?.email })
  const config = useRuntimeConfig()
  let authenticatedUserId: string | undefined
  let authenticatedEmail: string | null | undefined

  if (body?.email && body?.password) {
    if (!isValidEmail(body.email)) {
      throw createError({ statusCode: 400, statusMessage: 'Please provide a valid email address.' })
    }
    const supabaseUrl = config.public.supabaseUrl
    const supabaseAnonKey = config.public.supabaseAnonKey

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error('Admin Login', 'Supabase authentication environment variables are not configured')
      throw createError({ statusCode: 500, statusMessage: 'Server configuration error.' })
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        email: body.email.trim(),
        password: body.password,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw createError({
        statusCode: 401,
        statusMessage: error?.msg || error?.error_description || 'Invalid email or password.',
      })
    }

    const authPayload = await response.json().catch(() => null)
    authenticatedUserId = authPayload?.user?.id
    authenticatedEmail = authPayload?.user?.email || body.email.trim()

    if (!authenticatedUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password.',
      })
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', authenticatedUserId)
      .maybeSingle()

    if (adminProfileError || !adminProfile) {
      throw createError({
        statusCode: 403,
        statusMessage: 'This account does not have admin access.',
      })
    }
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required.' })
  }

  const session = await createAdminSession({
    userId: authenticatedUserId,
    email: authenticatedEmail,
  })

  setCookie(event, 'admin_token', session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: session.maxAge,
    path: '/',
  })

  return { success: true, message: 'Authentication successful.' }
})

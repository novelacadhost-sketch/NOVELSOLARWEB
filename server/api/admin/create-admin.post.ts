import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { logger } from '../../utils/logger'
import { findAuthUserByEmail } from '../../utils/authUsers'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ admin_email?: string; admin_username?: string }>(event)
  const currentUserId = event.context.admin?.user_id
  const config = useRuntimeConfig()

  if (!currentUserId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized.',
    })
  }

  if (!body?.admin_email || !body?.admin_username) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and username are required.',
    })
  }

  if (!isValidEmail(body.admin_email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide a valid email address.',
    })
  }

  const supabase = getSupabaseAdminClient()

  const { data: currentAdmin, error: currentAdminError } = await supabase
    .from('admin_profiles')
    .select('is_master')
    .eq('user_id', currentUserId)
    .single()

  if (currentAdminError || !currentAdmin?.is_master) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only master admins can create new admins.',
    })
  }

  const trimmedEmail = body.admin_email.trim().toLowerCase()
  const trimmedUsername = body.admin_username.trim()

  const existingUser = await findAuthUserByEmail(supabase, trimmedEmail)

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email already exists.',
    })
  }

  const { data: existingProfile } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('admin_username', trimmedUsername)
    .maybeSingle()

  if (existingProfile) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Username already exists.',
    })
  }

  const tempPassword = `Admin-${crypto.randomUUID().slice(0, 8)}!`

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: trimmedEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      admin_username: trimmedUsername,
    },
  })

  if (authError || !authData.user) {
    throw createError({
      statusCode: 400,
      statusMessage: authError?.message || 'Failed to create admin user.',
    })
  }

  const { error: profileError } = await supabase.from('admin_profiles').insert({
    user_id: authData.user.id,
    admin_username: trimmedUsername,
    is_master: false,
    created_by: currentUserId,
  })

  if (profileError) {
    // Logged because this used to fail with only a flat message: the real
    // cause is almost always a Postgres constraint (duplicate username, or a
    // user_id already in admin_profiles) and none of it reached the caller.
    logger.error('Create Admin', 'admin_profiles insert failed', {
      error: profileError.message,
      code: profileError.code,
    })
    await supabase.auth.admin.deleteUser(authData.user.id)
    throw createError({
      statusCode: 400,
      statusMessage: 'Failed to create admin profile.',
    })
  }

  // The auth.users trigger creates a customer profile for every new auth user.
  // An admin is a row in admin_profiles, not in profiles, and customers.get.ts
  // lists by role — so without this the new admin shows up as a customer.
  await supabase.from('profiles').delete().eq('user_id', authData.user.id)

  // generateLink() only RETURNS a link; it sends nothing. This used it and
  // then told the master admin a link had been sent, so no new admin ever got
  // one. resetPasswordForEmail() emails it through Supabase's SMTP (Brevo),
  // the same path as the admin "forgot password" screen.
  const redirectBaseUrl = String(config.public.baseUrl || 'http://localhost:3000').replace(/\/$/, '')
  const { error: linkError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo: `${redirectBaseUrl}/admin/reset-password`,
  })
  if (linkError) {
    logger.error('CREATE-ADMIN', 'Failed to send the password link', { error: linkError.message })
    return {
      success: true,
      linkSent: false,
      message: `Admin "${trimmedUsername}" was created, but the password email could not be sent. Ask them to use "Forgot password" on the admin login page.`,
    }
  }

  return {
    success: true,
    linkSent: true,
    message: `Admin "${trimmedUsername}" created. A link to set their password has been emailed to ${trimmedEmail}.`,
  }
})

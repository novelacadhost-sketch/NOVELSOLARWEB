import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { logger } from '../../utils/logger'

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

  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((user) => user.email?.toLowerCase() === trimmedEmail)

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

  const redirectBaseUrl = config.public.baseUrl || 'http://localhost:3000'
  await supabase.auth.admin
    .generateLink({
      type: 'recovery',
      email: trimmedEmail,
      options: {
        redirectTo: `${redirectBaseUrl}/admin/login`,
      },
    })
    .catch((error) => {
      logger.error('CREATE-ADMIN', 'Failed to generate recovery link', { error })
    })

  return {
    success: true,
    message: `Admin "${trimmedUsername}" created successfully. A password-reset link has been sent.`,
  }
})

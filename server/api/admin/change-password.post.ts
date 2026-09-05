import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ current_password?: string; new_password?: string }>(event)
  const currentUserId = event.context.admin?.user_id
  const currentEmail = event.context.admin?.email
  const config = useRuntimeConfig()

  if (!currentUserId || !currentEmail) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized.',
    })
  }

  if (!body?.current_password || !body?.new_password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Current password and new password are required.',
    })
  }

  if (body.new_password.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'New password must be at least 8 characters long.',
    })
  }

  const supabaseUrl = config.public.supabaseUrl
  const supabaseAnonKey = config.public.supabaseAnonKey

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server configuration error.',
    })
  }

  const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      email: currentEmail,
      password: body.current_password,
    }),
  })

  if (!verifyResponse.ok) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Current password is incorrect.',
    })
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(currentUserId, {
    password: body.new_password,
  })

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message || 'Failed to update password.',
    })
  }

  return {
    success: true,
    message: 'Password updated successfully.',
  }
})

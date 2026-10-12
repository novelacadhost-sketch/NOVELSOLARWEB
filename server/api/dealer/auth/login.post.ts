import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body
  // It had none: dealer passwords could be guessed as fast as Supabase answered.
  await enforceAuthRateLimit(event, { prefix: 'dealer-auth', account: typeof email === 'string' ? email : null })

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  // Use the server Supabase client (this handles setting the secure cookies natively)
  const supabase = await serverSupabaseClient(event)

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const userId = authData.user.id

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role, dealer_status')
    .eq('user_id', userId)
    .single()

  const profile = profileData as any

  // Validate that they are an approved dealer
  if (profileError || !profile || profile.role !== 'dealer' || profile.dealer_status !== 'approved') {
    // Revoke the session immediately
    await supabase.auth.signOut()

    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied: Retail accounts cannot access the wholesale portal.',
    })
  }

  return { success: true, message: 'Authentication successful' }
})

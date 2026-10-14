import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const currentUserId = event.context.admin?.user_id

  if (!currentUserId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized.',
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
      statusMessage: 'Only master admins can view admin accounts.',
    })
  }

  const { data: admins, error: adminsError } = await supabase
    .from('admin_profiles')
    .select('user_id, admin_username, is_master, created_at')
    .order('created_at', { ascending: false })

  if (adminsError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch admin list.',
    })
  }

  // By id, not by scanning listUsers(): that returns the first 50 users only,
  // so an admin beyond them showed as "unknown".
  type AdminRow = { user_id: string; admin_username: string; is_master: boolean; created_at: string }
  const adminsWithEmail = await Promise.all(
    ((admins ?? []) as AdminRow[]).map(async (admin) => {
      const { data } = await supabase.auth.admin.getUserById(admin.user_id)
      return { ...admin, email: data?.user?.email || 'unknown' }
    }),
  )

  return {
    success: true,
    isMasterAdmin: true,
    currentUserId,
    admins: adminsWithEmail,
  }
})

import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ target_user_id?: string }>(event)
  const currentUserId = event.context.admin?.user_id

  if (!currentUserId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized.',
    })
  }

  if (!body?.target_user_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Target user ID is required.',
    })
  }

  if (body.target_user_id === currentUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot delete your own account.',
    })
  }

  const supabase = getSupabaseAdminClient()

  // Verify the requesting admin is a master admin
  const { data: currentAdmin, error: currentAdminError } = await supabase
    .from('admin_profiles')
    .select('is_master')
    .eq('user_id', currentUserId)
    .single()

  if (currentAdminError || !currentAdmin?.is_master) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only master admins can delete admin accounts.',
    })
  }

  // Verify the target admin exists
  const { data: targetAdmin, error: targetAdminError } = await supabase
    .from('admin_profiles')
    .select('admin_username, is_master')
    .eq('user_id', body.target_user_id)
    .single()

  if (targetAdminError || !targetAdmin) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Admin account not found.',
    })
  }

  // One master admin could otherwise delete every other, leaving no one able
  // to manage admins if that account were then lost or compromised. Demoting a
  // master is a deliberate database change, not a button.
  if (targetAdmin.is_master) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Master admin accounts cannot be deleted here.',
    })
  }

  // Sign them out everywhere first: a session row outlives the account, and
  // adminGuard only checks the session.
  await supabase.from('admin_sessions').delete().eq('user_id', body.target_user_id)

  // Delete from admin_profiles first
  const { error: profileDeleteError } = await supabase
    .from('admin_profiles')
    .delete()
    .eq('user_id', body.target_user_id)

  if (profileDeleteError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to remove admin profile.',
    })
  }

  // Delete from Supabase Auth
  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(body.target_user_id)

  if (authDeleteError) {
    logger.error('DELETE-ADMIN', 'Auth delete failed after profile delete', { error: authDeleteError })
    // Profile is gone but auth user remains — still return success since access is revoked
  }

  logger.info('DELETE-ADMIN', 'Admin deleted', {
    username: targetAdmin.admin_username,
    targetUserId: body.target_user_id,
    deletedBy: currentUserId,
  })

  return {
    success: true,
    message: `Admin "${targetAdmin.admin_username}" has been removed successfully.`,
  }
})

import { getAdminSession } from '../utils/adminSession'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)

  // Only protect routes that start with /api/admin/
  // Exclude auth routes (like login) so people can actually authenticate
  if (url.pathname.startsWith('/api/admin/') && !url.pathname.startsWith('/api/admin/auth/')) {
    const token = getCookie(event, 'admin_token')
    const session = await getAdminSession(token)

    if (!session) {
      const config = useRuntimeConfig()
      const authHeader = getHeader(event, 'authorization') || ''
      const isCronRequest = config.cronSecret && authHeader === `Bearer ${config.cronSecret}`

      if (isCronRequest) {
        event.context.admin = {
          user_id: 'cron',
          email: 'cron@system',
        }
        return
      }

      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized. An admin session is required to perform this action.',
      })
    }

    event.context.admin = {
      user_id: session.userId,
      email: session.email,
    }
  }
})

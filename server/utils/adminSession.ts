import { createHash } from 'node:crypto'
import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 // 24 hours

/**
 * The cookie carries the token; the table stores only its SHA-256, so a leaked
 * copy of admin_sessions (a backup, a log, a stray SELECT) cannot be replayed
 * as a live admin login. Rows written before this change hold the raw token,
 * never match, and lapse within 24 hours: admins sign in once more.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

interface AdminSessionRecord {
  userId?: string
  email?: string | null
  createdAt: number
  expiresAt: number
}

export async function createAdminSession(user?: { userId?: string; email?: string | null }) {
  const token = `admin_session_${globalThis.crypto.randomUUID()}`
  const createdAt = Date.now()
  const expiresAt = createdAt + ADMIN_SESSION_MAX_AGE_SECONDS * 1000

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from('admin_sessions').insert({
    token: hashToken(token),
    user_id: user?.userId ?? null,
    email: user?.email ?? null,
    created_at: createdAt,
    expires_at: expiresAt,
  })

  if (error) {
    logger.error('AUTH', 'Admin session storage failed', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Failed to create admin session.' })
  }

  return { token, maxAge: ADMIN_SESSION_MAX_AGE_SECONDS }
}

export async function getAdminSession(token?: string | null): Promise<AdminSessionRecord | null> {
  if (!token) return null

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('user_id, email, created_at, expires_at')
      .eq('token', hashToken(token))
      .maybeSingle()

    if (error) {
      logger.error('AUTH', 'Admin session read failed', { error: error.message })
      return null
    }

    if (!data) return null

    if (Date.now() > data.expires_at) {
      supabase
        .from('admin_sessions')
        .delete()
        .eq('token', hashToken(token))
        .then(() => {})
      return null
    }

    return {
      userId: data.user_id ?? undefined,
      email: data.email ?? null,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    }
  } catch (storageError: any) {
    logger.error('AUTH', 'Admin session read failed', { error: storageError?.message || storageError })
    return null
  }
}

export async function validateAdminSession(token?: string | null) {
  const session = await getAdminSession(token)
  return !!session
}

export async function destroyAdminSession(token?: string | null) {
  if (!token) return

  try {
    const supabase = getSupabaseAdminClient()
    await supabase.from('admin_sessions').delete().eq('token', hashToken(token))
  } catch (storageError: any) {
    logger.error('AUTH', 'Admin session destroy failed', { error: storageError?.message || storageError })
  }
}

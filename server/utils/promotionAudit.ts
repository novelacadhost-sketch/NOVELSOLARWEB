import type { H3Event } from 'h3'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { logger } from './logger'

/**
 * Record who changed the promotion, a rate or a code. Any admin can change
 * these, so the history is the only way to answer "who turned it off?".
 *
 * Never throws: the change itself has already been saved, and failing the
 * request now would tell the admin it did not happen.
 */
export async function logPromotionChange(event: H3Event, action: string, details: Record<string, unknown>): Promise<void> {
  const admin = event.context.admin as { user_id?: string; email?: string } | undefined
  const row = {
    admin_user_id: admin?.user_id ?? null,
    admin_email: admin?.email ?? null,
    action,
    details,
  }
  const { error } = await getSupabaseAdminClient().from('promotion_changes').insert(row as never)
  if (error) {
    logger.warn('Promotions', 'Could not record change history', { error: error.message, action })
  }
}

/** The admin's uuid for `updated_by` columns. The cron caller is not one. */
export function adminUuid(event: H3Event): string | null {
  const id = (event.context.admin as { user_id?: string } | undefined)?.user_id
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null
}

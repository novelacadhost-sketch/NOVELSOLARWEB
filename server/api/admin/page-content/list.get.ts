import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'

/**
 * Every block for a page, including inactive ones.
 *
 * Deliberately not `getPageContent()` from server/utils/siteContent.ts: that
 * one filters to active rows and swallows errors so the public site degrades
 * quietly. In the admin both behaviours are wrong — a hidden slide must still
 * be listed so it can be re-enabled, and a failed read must say so rather than
 * look like an empty page the admin is about to overwrite.
 */
export default defineEventHandler(async (event) => {
  const page = String(getQuery(event).page ?? '').trim()
  if (!page) {
    throw createError({ statusCode: 400, statusMessage: 'A page is required.' })
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('site_content')
    .select('id, page, slot, sort, image_url, alt, eyebrow, title, description, caption, link, active, updated_at')
    .eq('page', page)
    .order('slot')
    .order('sort')

  if (error) {
    logger.error('PageContent', 'Admin list failed', { page, error: error.message })
    throw createError({ statusCode: 500, statusMessage: `Could not read page content: ${error.message}` })
  }

  const slots: Record<string, unknown[]> = {}
  for (const row of (data ?? []) as { slot: string }[]) {
    ;(slots[row.slot] ??= []).push(row)
  }

  return { success: true, page, slots }
})

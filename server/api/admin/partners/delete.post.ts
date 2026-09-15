import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'

/**
 * Remove an admin-built partner and the page content that belongs to it.
 *
 * The site_content rows go too: leaving them would orphan a gallery that
 * silently reappears if the same slug is ever reused.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ slug?: string }>(event)
  const slug = String(body?.slug ?? '').trim().toLowerCase()

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'A slug is required.' })
  }

  try {
    const supabase = getSupabaseAdminClient()

    const { error } = await supabase.from('partners').delete().eq('slug', slug)
    if (error) throw error

    const { error: contentError } = await supabase.from('site_content').delete().eq('page', `partners/${slug}`)
    if (contentError) throw contentError

    logger.info('Partners', 'Deleted', { slug })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Partners', 'Delete failed', { slug, error: message })
    throw createError({ statusCode: 500, statusMessage: `Could not delete the partner: ${message}` })
  }
})

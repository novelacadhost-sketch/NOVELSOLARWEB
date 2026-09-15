import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'

/** Every admin-built partner, active or not, so a draft can be finished later. */
export default defineEventHandler(async () => {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('partners')
    .select('slug, name, tagline, description, logo_url, hero_url, accent_color, website_url, active, sort, updated_at')
    .order('sort')
    .order('name')

  if (error) {
    logger.error('Partners', 'List failed', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: `Could not list partners: ${error.message}` })
  }

  return { success: true, partners: data ?? [] }
})

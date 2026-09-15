import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { getPageContent, groupBySlot } from '../../utils/siteContent'
import { logger } from '../../utils/logger'

/**
 * One admin-created partner, plus its gallery content.
 *
 * Only returns active partners: a page being prepared should 404 rather than be
 * reachable by guessing the slug. The admin screen reads the table directly.
 */
export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'slug') ?? '')
    .trim()
    .toLowerCase()

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'A partner slug is required.' })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('partners')
      .select('slug, name, tagline, description, logo_url, hero_url, accent_color, website_url')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      throw createError({ statusCode: 404, statusMessage: 'Partner not found' })
    }

    const slots = groupBySlot(await getPageContent(`partners/${slug}`))
    return { partner: data, slots }
  } catch (err) {
    const e = err as { statusCode?: number; message?: string }
    if (e.statusCode === 404) throw err
    logger.error('Partner', 'Lookup failed', { slug, error: e.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load this partner.' })
  }
})

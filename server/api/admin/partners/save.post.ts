import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'

/**
 * Create or update an admin-built partner.
 *
 * The slug is the URL segment and the primary key, so it is validated to the
 * same shape the database CHECK enforces and is never derived silently from the
 * name — a partner called "Acme & Co." would otherwise produce a slug nobody
 * can predict or link to.
 *
 * Slugs that already have a hand-built component are rejected. Creating one
 * would produce a row that never renders, because partners/[brand]/index.vue
 * prefers the component — a confusing dead end rather than an error.
 */

const CUSTOM_COMPONENT_SLUGS = new Set(['itel', 'haisic', 'yinergy', 'livoltek', 'hithium'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface SaveBody {
  slug?: string
  name?: string
  tagline?: string
  description?: string
  logo_url?: string
  hero_url?: string
  accent_color?: string
  website_url?: string
  active?: boolean
  sort?: number
}

const str = (v: unknown, max: number) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SaveBody>(event)

  const slug = (str(body?.slug, 60) ?? '').toLowerCase()
  const name = str(body?.name, 120)

  if (!slug || !SLUG_RE.test(slug) || slug.length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The web address must be lowercase letters, numbers and hyphens — for example "sunking".',
    })
  }
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'A partner name is required.' })
  }
  if (CUSTOM_COMPONENT_SLUGS.has(slug)) {
    throw createError({
      statusCode: 409,
      statusMessage: `"${slug}" already has a custom-built page, which would override anything set here. Pick another address.`,
    })
  }

  const accent = str(body?.accent_color, 20)
  if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) {
    throw createError({ statusCode: 400, statusMessage: 'The colour must be a hex value like #0044cc.' })
  }

  const website = str(body?.website_url, 500)
  if (website && !/^https?:\/\//i.test(website)) {
    throw createError({ statusCode: 400, statusMessage: 'The website must start with http:// or https://' })
  }

  const row = {
    slug,
    name,
    tagline: str(body?.tagline, 300),
    description: str(body?.description, 5000),
    logo_url: str(body?.logo_url, 2000),
    hero_url: str(body?.hero_url, 2000),
    accent_color: accent,
    website_url: website,
    active: body?.active === true,
    sort: Number.isFinite(body?.sort) ? Number(body?.sort) : 0,
    updated_at: new Date().toISOString(),
    updated_by: event.context.admin?.user_id ?? null,
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { error } = await supabase.from('partners').upsert(row as never, { onConflict: 'slug' })
    if (error) throw error

    logger.info('Partners', 'Saved', { slug, active: row.active })
    return { success: true, slug }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Partners', 'Save failed', { slug, error: message })
    throw createError({ statusCode: 500, statusMessage: `Could not save the partner: ${message}` })
  }
})

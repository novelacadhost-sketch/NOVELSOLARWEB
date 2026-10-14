import { siteSellsSection } from '#shared/sites'
import { CATEGORY_GROUPS, EXCLUDED_SECTIONS, HOMES_CATEGORY_GROUPS } from '#shared/productCategories'
import { getSupabaseAdminClient } from '../utils/supabaseAdmin'
import { getHiddenProductIds } from '../utils/productVisibility'
import { getSite, siteUrlFor } from '../utils/site'
import { logger } from '../utils/logger'

/**
 * One sitemap per storefront, chosen by hostname like everything else.
 *
 * Replaces @nuxtjs/sitemap, which is configured for a single site URL and
 * listed only the static pages it could find, so no product was ever in it.
 */

const SOLAR_PAGES = [
  '/',
  '/shop',
  '/about',
  '/contact',
  '/quote',
  '/calculator',
  '/faq',
  '/branch-outlets',
  '/careers',
  '/blog',
  '/partners',
  '/partners/itel',
  '/partners/haisic',
  '/partners/yinergy',
  '/partners/hithium',
  '/partners/livoltek',
  '/partners/become-a-dealer',
  '/partners/become-a-partner',
  '/services/audit',
  '/services/installation',
  '/services/repair',
  '/services/maintenance',
]
const HOMES_PAGES = ['/', '/shop']
const LEGAL_PAGES = ['/privacy', '/terms', '/returns', '/delivery']

interface ProductRow {
  id: string
  section_name: string | null
}

async function productIds(sellable: (section: string | null) => boolean): Promise<ProductRow[]> {
  const supabase = getSupabaseAdminClient()
  const rows: ProductRow[] = []
  // Paged: PostgREST caps a response at 1000 rows.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('products')
      .select('id, section_name')
      .eq('active', true)
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    const page = (data ?? []) as ProductRow[]
    rows.push(...page)
    if (page.length < 1000) break
  }
  const hidden = await getHiddenProductIds()
  const excluded = new Set(EXCLUDED_SECTIONS.map((s) => s.toLowerCase()))
  return rows.filter(
    (r) =>
      !hidden.has(String(r.id)) &&
      !excluded.has(String(r.section_name ?? '').toLowerCase()) &&
      sellable(r.section_name),
  )
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default defineEventHandler(async (event) => {
  const site = getSite(event)
  const origin = siteUrlFor(event)
  const urls: { loc: string; lastmod?: string }[] = []
  const add = (path: string, lastmod?: string | null) =>
    urls.push({ loc: `${origin}${path}`, lastmod: lastmod ? lastmod.slice(0, 10) : undefined })

  for (const path of site.id === 'homes' ? HOMES_PAGES : SOLAR_PAGES) add(path)
  for (const path of LEGAL_PAGES) add(path)
  for (const group of site.id === 'homes' ? HOMES_CATEGORY_GROUPS : CATEGORY_GROUPS) add(`/category/${group.id}`)

  try {
    for (const product of await productIds((section) => siteSellsSection(site, section))) {
      // No lastmod: the mirror only has synced_at, which changes for every row nightly.
      add(`/shop/${product.id}`)
    }
  } catch (error) {
    // A sitemap without products is still a valid sitemap.
    logger.warn('Sitemap', 'Products left out', { error: error instanceof Error ? error.message : String(error) })
  }

  if (site.id === 'solar') {
    // Read the post files from Nuxt Content's storage rather than through
    // #content/server: importing that pulls the whole app (layouts included)
    // into the server's type check and broke it.
    try {
      const storage = useStorage('content:source')
      // Keys carry the source name first (content:blog:post.md), so filter
      // rather than asking for a 'blog' prefix.
      for (const key of (await storage.getKeys()).filter((k) => /(?:^|:)blog:[^:]+\.md$/.test(k))) {
        const file = key.split(':').pop() ?? ''
        if (!file.endsWith('.md')) continue
        const raw = String((await storage.getItem(key)) ?? '')
        if (/^draft:\s*true\b/m.test(raw)) continue
        const date = raw.match(/^date:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1]
        add(`/blog/${file.slice(0, -3)}`, date)
      }
    } catch (error) {
      logger.warn('Sitemap', 'Blog posts left out', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  const body = urls
    .map((u) => `<url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('')

  setHeaders(event, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  })
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
})

import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'

/**
 * Reads editable page content.
 *
 * The contract every caller depends on: **this never throws and never returns
 * a partial page.** If the table is empty, the query fails, or Supabase is
 * unreachable, it returns an empty list and the page falls back to the literal
 * still present in its .vue file. A CMS outage must not blank the homepage.
 */

export interface SiteContentRow {
  id: string
  slot: string
  sort: number
  image_url: string | null
  alt: string | null
  eyebrow: string | null
  title: string | null
  description: string | null
  caption: string | null
  link: string | null
  active: boolean
}

const SELECT = 'id, slot, sort, image_url, alt, eyebrow, title, description, caption, link, active'

export async function getPageContent(page: string): Promise<SiteContentRow[]> {
  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('site_content')
      .select(SELECT)
      .eq('page', page)
      .eq('active', true)
      .order('slot')
      .order('sort')

    if (error) {
      // Warn, not error: a missing table before the migration runs is expected,
      // and the page is still correct — it just uses its built-in content.
      logger.warn('SiteContent', 'Page content unavailable; falling back to built-in content', {
        page,
        error: error.message,
      })
      return []
    }

    return (data ?? []) as unknown as SiteContentRow[]
  } catch (err) {
    logger.warn('SiteContent', 'Page content lookup threw; falling back to built-in content', {
      page,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

/** Group flat rows into `{ slot: rows[] }`, each slot already in sort order. */
export function groupBySlot(rows: SiteContentRow[]): Record<string, SiteContentRow[]> {
  const out: Record<string, SiteContentRow[]> = {}
  for (const row of rows) {
    ;(out[row.slot] ??= []).push(row)
  }
  return out
}

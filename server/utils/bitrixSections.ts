import { bitrixFetch } from './bitrixAuth'
import { logger } from './logger'

/**
 * The Bitrix product sections — the catalogue's real categories.
 *
 * 26 of them, and 1153 of 1154 active products belong to one, so this is a
 * maintained taxonomy rather than an aspiration. The site used to infer the
 * category from the product name instead; see the migration for why that was
 * wrong by construction.
 */

export interface ProductSection {
  id: string
  name: string
}

interface BitrixSection {
  ID?: string | number
  NAME?: string
}

// Small and slow-changing, so one fetch serves a whole sync rather than 24 pages
// of product requests each re-fetching the same 26 rows. Short enough that a
// section renamed in Bitrix appears on the next sync.
const CACHE_TTL_MS = 5 * 60 * 1000
let cache: { at: number; sections: ProductSection[] } | null = null

export async function fetchProductSections(force = false): Promise<ProductSection[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.sections

  const response = await bitrixFetch<{ result?: BitrixSection[] }>('crm.productsection.list', {
    query: { 'select[]': ['ID', 'NAME'] },
  })

  const sections = (response.result ?? [])
    .filter((s) => s.ID != null && s.NAME)
    .map((s) => ({ id: String(s.ID), name: String(s.NAME).trim() }))

  cache = { at: Date.now(), sections }
  return sections
}

/**
 * id -> name, for stamping onto products during a sync.
 *
 * Never throws: a section lookup that fails must not fail the whole product
 * sync. Products then carry section_id with a null section_name, which the
 * category endpoint can still group by, and the next sync fills the names in.
 */
export async function getSectionMap(): Promise<Map<string, string>> {
  try {
    const sections = await fetchProductSections()
    return new Map(sections.map((s) => [s.id, s.name]))
  } catch (error) {
    logger.warn('BitrixSections', 'Could not read product sections; products will sync without names', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Map()
  }
}

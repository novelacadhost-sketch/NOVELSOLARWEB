import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'

/**
 * Which products the admin has hidden from the website.
 *
 * Hiding is a site-only decision — Bitrix is never told, so the product stays
 * active in the CRM for sales, quotes and the catalogue. That is the whole
 * point of this table; see the migration for why the previous behaviour was a
 * problem.
 */

// Hidden products are a handful of rows that change rarely, so this is cached.
// The window is short because the person who just hid something is about to go
// and check the shop.
const CACHE_TTL_MS = 10_000
let cache: { at: number; ids: Set<string>; version: string } | null = null

async function load(): Promise<{ ids: Set<string>; version: string }> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('product_visibility')
    .select('product_id, updated_at')
    .eq('hidden', true)

  if (error) throw error

  const rows = (data ?? []) as { product_id: string; updated_at: string }[]
  const ids = new Set(rows.map((r) => String(r.product_id)))
  // Changes whenever a product is hidden or unhidden, so it can key a cache.
  const latest = rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), '')
  const version = `${ids.size}:${latest}`

  cache = { at: Date.now(), ids, version }
  return cache
}

/**
 * Never throws. A failed lookup hides nothing rather than hiding everything —
 * showing a product that should be hidden is a smaller problem than an empty
 * shop, and the alternative fails in the direction nobody would notice until a
 * customer did.
 */
export async function getHiddenProductIds(): Promise<Set<string>> {
  try {
    return (await load()).ids
  } catch (error) {
    logger.warn('ProductVisibility', 'Hidden-product lookup failed; showing everything', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Set()
  }
}

/**
 * A short string that changes whenever visibility changes.
 *
 * Used in the /api/inventory cache key. Without it a product stays visible for
 * the five-minute cache window after being hidden, and "I hid it and it is
 * still there" is the first thing anyone would report.
 */
export async function getVisibilityVersion(): Promise<string> {
  try {
    return (await load()).version
  } catch {
    return 'na'
  }
}

export async function setProductHidden(productId: string, hidden: boolean, adminUserId?: string | null) {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from('product_visibility').upsert(
    {
      product_id: String(productId),
      hidden,
      updated_at: new Date().toISOString(),
      updated_by: adminUserId ?? null,
    } as never,
    { onConflict: 'product_id' },
  )
  if (error) throw error

  // The admin is about to look at the shop; do not make them wait out the TTL.
  cache = null
}

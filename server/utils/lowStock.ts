import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'

/**
 * Which products to flag "low stock — order soon".
 *
 * The site shows the flag, never the number: the count stays internal. Read
 * from products.quantity in the mirror, the company-wide total that the sync
 * fills nightly from the Bitrix catalog, because the Bitrix calls the product
 * pages use carry no stock at all.
 *
 * THE THRESHOLD IS THE WHOLE POLICY. At 10, measured 2026-09-23, 540 of the
 * 1102 products with stock qualify — about half the catalogue, much of it
 * items that are simply stocked in small numbers. Lower it here if the badge
 * turns out to be on too much to mean anything (under 5 was 397, under 3 was
 * 266).
 *
 * Zero is not "low": nothing active is at zero today, and a product that runs
 * out is refused at checkout with an offer to call the customer back.
 */
export const LOW_STOCK_THRESHOLD = 10

/** For a caller that already has the row's quantity in hand. */
export function isLowStock(quantity: number | null | undefined): boolean {
  return typeof quantity === 'number' && quantity > 0 && quantity < LOW_STOCK_THRESHOLD
}

// A few hundred ids that change nightly; no reason to ask per request.
const CACHE_TTL_MS = 60_000
let cache: { at: number; ids: Set<string> } | null = null

/** PostgREST caps a response at 1000 rows whatever range is asked for. */
const PAGE = 1000

/**
 * Never throws. A failed lookup flags nothing: a missing badge costs nothing,
 * and a wrong one would tell customers something false.
 */
export async function getLowStockIds(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.ids

  try {
    const supabase = getSupabaseAdminClient()
    const ids = new Set<string>()

    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .gt('quantity', 0)
        .lt('quantity', LOW_STOCK_THRESHOLD)
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw error

      const rows = (data ?? []) as { id: string }[]
      for (const row of rows) ids.add(String(row.id))
      if (rows.length < PAGE) break
    }

    cache = { at: Date.now(), ids }
    return ids
  } catch (error) {
    logger.warn('LowStock', 'Low-stock lookup failed; no product flagged', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Set()
  }
}

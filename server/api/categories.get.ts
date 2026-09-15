import { getSupabaseAdminClient } from '../utils/supabaseAdmin'
import { logger } from '../utils/logger'

/**
 * The shoppable product categories, with how many products each holds.
 *
 * Read from the mirror rather than Bitrix: these must agree with what the shop
 * can actually list, and the mirror is what the listing pages read on the
 * fallback path. A category with no active product simply is not returned.
 *
 * Returns an empty list rather than an error when the lookup fails — a broken
 * category strip should not take the shop page down with it.
 */

export interface ProductCategory {
  id: string
  name: string | null
  productCount: number
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('product_categories')
      .select('id, name, product_count')
      .order('name')

    if (error) throw error

    const categories: ProductCategory[] = ((data ?? []) as { id: string; name: string | null; product_count: number }[])
      .map((row) => ({ id: String(row.id), name: row.name, productCount: Number(row.product_count) || 0 }))
      .filter((c) => c.productCount > 0)

    return { categories }
  } catch (error) {
    logger.warn('Categories', 'Category lookup failed; returning an empty list', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { categories: [] as ProductCategory[] }
  }
})

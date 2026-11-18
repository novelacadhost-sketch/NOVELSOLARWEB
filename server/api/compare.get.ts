import { logger } from '../utils/logger'
import { getSupabaseAdminClient } from '../utils/supabaseAdmin'
import { resolveIsDealerFromEvent } from '../utils/dealerCheck'
import { fetchAllBitrixProducts } from '../utils/fetchAllBitrixProducts'
import type { BitrixProduct } from '../utils/normalizeBitrixProduct'
import { getSectionMap } from '../utils/bitrixSections'
import { getHiddenProductIds } from '../utils/productVisibility'
import { getLowStockIds } from '../utils/lowStock'
import { parseSpecs } from '../utils/productFields'
import { getSite } from '../utils/site'
import { categoryGroupsFor, groupIdForSection } from '#shared/productCategories'
import { siteSellsSection } from '#shared/sites'

/**
 * Side-by-side comparison for the product page's Compare popup.
 *
 * GET /api/compare?ids=<current>,<other>,<other> — the first id is the product
 * being viewed. The others are kept only if they sit in the same shop category
 * (CATEGORY_GROUPS, not the raw Bitrix section), so "Batteries" compares with
 * "Battery Charger" but never with an inverter, whatever the URL asks for.
 *
 * Spec rows are lined up by label here, so the popup only renders a table.
 */

const MAX_PRODUCTS = 3

interface MirrorRow {
  id: string
  image_url: string | null
  section_name: string | null
  active: boolean | null
  dealer_price: unknown
  raw: BitrixProduct | null
}

export interface CompareProduct {
  id: string
  name: string
  price: number
  dealerPrice: number | null
  lowStock: boolean
  // The fields useProductImage() reads, so the picture is chosen the same way as everywhere else.
  imageUrl: string | null
  PROPERTY_102: unknown
  PROPERTY_44: unknown
  DETAIL_PICTURE: unknown
  PREVIEW_PICTURE: unknown
}

export interface CompareRow {
  label: string
  /** One per product, in product order. Null where that product has no such spec. */
  values: (string | null)[]
}

const labelKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const ids = [
    ...new Set(
      String(getQuery(event).ids ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^\d{1,10}$/.test(id)),
    ),
  ].slice(0, MAX_PRODUCTS)
  if (!ids.length) throw createError({ statusCode: 400, statusMessage: 'No products to compare' })

  const site = getSite(event)
  const isDealer = await resolveIsDealerFromEvent(event)
  const [hidden, lowStock, sectionNames] = await Promise.all([
    getHiddenProductIds(),
    getLowStockIds(),
    getSectionMap(),
  ])

  // The catalogue copy the shop already holds; the mirror when Bitrix is down.
  const found = new Map<string, { product: BitrixProduct; sectionName: string | null }>()
  const mirrorImages = new Map<string, string>()
  let mirror: MirrorRow[] = []
  try {
    const { data } = await getSupabaseAdminClient()
      .from('products')
      .select('id, image_url, section_name, active, dealer_price, raw')
      .in('id', ids)
    mirror = (data ?? []) as MirrorRow[]
    for (const row of mirror) if (row.image_url) mirrorImages.set(String(row.id), row.image_url)
  } catch (error) {
    logger.warn('Compare', 'Mirror read failed', { error })
  }

  try {
    const all = await fetchAllBitrixProducts(event)
    for (const p of all) {
      const id = String(p.ID)
      if (!ids.includes(id) || p.ACTIVE !== 'Y') continue
      found.set(id, { product: p, sectionName: sectionNames.get(String(p.SECTION_ID ?? '')) ?? null })
    }
  } catch (error) {
    logger.warn('Compare', 'Bitrix unavailable, using the mirror', { error })
    for (const row of mirror) {
      if (!row.raw || row.active === false) continue
      found.set(String(row.id), {
        product: { ...row.raw, PROPERTY_184: row.raw.PROPERTY_184 ?? row.dealer_price },
        sectionName: row.section_name ?? sectionNames.get(String(row.raw.SECTION_ID ?? '')) ?? null,
      })
    }
  }

  const usable = (id: string) => {
    const entry = found.get(id)
    if (!entry || hidden.has(id)) return null
    if (!siteSellsSection(site, entry.sectionName)) return null
    return entry
  }

  const anchor = usable(ids[0]!)
  if (!anchor) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  const groupId = groupIdForSection(anchor.sectionName, site.id)
  const group = categoryGroupsFor(site.id).find((g) => g.id === groupId)
  if (!group) throw createError({ statusCode: 404, statusMessage: 'This product has no category to compare in' })

  const chosen = ids
    .map((id) => ({ id, entry: usable(id) }))
    .filter(
      (c): c is { id: string; entry: NonNullable<ReturnType<typeof usable>> } =>
        !!c.entry && groupIdForSection(c.entry.sectionName, site.id) === group.id,
    )

  const products: CompareProduct[] = chosen.map(({ id, entry: { product } }) => ({
    id,
    name: String(product.NAME ?? ''),
    price: parseBitrixPrice(product.PRICE) ?? 0,
    dealerPrice: isDealer ? parseBitrixPrice(normalizeProperty(product.PROPERTY_184)) : null,
    lowStock: lowStock.has(id),
    imageUrl: mirrorImages.get(id) ?? null,
    PROPERTY_102: normalizeProperty(product.PROPERTY_102) ?? null,
    PROPERTY_44: normalizeProperty(product.PROPERTY_44) ?? null,
    DETAIL_PICTURE: product.DETAIL_PICTURE ?? null,
    PREVIEW_PICTURE: product.PREVIEW_PICTURE ?? null,
  }))

  // Labels differ between products ("Capacity" / "capacity:"), so they are
  // matched loosely and the first spelling seen is shown. Rows follow the
  // current product's order, then anything only the others have.
  const rows: CompareRow[] = []
  const rowByKey = new Map<string, CompareRow>()
  chosen.forEach(({ entry: { product } }, index) => {
    for (const spec of parseSpecs(product.PROPERTY_104)) {
      const label = spec.label || 'Other details'
      const key = labelKey(label)
      let row = rowByKey.get(key)
      if (!row) {
        row = { label: label.replace(/:\s*$/, ''), values: chosen.map(() => null) }
        rowByKey.set(key, row)
        rows.push(row)
      }
      const current = row.values[index]
      row.values[index] = current ? `${current}; ${spec.value}` : spec.value || null
    }
  })

  return {
    group: { id: group.id, name: group.name, sections: group.sections },
    products,
    rows,
  }
})

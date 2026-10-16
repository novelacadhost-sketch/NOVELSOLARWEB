/**
 * Which products a discount applies to: every product, the products in some
 * Bitrix sections, or a hand-picked list. Used by the server, which decides,
 * and by the checkout preview, which only shows.
 *
 * Sections are matched by NAME, case-insensitively: section ids on this portal
 * have changed when sections were deleted and re-added, and names survived.
 */

export type PromotionScope = 'all' | 'sections' | 'products'

export interface PromotionTarget {
  appliesTo: PromotionScope
  sections: string[]
  productIds: string[]
}

export const ALL_PRODUCTS: PromotionTarget = { appliesTo: 'all', sections: [], productIds: [] }

/** A target from stored columns. Anything unrecognised, or a list left empty, means every product. */
export function toPromotionTarget(appliesTo: unknown, sections: unknown, productIds: unknown): PromotionTarget {
  const list = (value: unknown) =>
    Array.isArray(value) ? [...new Set(value.map((v) => String(v ?? '').trim()).filter(Boolean))] : []
  const s = list(sections)
  const p = list(productIds)
  if (appliesTo === 'sections' && s.length) return { appliesTo: 'sections', sections: s, productIds: [] }
  if (appliesTo === 'products' && p.length) return { appliesTo: 'products', sections: [], productIds: p }
  return ALL_PRODUCTS
}

/** Whether a cart line is covered by the target. */
export function targetCovers(
  target: PromotionTarget | null | undefined,
  item: { id: string | number; sectionName?: string | null },
): boolean {
  if (!target || target.appliesTo === 'all') return true
  if (target.appliesTo === 'products') return target.productIds.includes(String(item.id))
  const section = String(item.sectionName ?? '').trim().toLowerCase()
  return section !== '' && target.sections.some((s) => s.toLowerCase() === section)
}

/** "all products", "Inverters and Batteries", "3 selected products": for messages and the admin list. */
export function describeTarget(target: PromotionTarget | null | undefined): string {
  if (!target || target.appliesTo === 'all') return 'all products'
  if (target.appliesTo === 'products') {
    const n = target.productIds.length
    return n === 1 ? '1 selected product' : `${n} selected products`
  }
  const names = target.sections
  if (names.length === 1) return names[0]!
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${names.length} product sections`
}

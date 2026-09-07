/**
 * Bitrix24 product property IDs, in one place.
 *
 * Verified against `crm.product.fields` and `catalog.product.list` on the live
 * portal (2026-09-05). Populated counts are from a 500-product sample and are
 * recorded because several fields the code reads are entirely empty, which is
 * indistinguishable from a wrong ID at runtime — a missing property and an
 * unset one both come back null.
 */
export const BITRIX_PROPERTY = {
  /** "Product images" — FILE property. 4/500 populated. */
  IMAGES_LEGACY: 'PROPERTY_44',
  /** "Cloudinary URL" — main image. 0/500 populated. */
  CLOUDINARY_URL: 'PROPERTY_102',
  /** "Specification" — stringified specs array. 0/500 populated. */
  SPECS: 'PROPERTY_104',
  /** "Gallery Image" — stringified URL array. 0/500 populated. */
  GALLERY: 'PROPERTY_112',
  /**
   * "Dealer Price" — 479/500 populated.
   *
   * The app read PROPERTY_116 until 2026-09-05. That property does not exist
   * on this portal: `crm.product.fields` omits it and `catalog.product.list`
   * silently drops it from a select. Dealer pricing therefore never applied —
   * approved dealers were quietly charged retail.
   */
  DEALER_PRICE: 'PROPERTY_184',
} as const

/**
 * Parse a Bitrix price property value.
 *
 * Values are usually "45000.00", but at least one product stores
 * "65000|NGN" — Bitrix's money format with a currency suffix. `Number()`
 * returns NaN for that, and three call sites assigned it straight to a price
 * with no guard, so a single such row would have produced a NaN order total
 * at checkout.
 *
 * Returns null for anything not parseable, so callers fall back to retail.
 */
export function parseBitrixPrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null

  // "65000|NGN" -> "65000"
  const text = String(raw).split('|')[0]?.trim()
  if (!text) return null

  const value = Number(text)
  if (!Number.isFinite(value)) return null

  // Zero and negatives are treated as "not set" rather than as a price. A
  // blank or cleared Dealer Price field reads back as 0, and honouring that
  // would hand dealers the product free; falling back to retail is the safe
  // failure. No product in the catalog has a legitimate 0 dealer price.
  if (value <= 0) return null

  return value
}

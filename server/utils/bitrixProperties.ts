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
 * Deal fields for web orders.
 *
 * An order is a sale, so it is a Deal, not a Lead. Leads stay for the
 * enquiry forms (contact / quote / service booking) where there is no
 * committed purchase yet.
 *
 * Verified against `crm.category.list` (entityTypeId 2), `crm.status.list`
 * and `crm.deal.fields` on the live portal (2026-09-18). These are ids, not
 * names, so a pipeline rename in the CRM will not break them — but a deleted
 * pipeline will, and `crm.deal.add` fails loudly in that case rather than
 * filing the order somewhere wrong.
 */
export const BITRIX_DEAL = {
  /**
   * "Product Sales". NOT the portal default, which is "Installation Sales"
   * (id 0) and is the wrong book for a shop order. Omitting CATEGORY_ID
   * would silently file every web order there.
   */
  CATEGORY_ID: 4,
  /** "New Product Sales" — the entry stage of category 4. */
  STAGE_ID: 'C4:NEW',
  /**
   * "Branch" — an iblock_element field bound to IBLOCK_ID 28, the same branch
   * registry `app/utils/locations.ts` carries `bitrixId` from. The value is
   * the element id, so the branch the customer picked at checkout lands on
   * the deal and the right store sees it.
   */
  BRANCH_FIELD: 'UF_CRM_1781105708',
  /**
   * "Web/app order?" — a checkbox, default 0. Set to 1 on everything this
   * file creates, which is the point: it marks the order as having come from
   * the website or the mobile app rather than being keyed in by staff, so
   * the CRM can filter and report on online sales.
   */
  WEB_ORDER_FLAG: 'UF_CRM_1789747055987',
  /** Bitrix boolean userfields take 1/0, not true/false. */
  WEB_ORDER_FLAG_YES: 1,
} as const

/**
 * CRM source ids, verified against `crm.status.list` (ENTITY_ID 'SOURCE') on
 * 2026-09-23. These are opaque codes, not names — "WEB" reads like a sensible
 * default but is literally "Website Contact Form" on this portal, which is
 * wrong for someone who has just bought something.
 */
export const BITRIX_SOURCE = {
  /** "Website Sale" — a customer created by an actual purchase. */
  WEBSITE_SALE: 'UC_WXJIAR',
  /** "Website Contact Form" — the enquiry forms, and the default elsewhere. */
  WEBSITE_FORM: 'WEB',
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

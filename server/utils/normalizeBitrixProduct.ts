import { parseBitrixPrice } from './bitrixProperties'
import { normalizeProperty } from './normalizeProperty'

export interface BitrixProduct {
  ID?: string | number
  NAME?: string
  PRICE?: string | number
  PROPERTY_184?: unknown
  DESCRIPTION?: unknown
  QUANTITY?: string | number
  ACTIVE?: string
  SECTION_ID?: string | number
  PROPERTY_102?: unknown
  PROPERTY_104?: unknown
  PROPERTY_112?: unknown
  PROPERTY_44?: unknown
  PREVIEW_PICTURE?: unknown
  DETAIL_PICTURE?: unknown
  [key: string]: unknown
}

export interface MappedProduct {
  section_id: string | null
  section_name: string | null
  id: string
  name: string
  price: number
  dealer_price: number | null
  description: string | null
  specs: unknown | null
  gallery_urls: string[]
  image_url: string | null
  quantity: number | null
  active: boolean
  raw: Record<string, unknown>
  synced_at: string
}

export function normalizeBitrixProduct(product: BitrixProduct, sections?: Map<string, string>): MappedProduct {
  // 1. Resolve image_url fallback chain
  let image_url: string | null = null
  const cloudinaryUrl = normalizeProperty(product.PROPERTY_102)

  if (cloudinaryUrl) {
    image_url = String(cloudinaryUrl)
  } else {
    const bitrixImage =
      normalizeProperty(product.PROPERTY_44) ||
      normalizeProperty(product.PREVIEW_PICTURE) ||
      normalizeProperty(product.DETAIL_PICTURE)

    if (bitrixImage) {
      image_url = `/api/bitrix-image?url=${encodeURIComponent(String(bitrixImage))}`
    }
  }

  // 2. Parse specs
  let specs: unknown | null = null
  const rawSpecs = normalizeProperty(product.PROPERTY_104)
  if (typeof rawSpecs === 'string' && rawSpecs.trim() !== '') {
    try {
      specs = JSON.parse(rawSpecs)
    } catch {
      specs = null
    }
  } else if (rawSpecs) {
    specs = rawSpecs
  }

  // 3. Parse gallery_urls
  let gallery_urls: string[] = []
  const rawGallery = normalizeProperty(product.PROPERTY_112)
  if (typeof rawGallery === 'string' && rawGallery.trim() !== '') {
    try {
      const parsed = JSON.parse(rawGallery)
      gallery_urls = Array.isArray(parsed) ? parsed : []
    } catch {
      gallery_urls = []
    }
  } else if (Array.isArray(rawGallery)) {
    gallery_urls = rawGallery
  }

  // 4. Safely parse numbers
  const dealer_price = parseBitrixPrice(normalizeProperty(product.PROPERTY_184))

  const quantity =
    product.QUANTITY != null && product.QUANTITY !== '' && !Number.isNaN(Number(product.QUANTITY))
      ? Number(product.QUANTITY)
      : null

  // 5. Parse description
  const descriptionStr = normalizeProperty(product.DESCRIPTION)

  // The section is the catalogue's real category.
  //
  // The NAME is stored alongside the id, not just for the convenience of a
  // client reading the mirror without a join. Sections on this portal were
  // created, deleted, and re-added — so the ids are not stable across that, and
  // anything keyed on an id silently stops matching when it happens again.
  // Names survived. Group on the name.
  const section_id = product.SECTION_ID != null && product.SECTION_ID !== '' ? String(product.SECTION_ID) : null
  const section_name = section_id ? (sections?.get(section_id) ?? null) : null

  return {
    id: String(product.ID || ''),
    name: String(product.NAME || ''),
    price: Number(product.PRICE) || 0,
    dealer_price,
    description: descriptionStr ? String(descriptionStr) : null,
    specs,
    gallery_urls,
    image_url,
    quantity,
    active: product.ACTIVE === 'Y',
    section_id,
    section_name,
    raw: product as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  }
}

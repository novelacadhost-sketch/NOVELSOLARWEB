import { logger } from '../../utils/logger'
import { resolveIsDealerFromEvent } from '../../utils/dealerCheck'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { getHiddenProductIds } from '../../utils/productVisibility'
import { isLowStock } from '../../utils/lowStock'
import { parseGallery, parseSpecs, productDescriptionHtml, sanitizeRichText } from '../../utils/productFields'
import { BITRIX_PROPERTY } from '../../utils/bitrixProperties'
import { getSectionMap } from '../../utils/bitrixSections'
import { getSite } from '../../utils/site'
import { siteSellsSection } from '#shared/sites'

interface BitrixProduct {
  ACTIVE?: string
  PROPERTY_184?: unknown
  PROPERTY_102?: unknown
  PROPERTY_104?: unknown
  PROPERTY_112?: unknown
  dealerPrice?: number
  [key: string]: unknown
}

interface MirrorRow {
  image_url: string | null
  quantity: number | null
  section_name: string | null
  active: boolean | null
  raw: BitrixProduct | null
}

const notFound = () => createError({ statusCode: 404, statusMessage: 'Product not found' })

async function readMirror(id: string, withRaw: boolean): Promise<MirrorRow | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from('products')
    .select(withRaw ? 'image_url, quantity, section_name, active, raw' : 'image_url, quantity, section_name, active')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as MirrorRow | null
}

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!/^\d+$/.test(id)) throw notFound()

  // One shared gate: it accepts both the browser cookie session and an
  // Authorization: Bearer token, so native clients get dealer pricing too.
  const isDealer = await resolveIsDealerFromEvent(event)

  let product: BitrixProduct | null = null
  let mirror: MirrorRow | null = null
  let fromMirror = false

  try {
    const response = await bitrixFetch<{ result?: BitrixProduct }>(`crm.product.get?id=${id}`)
    product = response.result || null
  } catch (error) {
    // Bitrix down or refusing the webhook: serve the last synced copy rather
    // than tell the customer the product does not exist. A product deleted in
    // Bitrix is gone from the mirror too (the webhook and the nightly sync
    // remove it), so this cannot resurrect one.
    logger.error('Product', 'Bitrix API error, trying the mirror', { error })
    try {
      mirror = await readMirror(id, true)
    } catch (mirrorError) {
      logger.error('Product', 'Mirror read failed too', { error: mirrorError })
    }
    if (!mirror?.raw || mirror.active === false) throw notFound()
    product = { ...mirror.raw }
    fromMirror = true
  }

  if (!product) return null
  if (product.ACTIVE === 'N') throw notFound()

  // Hidden on the website. 404 rather than render: hiding it from the
  // listings but leaving the URL live would only half-hide it.
  if ((await getHiddenProductIds()).has(id)) throw notFound()

  if (!fromMirror) {
    try {
      mirror = await readMirror(id, false)
    } catch {
      // A missing picture or badge is a worse page, not a broken one.
    }
  }

  // A solar product's URL on the Home Essentials domain is not a page there.
  // The mirror's section name covers the case where Bitrix sections are unreadable.
  const site = getSite(event)
  const sectionName = (await getSectionMap()).get(String(product.SECTION_ID ?? '')) ?? mirror?.section_name ?? undefined
  if (site.sections && !siteSellsSection(site, sectionName)) throw notFound()
  // The page's Compare button offers products from the same shop category.
  product.sectionName = sectionName ?? null

  product.PROPERTY_102 = normalizeProperty(product.PROPERTY_102)
  // Still JSON text, which is what the product page parses — but read and
  // re-written by the shared parser, so a malformed or HTML-escaped value
  // arrives as a clean list and a gallery holds only web addresses.
  product.PROPERTY_104 = JSON.stringify(parseSpecs(product.PROPERTY_104))
  product.PROPERTY_112 = JSON.stringify(parseGallery(product.PROPERTY_112))
  // The page renders this with v-html. Descriptions are edited in Bitrix
  // directly, where nothing of ours runs, so it is cleaned on the way out.
  // DESCRIPTION is the brand now, not a description.
  product.detailedDescription = productDescriptionHtml(product[BITRIX_PROPERTY.DETAILED_DESCRIPTION])
  if (typeof product.DESCRIPTION === 'string') product.DESCRIPTION = sanitizeRichText(product.DESCRIPTION)

  if (isDealer) {
    const dealerPrice = parseBitrixPrice(normalizeProperty(product.PROPERTY_184))
    if (dealerPrice !== null) product.dealerPrice = dealerPrice
  }

  // The mirrored Cloudinary URL, which the Bitrix payload knows nothing
  // about. Without this the detail page falls all the way through to the
  // placeholder for any product whose picture only exists in the mirror.
  // Stock rides the same row: the flag goes out, the count does not.
  if (mirror?.image_url) product.imageUrl = mirror.image_url
  product.lowStock = isLowStock(mirror?.quantity)

  // Always strip the raw PROPERTY_184 so it doesn't leak
  delete product.PROPERTY_184

  return product
})

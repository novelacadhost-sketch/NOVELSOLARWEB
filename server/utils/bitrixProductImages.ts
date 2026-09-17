import { bitrixFetch } from './bitrixAuth'
import { configureCloudinary, mirrorRemoteImageToCloudinary } from './productMedia'
import { logger } from './logger'

/**
 * Copies product photos out of Bitrix into Cloudinary.
 *
 * Where the pictures actually are: product photos uploaded in Bitrix live on
 * the CATALOG side, reachable only through `catalog.productImage.list`. The
 * CRM-side fields the sync already reads are empty — DETAIL_PICTURE and
 * PREVIEW_PICTURE are 0% populated across the catalogue, and PROPERTY_44
 * returns a portal-relative path needing authentication, which is the whole
 * reason /api/bitrix-image exists. Nothing was ever wrong with the fetching
 * code; it was reading fields nobody fills in.
 *
 * Why copy rather than link: the catalog API's `detailUrl` is a public
 * cdn.bitrix24.com link that would work directly, but it serves the raw file
 * with no format or size negotiation (a sampled PNG was 215 KB where
 * Cloudinary's f_auto,q_auto,w_1200 returns roughly 30 KB of WebP), and it
 * stops resolving if the product is deleted or the portal moves.
 */

interface BitrixProductImage {
  id?: number | string
  productId?: number | string
  detailUrl?: string
  downloadUrl?: string
  type?: string
}

export interface MirroredImage {
  imageId: string
  url: string
}

/**
 * The image records Bitrix holds for a product.
 *
 * `downloadUrl` is deliberately dropped here and never returned. It is a
 * `/rest/<id>/<secret>/download/` link — it embeds the inbound-webhook
 * credential, so storing it in the mirror or sending it to a browser would
 * hand out read/write access to the whole CRM. Only `detailUrl` leaves this
 * function.
 */
export async function fetchProductImages(productId: string): Promise<BitrixProductImage[]> {
  try {
    const response = await bitrixFetch<{ result?: { productImages?: BitrixProductImage[] } }>(
      'catalog.productImage.list',
      { query: { productId } },
    )
    return response.result?.productImages ?? []
  } catch (error) {
    logger.warn('ProductImages', 'Could not list images for product', {
      productId,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

/** Prefers the main photo when Bitrix distinguishes one; otherwise the first. */
function pickPrimary(images: BitrixProductImage[]): BitrixProductImage | null {
  const usable = images.filter((i) => i.detailUrl && i.id != null)
  if (!usable.length) return null
  return usable.find((i) => i.type === 'DETAIL_PICTURE') ?? usable[0]!
}

/**
 * Mirror a product's primary Bitrix photo, returning null when there is none.
 *
 * `alreadyMirrored` is the `bitrix_image_id` currently on the row. When it
 * matches, no upload happens — that check is what keeps a nightly walk of
 * ~1150 products from re-uploading the entire catalogue every night.
 */
export async function mirrorPrimaryImage(
  productId: string,
  alreadyMirrored?: string | null,
): Promise<MirroredImage | null | 'unchanged'> {
  const primary = pickPrimary(await fetchProductImages(productId))
  if (!primary) return null

  const imageId = String(primary.id)
  if (alreadyMirrored && alreadyMirrored === imageId) return 'unchanged'

  try {
    configureCloudinary()
    // Bitrix filenames contain spaces ("Power Audit Engineer.png"), which make
    // an invalid URL if passed through unencoded.
    const source = encodeURI(primary.detailUrl!)
    const url = await mirrorRemoteImageToCloudinary(source, `bitrix_${imageId}`)
    logger.info('ProductImages', 'Mirrored image to Cloudinary', { productId, imageId })
    return { imageId, url }
  } catch (error) {
    // Never fatal. A product without a picture is a worse page, not a broken
    // sync, and the next run retries.
    logger.warn('ProductImages', 'Mirror failed', {
      productId,
      imageId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

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

/**
 * Is this image_url only the authenticated Bitrix proxy?
 *
 * PROPERTY_44 gives a portal-relative path that needs credentials, so the
 * mapper wraps it in /api/bitrix-image. That counts as "has a picture" for
 * rendering, but NOT for mirroring: it is a hop through our own server to an
 * unoptimised original, and the same image is available on Bitrix's public CDN
 * where Cloudinary can fetch it once and serve WebP thereafter.
 *
 * Getting this wrong is what made the first version mirror nothing. The only
 * four products with catalog images are the same four with PROPERTY_44 set, so
 * treating a proxy URL as a finished picture skipped precisely the products
 * that had something to copy.
 */
export function isProxiedBitrixImage(url?: string | null): boolean {
  return Boolean(url && url.startsWith('/api/bitrix-image'))
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

/**
 * Which of these products actually have a photo in Bitrix.
 *
 * Asking per product is what made the first version useless: a budget of 25
 * lookups per night, spent almost entirely on products with nothing, meant a
 * picture 1035 places down the queue was 41 nights away. Bitrix's `batch`
 * answers 50 products per HTTP call, so the whole 1156-product catalogue costs
 * ~24 calls and about 26 seconds.
 *
 * Time-boxed and resumable rather than unconditional, because 26 seconds is a
 * large slice of a 60-second function and this portal has timed out before.
 * The caller persists `nextIndex` and resumes there, so a slow night sweeps
 * less and the following run continues instead of restarting.
 */
export interface Discovery {
  hits: Map<string, string>
  nextIndex: number
  complete: boolean
  scanned: number
}

const BATCH_SIZE = 50

export async function discoverProductsWithImages(
  productIds: string[],
  startIndex: number,
  deadlineMs: number,
): Promise<Discovery> {
  const hits = new Map<string, string>()
  const started = Date.now()
  let index = startIndex >= productIds.length ? 0 : startIndex
  let scanned = 0

  while (index < productIds.length) {
    if (Date.now() - started > deadlineMs) {
      return { hits, nextIndex: index, complete: false, scanned }
    }

    const chunk = productIds.slice(index, index + BATCH_SIZE)
    const cmd: Record<string, string> = {}
    chunk.forEach((id, i) => {
      cmd[`c${i}`] = `catalog.productImage.list?productId=${encodeURIComponent(id)}`
    })

    try {
      const response = await bitrixFetch<{ result?: { result?: Record<string, { productImages?: BitrixProductImage[] }> } }>(
        'batch',
        { method: 'POST', body: { halt: 0, cmd } },
      )
      const results = response.result?.result ?? {}
      chunk.forEach((id, i) => {
        const images = results[`c${i}`]?.productImages ?? []
        const primary = pickPrimary(images)
        if (primary) hits.set(id, String(primary.id))
      })
    } catch (error) {
      // One bad batch should not end the sweep; the cursor moves past it and
      // the next run picks those products up again on the following lap.
      logger.warn('ProductImages', 'Discovery batch failed', {
        from: index,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    scanned += chunk.length
    index += BATCH_SIZE
  }

  return { hits, nextIndex: 0, complete: true, scanned }
}


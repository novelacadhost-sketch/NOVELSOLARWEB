import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { normalizeBitrixProduct, type BitrixProduct } from './normalizeBitrixProduct'
import { getSectionMap } from './bitrixSections'
import { mirrorPrimaryImage, isProxiedBitrixImage, discoverProductsWithImages } from './bitrixProductImages'

export interface ProductSyncResult {
  synced: number
  deleted: number
  /** Absent when the image step could not run at all. */
  images?: MirrorReport
}

/**
 * Full Bitrix -> Supabase product mirror refresh.
 *
 * Lives here rather than inside the Nitro task because Nitro tasks are not
 * registered in Vercel's serverless runtime — `runTask('sync:products')` fails
 * there with "Task is not available". The task now delegates to this, so the
 * scheduled path works on a long-running server while the HTTP endpoint calls
 * it directly on serverless.
 */
/**
 * Fill in product pictures from Bitrix's catalog images, via Cloudinary.
 *
 * Two jobs, and the first is the one that is easy to miss: this sync UPSERTS
 * whole rows, and a product whose only picture is a mirrored one has no image
 * in its Bitrix CRM fields — so without carrying the existing value forward,
 * every nightly run would overwrite image_url with null and un-picture the
 * catalogue.
 *
 * Carrying forward also means an already-mirrored product costs no API call.
 * Only products with no picture at all are candidates, and only
 * MIRROR_BUDGET_PER_RUN of them per run: mirroring is one Cloudinary call per
 * image, and a backlog of a thousand would not fit in a 60-second function.
 * The backlog drains over successive nights.
 *
 * A picture CHANGED in Bitrix is not detected here — that would need a call per
 * product, which is exactly what the budget exists to avoid. The webhook path
 * covers it: editing a product fires ONCRMPRODUCTUPDATE and syncSingleProduct
 * re-mirrors immediately. Nightly fills gaps, the webhook handles changes.
 */

interface MirrorableProduct {
  id: string
  image_url: string | null
  bitrix_image_id?: string | null
}

export interface MirrorReport {
  scanned: number
  found: number
  mirrored: number
  carried: number
  sweepComplete: boolean
  skipped?: string
}

/**
 * Fill in product pictures from Bitrix's catalog images, via Cloudinary.
 *
 * Three jobs, and the first is the one that is easy to miss: this sync UPSERTS
 * whole rows, and a mirrored product has no picture in its Bitrix CRM fields —
 * so without carrying the existing image_url forward, every nightly run would
 * overwrite it with null and un-picture the catalogue.
 *
 * Then DISCOVERY, in bulk. The first version asked Bitrix per product under a
 * budget of 25 a night, and since only 5 of 1156 products have a photo, that
 * budget was spent almost entirely on empty lookups — a picture 1035 places
 * down the queue was 41 nights from appearing. A batched sweep answers 50
 * products per call and covers the catalogue in about 26 seconds, so uploads
 * are attempted only where there is something to upload.
 *
 * Finally the UPLOADS, which stay capped: they are the expensive half, and a
 * bulk import of a thousand photos must not blow the 60-second function.
 *
 * The sweep is time-boxed and resumes from a cursor in sync_meta, so a slow
 * night covers less ground instead of timing out. A photo REPLACED in Bitrix is
 * still picked up immediately by the webhook path, which has no budget.
 */
const MIRROR_UPLOAD_BUDGET = 25
const DISCOVERY_DEADLINE_MS = 20_000
const CURSOR_KEY = 'image_scan_cursor'

interface MirrorableProduct {
  id: string
  image_url: string | null
  bitrix_image_id?: string | null
}

async function readCursor(supabase: ReturnType<typeof getSupabaseAdminClient>): Promise<number> {
  const { data } = await supabase.from('sync_meta').select('value').eq('key', CURSOR_KEY).maybeSingle()
  const raw = (data as { value?: string } | null)?.value
  const parsed = Number.parseInt(raw ?? '0', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

async function writeCursor(supabase: ReturnType<typeof getSupabaseAdminClient>, value: number): Promise<void> {
  await supabase
    .from('sync_meta')
    .upsert({ key: CURSOR_KEY, value: String(value), updated_at: new Date().toISOString() } as never, {
      onConflict: 'key',
    })
}

async function applyMirroredImages(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  mapped: MirrorableProduct[],
): Promise<MirrorReport> {
  try {
    const { data, error } = await supabase.from('products').select('id, image_url, bitrix_image_id')
    if (error) throw error

    const existing = new Map<string, { image_url: string | null; bitrix_image_id: string | null }>()
    for (const row of (data ?? []) as { id: string; image_url: string | null; bitrix_image_id: string | null }[]) {
      existing.set(String(row.id), { image_url: row.image_url, bitrix_image_id: row.bitrix_image_id })
    }

    const candidates: MirrorableProduct[] = []
    let carried = 0

    for (const product of mapped) {
      // A Cloudinary URL from Bitrix PROPERTY_102 wins — a human chose it. A
      // /api/bitrix-image proxy URL does not: it is a hop through our server to
      // an unoptimised original, so it is a candidate for replacement.
      if (product.image_url && !isProxiedBitrixImage(product.image_url)) continue

      const prior = existing.get(product.id)
      if (prior?.bitrix_image_id && prior.image_url) {
        product.image_url = prior.image_url
        product.bitrix_image_id = prior.bitrix_image_id
        carried++
        continue
      }

      candidates.push(product)
    }

    if (!candidates.length) {
      return { scanned: 0, found: 0, mirrored: 0, carried, sweepComplete: true }
    }

    const cursor = await readCursor(supabase)
    const ids = candidates.map((c) => c.id)
    const discovery = await discoverProductsWithImages(ids, cursor, DISCOVERY_DEADLINE_MS)
    await writeCursor(supabase, discovery.nextIndex)

    let budget = MIRROR_UPLOAD_BUDGET
    let mirrored = 0

    for (const product of candidates) {
      const imageId = discovery.hits.get(product.id)
      if (!imageId || budget <= 0) continue
      budget--

      const result = await mirrorPrimaryImage(product.id, existing.get(product.id)?.bitrix_image_id)
      if (result && result !== 'unchanged') {
        product.image_url = result.url
        product.bitrix_image_id = result.imageId
        mirrored++
      }
    }

    const report: MirrorReport = {
      scanned: discovery.scanned,
      found: discovery.hits.size,
      mirrored,
      carried,
      sweepComplete: discovery.complete,
    }
    logger.info('ProductSync', 'Product images resolved', { ...report })
    return report
  } catch (error) {
    // Pictures are not worth failing a product sync over — but the outcome is
    // reported rather than swallowed, because a mirroring step that quietly
    // does nothing is indistinguishable from one that is not running at all.
    const message = error instanceof Error ? error.message : String(error)
    logger.warn('ProductSync', 'Image mirroring skipped', { error: message })
    return { scanned: 0, found: 0, mirrored: 0, carried: 0, sweepComplete: false, skipped: message }
  }
}

export async function syncAllProducts(): Promise<ProductSyncResult> {
  logger.info('ProductSync', 'Starting Bitrix product sync...')

  const config = useRuntimeConfig()
  const bitrixUrl = config.bitrixWebhookUrl as string

  if (!bitrixUrl) {
    const error = new Error('Bitrix Webhook URL is not configured')
    logger.error('ProductSync', 'Missing configuration', { error })
    throw error
  }

  const formattedBitrixUrl = bitrixUrl.endsWith('/') ? bitrixUrl : `${bitrixUrl}/`

  let start = 0
  let hasMore = true
  const allProducts: BitrixProduct[] = []

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => {
    abortController.abort()
  }, 30000)

  try {
    while (hasMore) {
      const endpoint = `crm.product.list${start > 0 ? `?start=${start}` : ''}`

      const response = await $fetch<{ result: BitrixProduct[]; next?: number }>(`${formattedBitrixUrl}${endpoint}`, {
        method: 'POST',
        body: {
          limit: 50,
          filter: { ACTIVE: 'Y' },
          select: [
            'ID',
            'NAME',
            'PRICE',
            'QUANTITY',
            'CURRENCY_ID',
            'SECTION_ID',
            'ACTIVE',
            'PROPERTY_102',
            'PROPERTY_104',
            'PROPERTY_112',
            'PROPERTY_184',
            'DETAIL_PICTURE',
            'PREVIEW_PICTURE',
            'PROPERTY_44',
          ],
        },
        signal: abortController.signal,
      })

      if (response?.result && Array.isArray(response.result)) {
        allProducts.push(...response.result)
        logger.info('ProductSync', `Fetched ${allProducts.length} products so far...`)
      }

      if (typeof response?.next === 'number') {
        start = response.next
      } else {
        hasMore = false
      }
    }

    // One lookup for the whole run rather than per page. Never throws — a
    // failed section call leaves names null, not the sync broken.
    const sections = await getSectionMap()
    const mappedProducts = allProducts.map((p) => normalizeBitrixProduct(p, sections))
    const supabase = getSupabaseAdminClient()

    const images = await applyMirroredImages(supabase, mappedProducts)

    if (mappedProducts.length > 0) {
      const { error: upsertError } = await supabase
        .from('products')
        .upsert(mappedProducts as never, { onConflict: 'id' })
      if (upsertError) throw upsertError
    }

    // Drop anything no longer active in Bitrix.
    const syncedIds = mappedProducts.map((p) => p.id)
    let deletedCount = 0

    if (syncedIds.length > 0) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('products')
        .delete()
        .not('id', 'in', `(${syncedIds.join(',')})`)
        .select('id')

      if (deleteError) throw deleteError
      deletedCount = deletedRows?.length || 0
    } else {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('products')
        .delete()
        .neq('id', 'prevent-empty-error')
        .select('id')

      if (deleteError) throw deleteError
      deletedCount = deletedRows?.length || 0
    }

    const { error: metaError } = await supabase
      .from('sync_meta')
      .upsert({ key: 'products_last_synced', value: new Date().toISOString() } as never, { onConflict: 'key' })
    if (metaError) throw metaError

    logger.info('ProductSync', 'Sync complete', { synced: mappedProducts.length, deleted: deletedCount })
    return { synced: mappedProducts.length, deleted: deletedCount, images }
  } catch (error) {
    if (abortController.signal.aborted) {
      const timeoutErr = new Error('Bitrix catalog fetch timed out after 30s')
      logger.error('ProductSync', 'Timeout error', { error: timeoutErr })
      throw timeoutErr
    }

    logger.error('ProductSync', 'Sync failed', { error })
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

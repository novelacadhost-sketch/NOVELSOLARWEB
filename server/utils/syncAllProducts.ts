import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { normalizeBitrixProduct, type BitrixProduct } from './normalizeBitrixProduct'

export interface ProductSyncResult {
  synced: number
  deleted: number
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
            'PROPERTY_116',
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

    const mappedProducts = allProducts.map(normalizeBitrixProduct)
    const supabase = getSupabaseAdminClient()

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
    return { synced: mappedProducts.length, deleted: deletedCount }
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

import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { normalizeBitrixProduct, type BitrixProduct } from './normalizeBitrixProduct'
import { getSectionMap } from './bitrixSections'
import { mirrorPrimaryImage, isProxiedBitrixImage } from './bitrixProductImages'
import { fetchCatalogStock, mirrorQuantity } from './catalogStock'

export async function syncSingleProduct(productId: string, config: ReturnType<typeof useRuntimeConfig>): Promise<void> {
  try {
    const bitrixUrl = config.bitrixWebhookUrl as string
    if (!bitrixUrl) {
      throw new Error('Bitrix Webhook URL is not configured')
    }
    const formattedBitrixUrl = bitrixUrl.endsWith('/') ? bitrixUrl : `${bitrixUrl}/`

    const response = await $fetch<{ result?: BitrixProduct; error?: string; error_description?: string }>(
      `${formattedBitrixUrl}crm.product.get?id=${encodeURIComponent(productId)}`,
    )

    const supabase = getSupabaseAdminClient()

    if (response?.error || !response?.result || response.result.ACTIVE !== 'Y') {
      const { error: deleteError } = await supabase.from('products').delete().eq('id', productId)
      if (deleteError) throw deleteError

      logger.info('ProductSync', `Deleted inactive or missing product ${productId}`)
      return
    }

    const mappedProduct = normalizeBitrixProduct(response.result, await getSectionMap())

    // One product, triggered by an edit in Bitrix — so unlike the nightly walk
    // there is no budget to respect, and this is the path that makes a picture
    // appear on the site seconds after someone uploads it. It is also the only
    // path that notices an image being REPLACED: the nightly sync carries the
    // existing mirror forward without re-checking, deliberately.
    if (!mappedProduct.image_url || isProxiedBitrixImage(mappedProduct.image_url)) {
      const { data: prior } = await supabase
        .from('products')
        .select('bitrix_image_id')
        .eq('id', productId)
        .maybeSingle()

      const result = await mirrorPrimaryImage(
        productId,
        (prior as { bitrix_image_id?: string | null } | null)?.bitrix_image_id,
      )
      if (result === 'unchanged') {
        const { data: keep } = await supabase
          .from('products')
          .select('image_url, bitrix_image_id')
          .eq('id', productId)
          .maybeSingle()
        const row = keep as { image_url?: string | null; bitrix_image_id?: string | null } | null
        mappedProduct.image_url = row?.image_url ?? null
        mappedProduct.bitrix_image_id = row?.bitrix_image_id ?? null
      } else if (result) {
        mappedProduct.image_url = result.url
        mappedProduct.bitrix_image_id = result.imageId
      }
    }

    // crm.product.get has no QUANTITY; the catalog does. A failed lookup drops
    // the key so the upsert keeps the stored stock instead of nulling it.
    try {
      const stock = await fetchCatalogStock([productId])
      mappedProduct.quantity = mirrorQuantity(stock.get(String(productId)))
    } catch (stockError) {
      delete (mappedProduct as { quantity?: number | null }).quantity
      logger.warn('ProductSync', `Stock lookup failed for ${productId}; stored quantity kept`, {
        error: stockError instanceof Error ? stockError.message : String(stockError),
      })
    }

    const { error: upsertError } = await supabase.from('products').upsert(mappedProduct, { onConflict: 'id' })
    if (upsertError) throw upsertError

    logger.info('ProductSync', `Successfully synced single product ${productId}`)
  } catch (error) {
    logger.error('ProductSync', `Failed to sync single product ${productId}`, { error })
  }
}

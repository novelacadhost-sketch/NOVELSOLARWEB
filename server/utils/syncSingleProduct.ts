import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { normalizeBitrixProduct, type BitrixProduct } from './normalizeBitrixProduct'
import { getSectionMap } from './bitrixSections'

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
    const { error: upsertError } = await supabase.from('products').upsert(mappedProduct, { onConflict: 'id' })
    if (upsertError) throw upsertError

    logger.info('ProductSync', `Successfully synced single product ${productId}`)
  } catch (error) {
    logger.error('ProductSync', `Failed to sync single product ${productId}`, { error })
  }
}

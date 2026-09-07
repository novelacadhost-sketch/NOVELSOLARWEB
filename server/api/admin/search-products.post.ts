import { logger } from '../../utils/logger'

interface BitrixRawProduct {
  ID: string | number
  NAME?: string
  PRICE?: string | number
  PROPERTY_184?: unknown
  CURRENCY_ID?: string
  DESCRIPTION?: string
  DESCRIPTION_TYPE?: string
  MEASURE?: string | number
  ACTIVE?: string
  PROPERTY_102?: unknown
  PROPERTY_104?: unknown
  PROPERTY_112?: unknown
  PROPERTY_44?: unknown
  DETAIL_PICTURE?: unknown
  PREVIEW_PICTURE?: unknown
}

interface BitrixSearchResponse {
  result?: BitrixRawProduct[]
  next?: number
  total?: number
  error?: string | boolean
  error_description?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { query, start } = body
  const config = useRuntimeConfig()
  const nextStart = start || 0

  // Security check handled by admin-auth server middleware
  const searchQuery = query?.trim() || ''

  try {
    const bitrixUrl = config.bitrixWebhookUrl
    if (!bitrixUrl) {
      throw createError({ statusCode: 500, statusMessage: 'Bitrix not configured' })
    }

    const formattedBitrixUrl = (bitrixUrl as string).endsWith('/') ? bitrixUrl : `${bitrixUrl}/`

    // Search products (all if query is empty)
    const response = await $fetch<BitrixSearchResponse>(`${formattedBitrixUrl}crm.product.list`, {
      method: 'POST',
      body: {
        filter: searchQuery ? { '%NAME': searchQuery } : {},
        select: [
          'ID',
          'NAME',
          'PRICE',
          'PROPERTY_184',
          'DESCRIPTION',
          'DESCRIPTION_TYPE',
          'MEASURE',
          'ACTIVE',
          'PROPERTY_102',
          'PROPERTY_104',
          'PROPERTY_112',
          'PROPERTY_44',
          'CURRENCY_ID',
          'DETAIL_PICTURE',
          'PREVIEW_PICTURE',
        ],
        limit: 50,
        start: nextStart,
        order: { ID: 'DESC' },
      },
    })

    // Provide the "bulletproof" Bitrix error catch
    if (response.error) {
      logger.error('Search Products', 'Bitrix API error', { error: response.error_description })
      throw new Error(response.error_description)
    }

    // Safely result mapping with fallback for images
    const products = (response.result || []).map((p) => {
      const cloudinaryUrl = normalizeProperty(p.PROPERTY_102)
      const legacyImageId = p.DETAIL_PICTURE || p.PREVIEW_PICTURE || normalizeProperty(p.PROPERTY_44)

      return {
        id: p.ID,
        name: p.NAME,
        price: p.PRICE,
        dealerPrice: normalizeProperty(p.PROPERTY_184) ? Number(normalizeProperty(p.PROPERTY_184)) : null,
        currency: p.CURRENCY_ID || 'NGN',
        description: p.DESCRIPTION,
        descriptionType: p.DESCRIPTION_TYPE,
        measure: p.MEASURE,
        isDisabled: p.ACTIVE === 'N',
        persistedMainImageUrl: cloudinaryUrl || '',
        // Priority 1: Cloudinary URL (PROPERTY_102), Priority 2: Bitrix Image Proxy
        imageUrl:
          cloudinaryUrl ||
          (legacyImageId
            ? `/api/bitrix-image?url=${encodeURIComponent(`https://nisl.bitrix24.com/bitrix/admin/crm_product_show.php?ID=${p.ID}&fieldName=DETAIL_PICTURE`)}`
            : null),
        specs:
          typeof p.PROPERTY_104 === 'string' ? JSON.parse(p.PROPERTY_104) : normalizeProperty(p.PROPERTY_104) || [],
        gallery:
          typeof p.PROPERTY_112 === 'string' ? JSON.parse(p.PROPERTY_112) : normalizeProperty(p.PROPERTY_112) || [],
      }
    })

    return {
      success: true,
      products,
      next: response.next || null,
      total: response.total || 0,
      count: products.length,
    }
  } catch (error) {
    logger.error('Search Products', 'Route error', { error })
    const message = error instanceof Error ? error.message : String(error)
    throw createError({
      statusCode: 500,
      statusMessage: message || 'Failed to search Bitrix database.',
    })
  }
})

import { logger } from '../../utils/logger'
import { resolveIsDealerFromEvent } from '../../utils/dealerCheck'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  // One shared gate: it accepts both the browser cookie session and an
  // Authorization: Bearer token, so native clients get dealer pricing too.
  const isDealer = await resolveIsDealerFromEvent(event)

  try {
    interface BitrixProduct {
      ACTIVE?: string
      PROPERTY_184?: unknown
      PROPERTY_102?: unknown
      PROPERTY_104?: unknown
      PROPERTY_112?: unknown
      dealerPrice?: number
      [key: string]: unknown
    }
    const response = await bitrixFetch<{ result?: BitrixProduct }>(`crm.product.get?id=${id}`)
    const product = response.result || null

    if (product) {
      if (product.ACTIVE === 'N') {
        throw createError({ statusCode: 404, statusMessage: 'Product not found' })
      }

      product.PROPERTY_102 = normalizeProperty(product.PROPERTY_102)
      product.PROPERTY_104 = normalizeProperty(product.PROPERTY_104)
      product.PROPERTY_112 = normalizeProperty(product.PROPERTY_112)

      if (isDealer) {
        const dealerPrice = parseBitrixPrice(normalizeProperty(product.PROPERTY_184))
        if (dealerPrice !== null) product.dealerPrice = dealerPrice
      }

      // Always strip the raw PROPERTY_184 so it doesn't leak
      delete product.PROPERTY_184
    }

    return product
  } catch (error) {
    logger.error('Product', 'Bitrix API error', { error })
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }
})

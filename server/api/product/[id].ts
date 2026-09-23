import { logger } from '../../utils/logger'
import { resolveIsDealerFromEvent } from '../../utils/dealerCheck'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { getHiddenProductIds } from '../../utils/productVisibility'
import { isLowStock } from '../../utils/lowStock'

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

      // Hidden on the website. 404 rather than render: hiding it from the
      // listings but leaving the URL live would only half-hide it.
      if ((await getHiddenProductIds()).has(String(id))) {
        throw createError({ statusCode: 404, statusMessage: 'Product not found' })
      }

      product.PROPERTY_102 = normalizeProperty(product.PROPERTY_102)
      product.PROPERTY_104 = normalizeProperty(product.PROPERTY_104)
      product.PROPERTY_112 = normalizeProperty(product.PROPERTY_112)

      if (isDealer) {
        const dealerPrice = parseBitrixPrice(normalizeProperty(product.PROPERTY_184))
        if (dealerPrice !== null) product.dealerPrice = dealerPrice
      }

      // The mirrored Cloudinary URL, which the Bitrix payload knows nothing
      // about. Without this the detail page falls all the way through to the
      // placeholder for any product whose picture only exists in the mirror.
      //
      // Stock rides the same query: the flag goes out, the count does not.
      product.lowStock = false
      try {
        const supabase = getSupabaseAdminClient()
        const { data } = await supabase
          .from('products')
          .select('image_url, quantity')
          .eq('id', String(id))
          .maybeSingle()
        const row = data as { image_url?: string | null; quantity?: number | null } | null
        if (row?.image_url) product.imageUrl = row.image_url
        product.lowStock = isLowStock(row?.quantity)
      } catch {
        // A missing picture or badge is a worse page, not a broken one.
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

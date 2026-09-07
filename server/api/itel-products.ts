import { logger } from '../utils/logger'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const brand = ((query.brand as string) || 'itel').toLowerCase()

  let isDealer = false
  try {
    const user = await serverSupabaseUser(event)
    if (user) {
      const supabase = await serverSupabaseServiceRole(event)
      const { data: profile } = (await supabase
        .from('profiles')
        .select('role, dealer_status')
        .eq('user_id', getAuthUserId(user) ?? '')
        .single()) as { data: { role: string; dealer_status: string } | null }

      if (profile && profile.role === 'dealer' && profile.dealer_status === 'approved') {
        isDealer = true
      }
    }
  } catch (err) {
    // Ignore errors for unauthenticated users
  }

  interface BitrixItelProduct {
    ID?: string | number
    NAME?: string
    PRICE?: string | number
    PROPERTY_184?: unknown
    QUANTITY?: string | number
    CURRENCY_ID?: string
    SECTION_ID?: string | number
    ACTIVE?: string
    PROPERTY_102?: unknown
    PROPERTY_104?: unknown
    PROPERTY_112?: unknown
    DETAIL_PICTURE?: unknown
    PREVIEW_PICTURE?: unknown
    PROPERTY_44?: unknown
    [key: string]: unknown
  }

  const itelProducts: BitrixItelProduct[] = []

  try {
    // ─── PHASE 1: Fetch products matching the dynamic brand (IDs and basic metadata) ───
    const listResponse = await fetchWithBitrixContext<{ result?: BitrixItelProduct[] }>(event, 'crm.product.list', {
      query: {
        'filter[%NAME]': brand,
        'filter[ACTIVE]': 'Y',
        'select[]': [
          'ID',
          'NAME',
          'PRICE',
          'PROPERTY_184',
          'QUANTITY',
          'CURRENCY_ID',
          'SECTION_ID',
          'ACTIVE',
          'PROPERTY_102',
          'PROPERTY_104',
          'PROPERTY_112',
          'DETAIL_PICTURE',
          'PREVIEW_PICTURE',
          'PROPERTY_44',
        ],
      },
    })

    if (listResponse.result && Array.isArray(listResponse.result)) {
      itelProducts.push(...listResponse.result)
    }
  } catch (error) {
    logger.error('Itel Products', 'Bitrix list phase failed', { error })
    return []
  }

  // ─── Normalize properties and return ───
  // PROPERTY_102 contains Cloudinary image URLs directly from crm.product.list,
  // so no secondary batch fetch is needed.
  return itelProducts.map((product) => {
    const productObj: any = {
      ...product,
      ACTIVE: product.ACTIVE,
      DETAIL_PICTURE: product.DETAIL_PICTURE || null,
      PREVIEW_PICTURE: product.PREVIEW_PICTURE || null,
      PROPERTY_44: normalizeProperty(product.PROPERTY_44),
      PROPERTY_102: normalizeProperty(product.PROPERTY_102),
      PROPERTY_104: normalizeProperty(product.PROPERTY_104),
      PROPERTY_112: normalizeProperty(product.PROPERTY_112),
    }

    if (isDealer) {
      const dealerPrice = parseBitrixPrice(normalizeProperty(product.PROPERTY_184))
      if (dealerPrice !== null) productObj.dealerPrice = dealerPrice
    }

    delete productObj.PROPERTY_184
    return productObj
  })
})

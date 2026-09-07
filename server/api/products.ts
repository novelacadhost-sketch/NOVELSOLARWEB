import { logger } from '../utils/logger'
import { getSupabaseAdminClient } from '../utils/supabaseAdmin'
import { resolveIsDealerFromEvent } from '../utils/dealerCheck'
import { fetchWithBitrixContext } from '../utils/bitrixAuth'
import { normalizeProperty } from '../utils/normalizeProperty'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const query = getQuery(event)
  const searchTerm = ((query.q as string) || '').trim().toLowerCase()
  const brandFilter = ((query.brand as string) || '').trim()
  const parsedStart = Number.parseInt((query.start as string) || '0', 10)
  const startFrom = Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : 0
  const PAGE_SIZE = 50

  const isDealer = await resolveIsDealerFromEvent(event)

  interface MappedProduct {
    ID?: string | number
    NAME?: string
    PRICE?: string | number
    CURRENCY_ID?: string
    DESCRIPTION: string
    QUANTITY?: string | number
    ACTIVE?: string
    imageUrl: string
    PROPERTY_102: string | null
    PROPERTY_104: string | null
    PROPERTY_112: string | null
    dealerPrice?: number
  }

  const mapProduct = (p: any, fromDb = true): MappedProduct => {
    let raw: any
    let id, name, price, active, quantity, description, currency

    if (fromDb) {
      raw = p.raw || {}
      id = p.id
      name = p.name
      price = p.price
      active = p.active ? 'Y' : 'N'
      quantity = p.quantity
      description = p.description
      currency = raw.CURRENCY_ID
    } else {
      raw = p
      id = p.ID
      name = p.NAME
      price = p.PRICE
      active = p.ACTIVE
      quantity = p.QUANTITY
      description = normalizeProperty(p.DESCRIPTION)
      currency = p.CURRENCY_ID
    }

    let imageUrl = null
    const cloudinaryUrl = normalizeProperty(raw.PROPERTY_102)
    if (cloudinaryUrl) {
      imageUrl = cloudinaryUrl as string
    } else {
      const bitrixImage =
        normalizeProperty(raw.PROPERTY_44) ||
        normalizeProperty(raw.PREVIEW_PICTURE) ||
        normalizeProperty(raw.DETAIL_PICTURE)
      if (bitrixImage) {
        imageUrl = `/api/bitrix-image?url=${encodeURIComponent(bitrixImage as string)}`
      }
    }

    const productObj: MappedProduct = {
      ID: id as string | number,
      NAME: name,
      PRICE: price,
      CURRENCY_ID: currency,
      DESCRIPTION: String(description || ''),
      QUANTITY: quantity,
      ACTIVE: active,
      imageUrl: imageUrl || '/images/placeholder.png',
      PROPERTY_102: normalizeProperty(raw.PROPERTY_102), // Cloudinary URL
      PROPERTY_104: normalizeProperty(raw.PROPERTY_104), // Specs
      PROPERTY_112: normalizeProperty(raw.PROPERTY_112), // Gallery
    }

    if (isDealer) {
      const rawDP = p.PROPERTY_184?.value ?? p.PROPERTY_184 ?? p.dealer_price
      if (rawDP !== undefined && rawDP !== null && rawDP !== '') {
        productObj.dealerPrice = Number(rawDP)
      }
    }

    return productObj
  }

  // PRIMARY PATH: BITRIX
  try {
    const filters: Record<string, string> = {}
    filters.ACTIVE = 'Y'
    if (brandFilter && searchTerm) {
      filters['%NAME'] = `${brandFilter} ${searchTerm}`.trim()
    } else if (brandFilter) {
      filters['%NAME'] = brandFilter
    } else if (searchTerm) {
      filters['?NAME'] = searchTerm
    }

    const response = await fetchWithBitrixContext<{
      result?: any[] | { products?: any[] }
      total?: number
      next?: number
      error?: string
      error_description?: string
    }>(event, 'crm.product.list', {
      method: 'POST',
      body: {
        filter: filters,
        select: [
          'ID',
          'NAME',
          'PRICE',
          'PROPERTY_184',
          'CURRENCY_ID',
          'DESCRIPTION',
          'QUANTITY',
          'ACTIVE',
          'PREVIEW_PICTURE',
          'DETAIL_PICTURE',
          'PROPERTY_44',
          'PROPERTY_102',
          'PROPERTY_104',
          'PROPERTY_112',
        ],
        order: { ID: 'DESC' },
        start: startFrom,
        limit: PAGE_SIZE,
      },
    })

    if (response?.error) {
      throw new Error(response.error_description || response.error)
    }

    const bitrixProducts = Array.isArray(response?.result)
      ? response.result
      : Array.isArray(response?.result?.products)
        ? response.result.products
        : []

    if (bitrixProducts.length === 0) {
      return {
        products: [],
        next: null,
        total: response?.total || 0,
        count: 0,
      }
    }

    const products = bitrixProducts.map((p) => mapProduct(p, false))
    const nextStart =
      typeof response?.next === 'number'
        ? response.next
        : startFrom + PAGE_SIZE < (response?.total || 0)
          ? startFrom + PAGE_SIZE
          : null

    return {
      products,
      next: nextStart,
      total: response?.total || 0,
      count: products.length,
    }
  } catch (error) {
    logger.warn('Products', 'Bitrix unavailable, falling back to Supabase', { error })
  }

  // FALLBACK PATH: SUPABASE
  const supabase = getSupabaseAdminClient()

  try {
    let dbQuery = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('active', true)
      .order('id', { ascending: false })

    if (brandFilter && searchTerm) {
      dbQuery = dbQuery.ilike('name', `%${brandFilter} ${searchTerm}%`)
    } else if (brandFilter) {
      dbQuery = dbQuery.ilike('name', `%${brandFilter}%`)
    } else if (searchTerm) {
      dbQuery = dbQuery.ilike('name', `%${searchTerm}%`)
    }

    dbQuery = dbQuery.range(startFrom, startFrom + PAGE_SIZE - 1)

    const { data, count, error } = await dbQuery

    if (error) {
      throw error
    }

    const products = (data || []).map((p) => mapProduct(p, true))
    const totalCount = count || 0
    const nextStart = startFrom + PAGE_SIZE < totalCount ? startFrom + PAGE_SIZE : null

    return {
      products,
      next: nextStart,
      total: totalCount,
      count: products.length,
    }
  } catch (fallbackError) {
    logger.error('Products', 'Supabase fallback failed', { error: fallbackError })
    throw createError({
      statusCode: 503,
      statusMessage: 'Product catalog temporarily unavailable.',
    })
  }
})

import { logger } from '../utils/logger'
import { getSupabaseAdminClient } from '../utils/supabaseAdmin'
import { resolveIsDealerFromEvent } from '../utils/dealerCheck'
import { bitrixFetch } from '../utils/bitrixAuth'
import { normalizeProperty } from '../utils/normalizeProperty'
import { getSectionMap } from '../utils/bitrixSections'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const query = getQuery(event)
  // Services are not merchandise; the services pages opt back in with
  // ?includeServices=1. Excluded by SECTION rather than by name — see
  // inventory.get.ts for why the old keyword filter was unreliable.
  const includeServices = String(query.includeServices ?? '') === '1'
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

  // Pictures mirrored from Bitrix into Cloudinary live on products.image_url,
  // which this endpoint never consulted — so a product whose only photo came
  // through the mirror got the Bitrix proxy URL built below instead, and that
  // is a RELATIVE portal path the proxy cannot resolve. Hence the empty card.
  const mirroredImages = new Map<string, string>()
  const loadMirroredImages = async (ids: string[]) => {
    if (!ids.length) return
    try {
      const supabase = getSupabaseAdminClient()
      const { data } = await supabase.from('products').select('id, image_url').in('id', ids)
      for (const row of (data ?? []) as { id: string; image_url: string | null }[]) {
        if (row.image_url) mirroredImages.set(String(row.id), row.image_url)
      }
    } catch {
      // A missing picture is a worse card, not a broken shop.
    }
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

    let imageUrl: string | null = mirroredImages.get(String(id)) ?? (p?.image_url as string | null) ?? null
    const cloudinaryUrl = imageUrl ? null : normalizeProperty(raw.PROPERTY_102)
    if (cloudinaryUrl) {
      imageUrl = cloudinaryUrl as string
    } else if (!imageUrl) {
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
      // parseBitrixPrice handles the "12000|NGN" money format; the previous
      // bare Number() produced NaN, which serialises to null.
      const rawDP = p.PROPERTY_184?.value ?? p.PROPERTY_184 ?? p.dealer_price
      const dealerPrice = parseBitrixPrice(rawDP)
      if (dealerPrice !== null) {
        productObj.dealerPrice = dealerPrice
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

    const response = await bitrixFetch<{
      result?: any[] | { products?: any[] }
      total?: number
      next?: number
      error?: string
      error_description?: string
    }>('crm.product.list', {
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

    await loadMirroredImages(bitrixProducts.map((p) => String(p.ID)))
    const sectionNames = await getSectionMap()
    const visible = includeServices
      ? bitrixProducts
      : bitrixProducts.filter((p) => {
          const id = p.SECTION_ID != null ? String(p.SECTION_ID) : ''
          return (sectionNames.get(id) ?? '').toUpperCase() !== 'SERVICES'
        })
    const products = visible.map((p) => mapProduct(p, false))
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

    const rows = includeServices
      ? data || []
      : (data || []).filter((p) => String((p as { section_name?: string }).section_name ?? '').toUpperCase() !== 'SERVICES')
    const products = rows.map((p) => mapProduct(p, true))
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

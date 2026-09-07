import { createHash } from 'node:crypto'
import { logger } from '../utils/logger'
import { getSupabaseAdminClient } from '../utils/supabaseAdmin'
import { resolveIsDealerFromEvent } from '../utils/dealerCheck'
import { fetchAllBitrixProducts } from '../utils/fetchAllBitrixProducts'
import { normalizeProperty } from '../utils/normalizeProperty'

export default defineCachedEventHandler(
  async (event) => {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')

    const isDealer = await resolveIsDealerFromEvent(event)
    const queryParams = getQuery(event)
    const q = ((queryParams.q as string) || '').trim()
    const brand = ((queryParams.brand as string) || '').trim()
    const start = Number.parseInt((queryParams.start as string) || '0', 10) || 0

    interface MappedProduct {
      ID: string | number
      NAME: string | undefined
      PRICE: string | number | undefined
      imageUrl: string | null
      PROPERTY_102: string | null
      PROPERTY_104: string | null
      PROPERTY_112: string | null
      dealerPrice?: number
      [key: string]: unknown
    }

    const mapProduct = (p: any, fromDb = true): MappedProduct => {
      let raw: any
      let id, name, price, active

      if (fromDb) {
        raw = p.raw || {}
        id = p.id
        name = p.name
        price = p.price
        active = p.active ? 'Y' : 'N'
      } else {
        raw = p
        id = p.ID
        name = p.NAME
        price = p.PRICE
        active = p.ACTIVE
      }

      const productObj: MappedProduct = {
        ...raw,
        ID: id as string | number,
        NAME: name,
        PRICE: price,
        ACTIVE: active,
        DETAIL_PICTURE: raw.DETAIL_PICTURE || null,
        PREVIEW_PICTURE: raw.PREVIEW_PICTURE || null,
        imageUrl: null, // As previously hardcoded
        PROPERTY_44: normalizeProperty(raw.PROPERTY_44),
        PROPERTY_102: normalizeProperty(raw.PROPERTY_102),
        PROPERTY_104: normalizeProperty(raw.PROPERTY_104),
        PROPERTY_112: normalizeProperty(raw.PROPERTY_112),
      }

      if (isDealer) {
        // parseBitrixPrice, not Number(): ~2% of dealer prices are stored in
        // Bitrix's money format ("12000|NGN"), which Number() turns into NaN.
        // Those products silently fell back to retail.
        const dealerPrice = parseBitrixPrice(normalizeProperty(raw.PROPERTY_184) ?? p.dealer_price)
        if (dealerPrice !== null) {
          productObj.dealerPrice = dealerPrice
        }
      }

      delete productObj.PROPERTY_184
      return productObj
    }

    // PRIMARY PATH: BITRIX
    try {
      const allBitrixProducts = await fetchAllBitrixProducts(event)

      let filtered = allBitrixProducts.filter((p) => p.ACTIVE === 'Y')

      if (brand && q) {
        filtered = filtered.filter(
          (p) => p.NAME && String(p.NAME).toLowerCase().includes(`${brand.toLowerCase()} ${q.toLowerCase()}`),
        )
      } else if (brand) {
        filtered = filtered.filter((p) => p.NAME && String(p.NAME).toLowerCase().includes(brand.toLowerCase()))
      } else if (q) {
        filtered = filtered.filter((p) => p.NAME && String(p.NAME).toLowerCase().includes(q.toLowerCase()))
      }

      // ordered by id descending
      filtered.sort((a, b) => Number(b.ID) - Number(a.ID))

      const paginated = filtered.slice(start, start + 50)
      return paginated.map((p) => mapProduct(p, false))
    } catch (error) {
      logger.warn('Inventory', 'Bitrix unavailable, falling back to Supabase', { error })
    }

    // FALLBACK PATH: SUPABASE
    const supabase = getSupabaseAdminClient()

    try {
      let query = supabase.from('products').select('*').eq('active', true).order('id', { ascending: false })

      if (brand && q) {
        query = query.ilike('name', `%${brand} ${q}%`)
      } else if (brand) {
        query = query.ilike('name', `%${brand}%`)
      } else if (q) {
        query = query.ilike('name', `%${q}%`)
      }

      // start (for pagination, range of 50)
      query = query.range(start, start + 49)

      const { data, error } = await query

      if (error) {
        throw error
      }

      return (data || []).map((p) => mapProduct(p, true))
    } catch (fallbackError) {
      logger.error('Inventory', 'Supabase fallback failed', { error: fallbackError })
      throw createError({ statusCode: 503, statusMessage: 'Product catalog temporarily unavailable.' })
    }
  },
  {
    // The key previously varied only by pricing tier, so every search and
    // every page collapsed onto the same two entries — a query for "inverter"
    // was served the unfiltered first page. q/brand/start must be part of the
    // key because they change the response body.
    getKey: async (event) => {
      const isDealer = await resolveIsDealerFromEvent(event)
      const query = getQuery(event)

      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
      const start = Number.parseInt(String(query.start ?? '0'), 10) || 0

      // Free text is user input, so hash it rather than letting arbitrary
      // characters into a cache storage key. JSON-encoded as a pair so the
      // boundary is unambiguous — plain concatenation would make
      // ("ab", "c") and ("a", "bc") share a key.
      const filters = createHash('sha1')
        .update(JSON.stringify([norm(query.brand), norm(query.q)]))
        .digest('hex')
        .slice(0, 16)

      return `inventory-v3:${isDealer ? 'dealer' : 'retail'}:${filters}:${start}`
    },
    // Was relying on Nitro's defaults, which serve a stale entry indefinitely
    // while revalidating — that is why the wrong results persisted rather than
    // expiring. Five minutes is a reasonable staleness window for a catalog.
    maxAge: 300,
    swr: true,
    staleMaxAge: 60,
  },
)

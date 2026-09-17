import { createHash } from 'node:crypto'
import { logger } from '../utils/logger'
import { getSupabaseAdminClient } from '../utils/supabaseAdmin'
import { resolveIsDealerFromEvent } from '../utils/dealerCheck'
import { fetchAllBitrixProducts } from '../utils/fetchAllBitrixProducts'
import { normalizeProperty } from '../utils/normalizeProperty'
import { getSectionMap } from '../utils/bitrixSections'
import { getHiddenProductIds, getVisibilityVersion } from '../utils/productVisibility'

export default defineCachedEventHandler(
  async (event) => {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')

    const isDealer = await resolveIsDealerFromEvent(event)
    const queryParams = getQuery(event)
    const q = ((queryParams.q as string) || '').trim()
    const brand = ((queryParams.brand as string) || '').trim()
    const start = Number.parseInt((queryParams.start as string) || '0', 10) || 0

    // Comma-separated Bitrix section names. The client owns the merchandising —
    // which sections make up "Inverters" lives in app/utils/productCategories.ts
    // — so the server only has to filter on what it is given. Filtering happens
    // BEFORE pagination, which is the whole point: the category pages used to
    // fetch one 50-product page and filter it client-side, so "Inverters"
    // showed however many inverters happened to fall in an arbitrary first 50.
    // Services are not merchandise — installation, de-commissioning, logistics,
    // the "OLD ... DISCOUNTED" trade-ins, and oddments like Cement and CHARCOAL.
    // They are excluded from product listings by default. The services pages opt
    // back in, since finding a service by slug is the one thing that needs them.
    //
    // Excluded by SECTION, not by name. The keyword filter this replaces
    // (audit|installation|repair|maintenance) caught 10 of the 23 and would
    // wrongly drop a real product called something like "Repair Kit".
    const includeServices = String(queryParams.includeServices ?? '') === '1'

    // Hidden by an admin on the website only; Bitrix still lists them.
    const hidden = await getHiddenProductIds()

    const sectionFilter = new Set(
      String(queryParams.sections ?? '')
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    )

    interface MappedProduct {
      ID: string | number
      NAME: string | undefined
      PRICE: string | number | undefined
      imageUrl: string | null
      PROPERTY_102: string | null
      PROPERTY_104: string | null
      PROPERTY_112: string | null
      sectionId: string | null
      sectionName: string | null
      dealerPrice?: number
      [key: string]: unknown
    }

    // Cached for five minutes inside getSectionMap, so this is one Bitrix call
    // per cache window rather than per request, and it never throws.
    const sectionNames = await getSectionMap()

    const sectionOf = (p: any, raw: any): { id: string | null; name: string | null } => {
      const rawId = p?.section_id ?? raw?.SECTION_ID
      const id = rawId != null && rawId !== '' ? String(rawId) : null
      if (!id) return { id: null, name: null }
      return { id, name: p?.section_name ?? sectionNames.get(id) ?? null }
    }

    // One lookup for the whole page rather than per product. Empty on failure:
    // a missing picture is a worse card, not a broken shop.
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
        // deliberately silent — see above
      }
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
        // The mirrored Cloudinary URL. Previously hardcoded null, which meant
        // the mirror was written to products.image_url and then never read:
        // both product read paths are Bitrix-primary, and only the rarely-used
        // Supabase fallback ever saw that column.
        imageUrl: (p?.image_url as string | null) ?? mirroredImages.get(String(id)) ?? null,
        PROPERTY_44: normalizeProperty(raw.PROPERTY_44),
        PROPERTY_102: normalizeProperty(raw.PROPERTY_102),
        PROPERTY_104: normalizeProperty(raw.PROPERTY_104),
        PROPERTY_112: normalizeProperty(raw.PROPERTY_112),
        // The catalogue's real category. Resolved on BOTH paths: the Bitrix
        // payload carries only SECTION_ID, so the name comes from the section
        // map (one cached lookup per request). Without this the primary path
        // would return unnamed categories and the shop would group nothing,
        // while the rarely-used fallback path worked — the worst way round.
        //
        // Group on the NAME, not the id: these sections were deleted from the
        // portal and re-added, which changed every id.
        sectionId: sectionOf(p, raw).id,
        sectionName: sectionOf(p, raw).name,
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

      if (sectionFilter.size) {
        filtered = filtered.filter((p) => {
          const name = sectionOf(p, p).name
          return name ? sectionFilter.has(name.toLowerCase()) : false
        })
      }

      if (!includeServices) {
        filtered = filtered.filter((p) => (sectionOf(p, p).name ?? '').toUpperCase() !== 'SERVICES')
      }

      if (hidden.size) {
        filtered = filtered.filter((p) => !hidden.has(String(p.ID)))
      }

      // ordered by id descending
      filtered.sort((a, b) => Number(b.ID) - Number(a.ID))

      const paginated = filtered.slice(start, start + 50)
      await loadMirroredImages(paginated.map((p) => String(p.ID)))
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

      if (sectionFilter.size) {
        query = query.in('section_name', [...sectionFilter].map((n) => n))
      }

      if (!includeServices) {
        // or(): a product with no section must still be listed.
        query = query.or('section_name.is.null,section_name.neq.SERVICES')
      }

      if (hidden.size) {
        query = query.not('id', 'in', `(${[...hidden].join(',')})`)
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

      const sections = String(query.sections ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9,&\- ]/g, '')
        .slice(0, 120)
      const svc = String(query.includeServices ?? '') === '1' ? 'svc' : 'nosvc'
      // Without the visibility version a product stays in the cached page for
      // five minutes after being hidden.
      const vis = await getVisibilityVersion()
      return `inventory-v5:${isDealer ? 'dealer' : 'retail'}:${filters}:${sections}:${svc}:${vis}:${start}`
    },
    // Was relying on Nitro's defaults, which serve a stale entry indefinitely
    // while revalidating — that is why the wrong results persisted rather than
    // expiring. Five minutes is a reasonable staleness window for a catalog.
    maxAge: 300,
    swr: true,
    staleMaxAge: 60,
  },
)

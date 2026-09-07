import type { H3Event } from 'h3'
import { fetchWithBitrixContext } from './bitrixAuth'
import { logger } from './logger'
import type { BitrixProduct } from './normalizeBitrixProduct'

export async function fetchAllBitrixProducts(event: H3Event): Promise<BitrixProduct[]> {
  const allProducts: BitrixProduct[] = []

  let start = 0
  let hasMore = true

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => {
    abortController.abort()
  }, 30000)

  try {
    while (hasMore) {
      const endpoint = `crm.product.list${start > 0 ? `?start=${start}` : ''}`

      const response = await fetchWithBitrixContext<{ result: BitrixProduct[]; next?: number }>(event, endpoint, {
        method: 'POST',
        body: {
          limit: 50,
          filter: { ACTIVE: 'Y' },
          select: [
            'ID',
            'NAME',
            'PRICE',
            'QUANTITY',
            'CURRENCY_ID',
            'SECTION_ID',
            'ACTIVE',
            'PROPERTY_102',
            'PROPERTY_104',
            'PROPERTY_112',
            'PROPERTY_184',
            'DETAIL_PICTURE',
            'PREVIEW_PICTURE',
            'PROPERTY_44',
          ],
        },
        signal: abortController.signal,
      })

      if (response?.result && Array.isArray(response.result)) {
        allProducts.push(...response.result)
        logger.info('ProductSync', `Fetched ${allProducts.length} products so far...`)
      }

      if (typeof response?.next === 'number') {
        start = response.next
      } else {
        hasMore = false
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || abortController.signal.aborted) {
      throw new Error('Bitrix catalog fetch timed out after 30s')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  return allProducts
}

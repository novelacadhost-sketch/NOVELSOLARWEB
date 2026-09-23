import { bitrixFetch } from './bitrixAuth'
import { BITRIX_CATALOG } from './bitrixProperties'

/**
 * Stock levels from the Bitrix catalog module.
 *
 * The CRM product endpoints this app otherwise uses never return QUANTITY, so
 * this is the only source of a real number. `quantity` here is the TOTAL across
 * every warehouse — deliberately: a branch that is short gets a transfer from
 * another, so what matters at checkout is whether the company has it at all.
 */

export interface CatalogStock {
  /** Total on hand across all warehouses. Null when the catalog tracks none. */
  quantity: number | null
  /** Services are never stock-limited; see BITRIX_CATALOG.TYPE_SERVICE. */
  isService: boolean
}

interface CatalogProductRow {
  id: number
  iblockId: number
  type?: number
  quantity?: number | string | null
}

interface CatalogListResponse {
  result?: { products?: CatalogProductRow[] }
  next?: number
  error?: string
  error_description?: string
}

const PAGE_SIZE = 50

function toStock(row: CatalogProductRow): CatalogStock {
  const raw = row.quantity
  const quantity = raw === null || raw === undefined || raw === '' ? null : Number(raw)
  return {
    quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null,
    isService: Number(row.type) === BITRIX_CATALOG.TYPE_SERVICE,
  }
}

/**
 * Stock for the given product ids, or for the whole catalog when none are
 * passed. Ids the catalog does not know are simply absent from the map.
 *
 * Throws on a Bitrix error. Callers choose what an outage means: checkout
 * lets the order through, the mirror sync leaves quantities as they were.
 */
export async function fetchCatalogStock(ids?: Array<string | number>): Promise<Map<string, CatalogStock>> {
  const filter: Record<string, unknown> = { iblockId: BITRIX_CATALOG.IBLOCK_ID }
  if (ids) {
    if (ids.length === 0) return new Map()
    filter.id = ids.map(Number)
  }

  const stock = new Map<string, CatalogStock>()
  let start = 0

  for (;;) {
    const response = await bitrixFetch<CatalogListResponse>('catalog.product.list', {
      method: 'POST',
      body: { select: ['id', 'iblockId', 'type', 'quantity'], filter, start },
    })
    if (response.error) throw new Error(response.error_description || String(response.error))

    const page = response.result?.products ?? []
    for (const row of page) stock.set(String(row.id), toStock(row))

    if (response.next === undefined || page.length < PAGE_SIZE) break
    start = response.next
  }

  return stock
}

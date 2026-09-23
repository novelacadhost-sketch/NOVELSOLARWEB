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
  name: string | null
  /** Total on hand across all warehouses. Null when the catalog tracks none. */
  quantity: number | null
  /** Services are never stock-limited; see BITRIX_CATALOG.TYPE_SERVICE. */
  isService: boolean
}

interface CatalogProductRow {
  id: number
  iblockId: number
  name?: string | null
  type?: number
  quantity?: number | string | null
}

interface CatalogListResponse {
  result?: { products?: CatalogProductRow[] }
  next?: number
  total?: number
  error?: string
  error_description?: string
}

interface BatchResponse {
  result?: {
    result?: Record<string, { products?: CatalogProductRow[] }>
    result_error?: Record<string, unknown> | unknown[]
  }
  error?: string
  error_description?: string
}

const PAGE_SIZE = 50
/** Bitrix accepts at most 50 commands per batch call. */
const BATCH_LIMIT = 50
const SELECT = ['id', 'iblockId', 'name', 'type', 'quantity']

/**
 * The value the product mirror stores. Services and products the catalog
 * tracks no number for store null, which every reader — the app, and the
 * place_order_from_cart RPC — treats as "not stock-limited".
 */
export function mirrorQuantity(stock: CatalogStock | undefined): number | null {
  return stock && !stock.isService ? stock.quantity : null
}

function toStock(row: CatalogProductRow): CatalogStock {
  const raw = row.quantity
  const quantity = raw === null || raw === undefined || raw === '' ? null : Number(raw)
  return {
    name: row.name ? String(row.name).trim() : null,
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
      body: { select: SELECT, filter, start },
    })
    if (response.error) throw new Error(response.error_description || String(response.error))

    const page = response.result?.products ?? []
    for (const row of page) stock.set(String(row.id), toStock(row))

    if (response.next === undefined || page.length < PAGE_SIZE) break
    start = response.next
  }

  return stock
}

function listCommand(start: number): string {
  const query = new URLSearchParams()
  for (const field of SELECT) query.append('select[]', field)
  query.append('filter[iblockId]', String(BITRIX_CATALOG.IBLOCK_ID))
  query.append('start', String(start))
  return `catalog.product.list?${query.toString()}`
}

/**
 * Stock for the WHOLE catalog, for the mirror sync.
 *
 * Paging one call at a time takes about 10 seconds for ~1160 products, which
 * the sync cannot spare inside a 60-second function that also runs image
 * discovery. So: one call for the first page, which reports the total, then
 * every remaining page in a single `batch` request — two round trips in all.
 *
 * All or nothing. If any page fails this throws rather than returning a partial
 * map, because the sync writes a quantity for every row it has, and a product
 * missing from a partial map would have its stock overwritten with null.
 */
export async function fetchAllCatalogStock(): Promise<Map<string, CatalogStock>> {
  const first = await bitrixFetch<CatalogListResponse>('catalog.product.list', {
    method: 'POST',
    body: { select: SELECT, filter: { iblockId: BITRIX_CATALOG.IBLOCK_ID }, start: 0 },
  })
  if (first.error) throw new Error(first.error_description || String(first.error))

  const stock = new Map<string, CatalogStock>()
  for (const row of first.result?.products ?? []) stock.set(String(row.id), toStock(row))

  const total = Number(first.total ?? 0)
  const starts: number[] = []
  for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) starts.push(start)

  for (let i = 0; i < starts.length; i += BATCH_LIMIT) {
    const chunk = starts.slice(i, i + BATCH_LIMIT)
    const cmd: Record<string, string> = {}
    chunk.forEach((start, index) => {
      cmd[`p${index}`] = listCommand(start)
    })

    const response = await bitrixFetch<BatchResponse>('batch', { method: 'POST', body: { halt: 1, cmd } })
    if (response.error) throw new Error(response.error_description || String(response.error))

    const errors = response.result?.result_error
    const failed = Array.isArray(errors) ? errors.length : Object.keys(errors ?? {}).length
    if (failed) throw new Error(`${failed} catalog page(s) failed in batch`)

    const results = response.result?.result ?? {}
    chunk.forEach((_, index) => {
      for (const row of results[`p${index}`]?.products ?? []) stock.set(String(row.id), toStock(row))
    })
  }

  if (total && stock.size < total) {
    throw new Error(`Catalog returned ${stock.size} of ${total} products`)
  }
  return stock
}

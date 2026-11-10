import type { H3Event } from 'h3'
import { bitrixFetch } from './bitrixAuth'
import { logger } from './logger'
import type { BitrixProduct } from './normalizeBitrixProduct'

const SELECT = [
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
]
const PAGE_SIZE = 50
// Bitrix runs at most 50 commands per batch call.
const BATCH_LIMIT = 50

/**
 * One copy of the catalogue per server instance, shared by every inventory
 * query. The inventory response cache is keyed by query, so before this each
 * new search, brand or page on a fresh instance re-read all ~1,270 products.
 * Fresh for FRESH_MS; after that a request still gets the old copy at once
 * while a refresh runs, up to STALE_MS, beyond which it waits for new data.
 */
const FRESH_MS = 5 * 60_000
const STALE_MS = 30 * 60_000
let cache: { at: number; products: BitrixProduct[] } | null = null
let inFlight: Promise<BitrixProduct[]> | null = null

export async function fetchAllBitrixProducts(_event?: H3Event): Promise<BitrixProduct[]> {
  const age = cache ? Date.now() - cache.at : Infinity
  if (cache && age < FRESH_MS) return cache.products
  if (cache && age < STALE_MS) {
    refresh().catch((error) => logger.warn('ProductSync', 'Background catalogue refresh failed', { error }))
    return cache.products
  }
  return refresh()
}

function refresh(): Promise<BitrixProduct[]> {
  inFlight ??= readCatalogue()
    .then((products) => {
      cache = { at: Date.now(), products }
      return products
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/**
 * Page one tells us the total; every other page goes out in one `batch` call
 * (two past 2,550 products). Measured 2026-11-10: 1,268 products in 2.9s,
 * against 11.6s for 26 sequential pages. Batch commands must be
 * `method?query` strings: Bitrix silently ignores commands given as objects.
 */
async function readCatalogue(): Promise<BitrixProduct[]> {
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), 30000)

  try {
    const first = await bitrixFetch<{ result: BitrixProduct[]; total?: number }>('crm.product.list', {
      method: 'POST',
      body: { start: 0, filter: { ACTIVE: 'Y' }, select: SELECT },
      signal: abortController.signal,
    })
    const products = [...(first?.result ?? [])]
    const total = Number(first?.total ?? products.length)

    const commands: Record<string, string>[] = []
    for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
      const query = new URLSearchParams([
        ['start', String(start)],
        ['filter[ACTIVE]', 'Y'],
        ...SELECT.map((field) => ['select[]', field]),
      ])
      const chunk = Math.floor((start / PAGE_SIZE - 1) / BATCH_LIMIT)
      commands[chunk] ??= {}
      commands[chunk][`p${start}`] = `crm.product.list?${query}`
    }

    for (const cmd of commands) {
      const response = await bitrixFetch<{
        result: { result: Record<string, BitrixProduct[]>; result_error: Record<string, unknown> | unknown[] }
      }>('batch', {
        method: 'POST',
        body: { halt: 1, cmd },
        signal: abortController.signal,
      })
      const errors = response?.result?.result_error
      if (errors && Object.keys(errors).length) {
        throw new Error(`Bitrix batch page failed: ${JSON.stringify(errors).slice(0, 300)}`)
      }
      for (const key of Object.keys(cmd)) {
        const page = response?.result?.result?.[key]
        if (!Array.isArray(page)) throw new Error(`Bitrix batch returned no rows for ${key}`)
        products.push(...page)
      }
    }

    // A short read would quietly hide products from the shop; fail instead, so
    // the caller falls back to the Supabase mirror.
    if (products.length < total) throw new Error(`Bitrix catalogue read ${products.length} of ${total} products`)
    logger.info('ProductSync', `Fetched ${products.length} products`)
    return products
  } catch (error: any) {
    if (error.name === 'AbortError' || abortController.signal.aborted) {
      throw new Error('Bitrix catalog fetch timed out after 30s')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

import { bitrixFetch } from './bitrixAuth'
import { BITRIX_BRANCH_LIST } from './bitrixProperties'

/**
 * Branch -> the catalog store (warehouse) its orders are fulfilled from.
 *
 * The warehouse on a deal's product line cannot be set over REST (see
 * branchManagerNotify.ts), so the best the website can do is name the right one
 * on the deal, for whoever picks it by hand.
 *
 * The rule is the same as `resolveStoreByName` in the inventory repo: the
 * branch NAME must equal a store title, ignoring case and spacing. It is not a
 * second copy of that repo's web-branch-map.csv, so there is no mapping here
 * to go stale. Checked 2026-10-16: all 37 Novel Solar branches resolve; Novel
 * Homes Oyo (19094) has no store yet. No match, or more than one, resolves to
 * null; naming a wrong warehouse would be worse than naming none.
 */

export interface BranchStore {
  id: number
  title: string
}

const normalise = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// ~51 rows that change rarely. Short TTL so a new store is picked up without a redeploy.
const STORE_CACHE_TTL_MS = 60_000
let storeCache: { at: number; stores: BranchStore[] } | null = null

async function fetchStores(): Promise<BranchStore[]> {
  if (storeCache && Date.now() - storeCache.at < STORE_CACHE_TTL_MS) return storeCache.stores

  // Every page: one call returns 50 and the portal passed that in October 2026,
  // which made the newest warehouse invisible to the lookup.
  const stores: BranchStore[] = []
  let start = 0
  for (let page = 0; page < 10; page++) {
    const response = await bitrixFetch<{
      result?: { stores?: { id: number; title: string; active?: string }[] }
      next?: number
    }>('catalog.store.list', { method: 'POST', body: { select: ['id', 'title', 'active'], start } })
    for (const s of response.result?.stores ?? []) {
      if (s.active !== 'N') stores.push({ id: Number(s.id), title: String(s.title).trim() })
    }
    if (response.next === undefined || response.next === null) break
    start = response.next
  }

  storeCache = { at: Date.now(), stores }
  return stores
}

/** Branch name -> store, or null when none or several match. Never throws. */
export async function resolveStoreForBranch(branchName: string): Promise<BranchStore | null> {
  try {
    const stores = await fetchStores()
    const matches = stores.filter((s) => normalise(s.title) === normalise(branchName))
    return matches.length === 1 ? matches[0]! : null
  } catch {
    return null
  }
}

// Branch names almost never change; keep them while the instance is warm.
const NAME_CACHE_TTL_MS = 10 * 60_000
const nameCache = new Map<string, { at: number; name: string }>()

async function fetchBranchName(branchElementId: string): Promise<string | null> {
  const cached = nameCache.get(branchElementId)
  if (cached && Date.now() - cached.at < NAME_CACHE_TTL_MS) return cached.name

  const response = await bitrixFetch<{ result?: { NAME?: string }[] }>('lists.element.get', {
    method: 'POST',
    body: {
      IBLOCK_TYPE_ID: BITRIX_BRANCH_LIST.IBLOCK_TYPE_ID,
      IBLOCK_ID: BITRIX_BRANCH_LIST.IBLOCK_ID,
      ELEMENT_ID: branchElementId,
    },
  })
  const name = String(response.result?.[0]?.NAME ?? '').trim()
  if (!name) return null
  nameCache.set(branchElementId, { at: Date.now(), name })
  return name
}

/** The branch's name and its warehouse. Null when the branch cannot be read; never throws. */
export async function resolveBranchWarehouse(
  branchElementId: string,
): Promise<{ branchName: string; store: BranchStore | null } | null> {
  try {
    const branchName = await fetchBranchName(branchElementId)
    if (!branchName) return null
    return { branchName, store: await resolveStoreForBranch(branchName) }
  } catch {
    return null
  }
}

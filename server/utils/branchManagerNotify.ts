import { logger } from './logger'
import { bitrixFetch } from './bitrixAuth'

/**
 * Tells the branch manager that a web order has landed and needs its warehouse
 * picked on the deal's product line.
 *
 * WHY THIS EXISTS AS A MESSAGE RATHER THAN A FIELD WE SET: the warehouse on a
 * deal's product row is not writable over REST. Confirmed four ways on this
 * portal — `crm.item.productrow.fields` marks `storeId` readonly,
 * `crm.deal.productrows.set` accepts a `STORE_ID` and silently drops it (reads
 * back null), `crm.item.productrow.add` does the same, and
 * `crm.item.productrow.update` answers "Field 'storeId' not available for
 * update". `crm.item.productrow.reservation.set` does not exist here. It is a
 * UI-only field, which is also why the inventory repo polices it from outside
 * with an HTTP guard instead of a business process.
 *
 * So the order arrives with the right branch on it, and a human is told which
 * warehouse that means.
 *
 * The branch manager is read live from the Branch list (iblock 28), the same
 * source the inventory tooling uses, so a handover or a new branch is picked up
 * without a deploy. All 38 branches the website offers carry one.
 */

const BRANCH_IBLOCK_ID = 28
const BRANCH_IBLOCK_TYPE_ID = 'lists'
/** "Branch Manager" on a Branch list element. Matches lib/branch-people.js in the inventory repo. */
const BRANCH_MANAGER_PROPERTY = 'PROPERTY_126'

const PORTAL_URL = 'https://nisl.bitrix24.com'

interface BranchElement {
  NAME?: string
  [key: string]: unknown
}

/**
 * Multi-valued list properties arrive as `{ valueId: value }`, not as an array.
 * Reading `[0]` off that object gives undefined, which is how a populated field
 * reads as empty.
 */
function propertyUserIds(property: unknown): number[] {
  if (!property) return []
  const raw = Array.isArray(property)
    ? property
    : typeof property === 'object'
      ? Object.values(property as Record<string, unknown>)
      : [property]
  return raw.map(Number).filter((n) => Number.isInteger(n) && n > 0)
}

const normalise = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// The store list is ~49 rows and changes rarely. Short TTL so a newly created
// store is picked up without a redeploy.
const STORE_CACHE_TTL_MS = 60_000
let storeCache: { at: number; stores: { id: number; title: string }[] } | null = null

async function fetchStores(): Promise<{ id: number; title: string }[]> {
  if (storeCache && Date.now() - storeCache.at < STORE_CACHE_TTL_MS) return storeCache.stores

  const response = await bitrixFetch<{ result?: { stores?: { id: number; title: string; active?: string }[] } }>(
    'catalog.store.list',
    { method: 'POST', body: { select: ['id', 'title', 'active'] } },
  )
  const stores = (response.result?.stores ?? [])
    .filter((s) => s.active !== 'N')
    .map((s) => ({ id: Number(s.id), title: String(s.title).trim() }))

  storeCache = { at: Date.now(), stores }
  return stores
}

/**
 * Branch name -> catalog store, by exact title match.
 *
 * Deliberately the same rule as `resolveStoreByName` in the inventory repo,
 * and deliberately NOT a second copy of web-branch-map.csv — one mapping that
 * can drift is enough. No match means the message simply omits the warehouse
 * name rather than naming a wrong one.
 */
async function resolveStoreForBranch(branchName: string): Promise<{ id: number; title: string } | null> {
  try {
    const stores = await fetchStores()
    const matches = stores.filter((s) => normalise(s.title) === normalise(branchName))
    return matches.length === 1 ? matches[0]! : null
  } catch {
    return null
  }
}

export interface BranchOrderNotification {
  branchElementId: string
  dealId: string
  orderId: string
  total: number
}

/**
 * Never throws. A missed notification must not cost the order — the deal is
 * already filed by the time this runs, and the branch is on it either way.
 */
export async function notifyBranchManagerOfOrder(notification: BranchOrderNotification): Promise<boolean> {
  const { branchElementId, dealId, orderId, total } = notification

  try {
    const elementResponse = await bitrixFetch<{ result?: BranchElement[] }>('lists.element.get', {
      method: 'POST',
      body: {
        IBLOCK_TYPE_ID: BRANCH_IBLOCK_TYPE_ID,
        IBLOCK_ID: BRANCH_IBLOCK_ID,
        ELEMENT_ID: branchElementId,
      },
    })

    const element = elementResponse.result?.[0]
    if (!element) {
      logger.warn('BranchNotify', 'Branch element not found; nobody notified', { branchElementId, orderId })
      return false
    }

    const branchName = String(element.NAME ?? '').trim()
    const managerIds = propertyUserIds(element[BRANCH_MANAGER_PROPERTY])

    if (managerIds.length === 0) {
      logger.warn('BranchNotify', 'Branch has no manager; nobody notified', { branchElementId, branchName, orderId })
      return false
    }

    const store = await resolveStoreForBranch(branchName)
    const warehouseLine = store
      ? `Warehouse to select: ${store.title}`
      : `Warehouse: select the ${branchName} warehouse`

    const dealUrl = `${PORTAL_URL}/crm/deal/details/${dealId}/`
    const message = [
      `New web order for ${branchName || 'your branch'}.`,
      '',
      `Order: ${orderId}`,
      `Value: ₦${Number(total || 0).toLocaleString()}`,
      `Deal: [URL=${dealUrl}]#${dealId}[/URL]`,
      '',
      `[B]Please open the deal and set the warehouse on each product line.[/B]`,
      warehouseLine,
      '',
      'The website cannot set this field, so the order will not clear internal control until you do.',
    ].join('\n')

    let delivered = 0
    for (const userId of managerIds) {
      try {
        const response = await bitrixFetch<{ result?: number; error?: string; error_description?: string }>(
          'im.notify.personal.add',
          { method: 'POST', body: { USER_ID: userId, MESSAGE: message } },
        )
        if (response.error) throw new Error(response.error_description || String(response.error))
        delivered++
      } catch (err) {
        logger.warn('BranchNotify', 'Could not notify one branch manager', {
          error: err instanceof Error ? err.message : String(err),
          userId,
          branchName,
          orderId,
        })
      }
    }

    logger.info('BranchNotify', 'Notified branch manager(s) of web order', {
      orderId,
      dealId,
      branchName,
      storeId: store?.id ?? null,
      managerIds,
      delivered,
    })

    return delivered > 0
  } catch (err) {
    logger.warn('BranchNotify', 'Branch manager notification failed', {
      error: err instanceof Error ? err.message : String(err),
      branchElementId,
      orderId,
    })
    return false
  }
}

/**
 * The storefronts this one deployment serves, told apart by hostname.
 *
 * Novel Solar is the original site. Novel Home Essentials (the Novel Homes Oyo
 * branch, launching November 2026) sells home appliances from the same Bitrix
 * catalogue, through the same checkout, Paystack, promo codes and dealer gate —
 * it only narrows what is sold and where it is fulfilled.
 *
 * Imported by both the app and the server, so the two can never disagree about
 * which products or branches a site has. The server is the one that enforces it.
 */

export type SiteId = 'solar' | 'homes'

export interface SiteConfig {
  id: SiteId
  name: string
  /** Canonical public address, for links built without a request to hand. */
  canonicalUrl: string
  /** Under public/. Null until the site has a logo file: the name is shown as text instead. */
  logoPath: string | null
  /**
   * Bitrix section NAMES this site sells (matched case-insensitively — names
   * survived the section re-creation that changed every id). Null = everything.
   */
  sections: string[] | null
  /** iblock 28 branch ids an order may be fulfilled from. Null = any branch. */
  branchIds: string[] | null
}

export const SITES: Record<SiteId, SiteConfig> = {
  solar: {
    id: 'solar',
    name: 'Novel Solar',
    canonicalUrl: 'https://novelsolar.com',
    logoPath: '/images/logo.png',
    sections: null,
    branchIds: null,
  },
  homes: {
    id: 'homes',
    name: 'Novel Home Essentials',
    canonicalUrl: 'https://novelhomeessentials.com',
    logoPath: '/images/homes/logo.png',
    sections: ['Appliances', 'Fan', 'Voltage Stabilizer'],
    // NOVEL HOMES OYO, and Akinjide Branch, whose electronics store carries the range.
    branchIds: ['19094', '6434'],
  },
}

/**
 * novelhomeessentials.com and www., any Vercel alias containing the name, and
 * homes.localhost for local work (browsers resolve *.localhost to 127.0.0.1).
 * Everything else is Novel Solar, so an unknown host can never lose the shop.
 */
export function siteIdForHost(host: string | null | undefined): SiteId {
  const hostname = String(host ?? '')
    .toLowerCase()
    .replace(/:\d+$/, '')
  if (hostname.includes('novelhomeessentials') || hostname.startsWith('homes.')) return 'homes'
  return 'solar'
}

export function siteSellsSection(site: SiteConfig, sectionName: string | null | undefined): boolean {
  if (!site.sections) return true
  if (!sectionName) return false
  const key = sectionName.trim().toLowerCase()
  return site.sections.some((s) => s.toLowerCase() === key)
}

export function siteAllowsBranch(site: SiteConfig, bitrixId: unknown): boolean {
  if (!site.branchIds) return true
  return bitrixId != null && site.branchIds.includes(String(bitrixId).trim())
}

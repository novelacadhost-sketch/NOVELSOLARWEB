/**
 * Services are not merchandise: installation, de-commissioning, logistics, the
 * "OLD ... DISCOUNTED" trade-ins, and oddments like Cement and CHARCOAL.
 *
 * The section is authoritative. The keyword list below is only a fallback for a
 * product that has no section yet — a new item between syncs. On its own it
 * caught 10 of the 23 services (missing Cement, DIGGING, LOGISTICS AND
 * TRANSPORTATION and the trade-ins) and would wrongly drop a real product
 * called something like "Repair Kit".
 *
 * Listings are filtered server-side now; this remains as a second line of
 * defence and for callers holding products from elsewhere.
 */
const serviceKeywords = ['audit', 'installation', 'repair', 'maintenance']

interface MaybeService {
  NAME?: string
  name?: string
  sectionName?: string | null
  section_name?: string | null
}

export const isServiceProduct = (product: MaybeService | null | undefined) => {
  const section = product?.sectionName ?? product?.section_name
  if (section) return section.toUpperCase() === 'SERVICES'

  const title = (product?.NAME || product?.name || '').toLowerCase()
  return serviceKeywords.some((keyword) => title.includes(keyword))
}

export const excludeServiceProducts = <T extends MaybeService>(products: T[] = []) => {
  return products.filter((product) => !isServiceProduct(product))
}

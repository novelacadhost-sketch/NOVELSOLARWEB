/**
 * How the 26 Bitrix product sections are presented in the shop.
 *
 * Two levels: a GROUP is a top-level shop category, and the Bitrix sections
 * inside it become subheadings. That is the whole point of the structure —
 * "Lighting" is one filter, but a shopper still sees Bulb & Lamp, Floodlight and
 * Streetlight as separate runs within it.
 *
 * **Matched on the section NAME, never the id.** These sections were deleted
 * from the Bitrix portal and re-added later, which gave every one of them a new
 * id — which is why the shop's original categories each carried
 * `SECTION_ID: null` and fell back to guessing from the product title. Names
 * survived that; ids did not. If it happens again, this file keeps working.
 *
 * This is the merchandising decision and the only file to edit to change it.
 * A section not listed here lands in Accessories, so a new Bitrix section is
 * never invisible — it just sits in the catch-all until someone places it.
 */

import type { SiteId } from '#shared/sites'

export interface CategoryGroup {
  id: string
  name: string
  /** Bitrix section names, in the order their subheadings should appear. */
  sections: string[]
}

/** Not merchandise. The shop already strips these via excludeServiceProducts. */
export const EXCLUDED_SECTIONS = ['SERVICES']

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'solar-panels', name: 'Solar Panels', sections: ['Solar Panel'] },
  {
    id: 'inverters',
    name: 'Inverters',
    sections: ['Inverter', 'Hybrid Inverter', 'Power Inverter', 'Solar Generator'],
  },
  // Battery Charger sits here rather than in Accessories: someone shopping for a
  // battery is the person who needs one.
  { id: 'batteries', name: 'Batteries', sections: ['Battery', 'BATTERIES', 'Battery Charger'] },
  { id: 'charge-controllers', name: 'Charge Controllers', sections: ['Charge Controller'] },
  { id: 'lighting', name: 'Lighting', sections: ['Bulb & Lamp', 'Floodlight', 'Streetlight'] },
  { id: 'appliances', name: 'Appliances', sections: ['Appliances', 'Fan'] },
  {
    id: 'electrical-accessories',
    name: 'Electrical Accessories',
    sections: ['Electrical Accessories', 'Protective Device'],
  },
  { id: 'cctv-security', name: 'CCTV & Security', sections: ['CCTV & Security'] },
  { id: 'solar-kits', name: 'Solar Kits', sections: ['Solar Kit'] },
  { id: 'solar-pumps', name: 'Solar Pumps', sections: ['Solar Pump'] },
  { id: 'electric-mobility', name: 'Electric Mobility', sections: ['Electric Mobility'] },
  {
    id: 'accessories',
    name: 'Accessories',
    sections: ['Wire & Cable', 'Rack & Mounting', 'Voltage Stabilizer', 'Power Bank', 'Distilled Water'],
  },
]

const norm = (value: string) => value.trim().toLowerCase()

/**
 * Novel Home Essentials: one group per section it sells (shared/sites.ts holds
 * the list the server filters by). The ids are its /category/ slugs.
 */
export const HOMES_CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'appliances', name: 'Home Appliances', sections: ['Appliances'] },
  { id: 'fans', name: 'Fans', sections: ['Fan'] },
  { id: 'voltage-stabilizers', name: 'Voltage Stabilizers', sections: ['Voltage Stabilizer'] },
]

export function categoryGroupsFor(siteId: SiteId = 'solar'): CategoryGroup[] {
  return siteId === 'homes' ? HOMES_CATEGORY_GROUPS : CATEGORY_GROUPS
}

// Built once per site. A section named in two groups would be ambiguous, so the
// first listing wins and the duplicate is ignored rather than silently reassigning.
function sectionMap(groups: CategoryGroup[]) {
  const map = new Map<string, string>()
  for (const group of groups) {
    for (const section of group.sections) {
      if (!map.has(norm(section))) map.set(norm(section), group.id)
    }
  }
  return map
}
const SECTION_TO_GROUP: Record<SiteId, Map<string, string>> = {
  solar: sectionMap(CATEGORY_GROUPS),
  homes: sectionMap(HOMES_CATEGORY_GROUPS),
}

export const FALLBACK_GROUP_ID = 'accessories'

/** Which shop group a Bitrix section belongs to. Unknown sections fall to Accessories on Novel Solar. */
export function groupIdForSection(sectionName?: string | null, siteId: SiteId = 'solar'): string | null {
  if (!sectionName) return null
  const key = norm(sectionName)
  if (EXCLUDED_SECTIONS.some((s) => norm(s) === key)) return null
  return SECTION_TO_GROUP[siteId].get(key) ?? (siteId === 'solar' ? FALLBACK_GROUP_ID : null)
}

export function isExcludedSection(sectionName?: string | null): boolean {
  if (!sectionName) return false
  return EXCLUDED_SECTIONS.some((s) => norm(s) === norm(sectionName))
}

/**
 * Subheading order within a group: listed sections first, in the order above,
 * then anything unlisted that fell in, alphabetically. Keeps a newly added
 * Bitrix section visible at the bottom of Accessories rather than lost.
 */
export function orderSections(groupId: string, present: string[], siteId: SiteId = 'solar'): string[] {
  const group = categoryGroupsFor(siteId).find((g) => g.id === groupId)
  const known = group ? group.sections.filter((s) => present.some((p) => norm(p) === norm(s))) : []
  const extra = present.filter((p) => !known.some((k) => norm(k) === norm(p))).sort((a, b) => a.localeCompare(b))
  return [...known, ...extra]
}

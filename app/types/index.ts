/** Product as returned from Bitrix24 CRM /api/inventory */
export interface BitrixProduct {
  ID: string
  /**
   * Fewer than LOW_STOCK_THRESHOLD units company-wide (server/utils/lowStock.ts).
   * A flag only — the count is never sent to the browser.
   */
  lowStock?: boolean
  id?: string
  NAME: string
  name?: string
  title?: string
  PRICE: number
  price?: number
  ACTIVE?: 'Y' | 'N'
  DETAIL_TEXT?: string
  PROPERTY_102?: string | Array<{ value: string }>
  PROPERTY_44?: { showUrl?: string; downloadUrl?: string }
  PREVIEW_PICTURE?: string | { showUrl?: string; downloadUrl?: string }
  DETAIL_PICTURE?: string | { showUrl?: string; downloadUrl?: string }
  image?: string
  dealerPrice?: number
  [key: string]: unknown
}

/** Static product used on the /products filter page */
export interface FilterProduct {
  id: number
  title: string
  category: string
  wattage: number
  efficiency: number
  price: number
  originalPrice?: number
  dealerPrice?: number
  image: string
}

/** Branch / outlet location */
export interface Branch {
  name: string
  address: string
  phone: string
  email1?: string
  email2?: string
  hoursWeekdays?: string
  hoursSaturday?: string
  coordinates: [number, number]
  coords: [number, number]
  city: string
  state: string
  contactPerson?: string
}

/** Partner brand entry shown on /partners */
export interface Partner {
  name: string
  slug: string
  desc: string
  logo: string
}

/** Partnership track card */
export interface PartnershipTrack {
  title: string
  description: string
}

/** Solar load calculator appliance row */
export interface Appliance {
  id: string
  name: string
  icon: string
  quantity: number
  load: number
}

/** Summary stat row in calculator */
export interface SummaryStat {
  label: string
  value: string | number
  unit: string
}

/** Blog post from Nuxt Content */
export interface BlogPost {
  _path: string
  title: string
  description?: string
  date?: string
  image?: string
  excerpt?: string
}

/** Nigerian state for checkout state selector */
export interface NigerianState {
  name: string
  coords: [number, number]
}

/** Navigation menu item with a title and route link */
export interface NavMenuItem {
  title: string
  link: string
}

/** Calculator price tier mapping load range to cost range */
export interface PriceTier {
  minLoad: number
  maxLoad: number | null
  minPrice: number
  maxPrice: number
}

/** User profile combining CRM and DB fields */
export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  role?: string
  dealer_status?: 'none' | 'pending' | 'approved' | 'rejected'
  isTemporary?: boolean
}

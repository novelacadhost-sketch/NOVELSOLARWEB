/**
 * The legal pages, linked from both footers, checkout and the forms. Kept in one
 * list so a page cannot be added to one place and forgotten in the others.
 *
 * The page text is a DRAFT written for review (2026-10-13): business terms the
 * code cannot know, such as the return window and delivery times, follow common
 * Nigerian retail practice and must be confirmed before go-live.
 */
export const LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms of sale' },
  { to: '/returns', label: 'Returns & refunds' },
  { to: '/delivery', label: 'Delivery & pickup' },
] as const

export const LEGAL_UPDATED = '13 October 2026'

/** Contact details quoted in every policy. */
export const LEGAL_CONTACT = {
  email: 'info@novelsolar.com',
  salesEmail: 'sales@novelsolar.com',
  phone: '0812 261 5555',
  address: 'Akinjide Plaza, 76 Adekunle Fajuyi Road, Ekotedo, Ibadan, Oyo State, Nigeria',
} as const

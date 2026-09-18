import type { FailedQuote, FailedContact, FailedBooking } from '../types/database'
import type { SubmissionType } from '../types/bitrix'

// TITLE prefixes used by the submit endpoints. These also drive classifyLeadByTitle()
// when reading leads back from Bitrix. If a submit endpoint changes its TITLE format,
// update the corresponding prefix here.
export const LEAD_TITLE_PREFIXES = {
  /**
   * Orders are filed as Deals now (2026-09-18), not Leads, so nothing writes
   * this prefix any more. It stays because classifyLeadByTitle() still reads
   * back the leads created before that change.
   */
  order: 'Web Order:',
  quote: 'Website Quote Request:',
  contact: 'General Web Inquiry:',
  booking: 'Service Booking:',
} as const

export function classifyLeadByTitle(title: string | undefined): SubmissionType {
  if (!title) return 'other'
  if (title.startsWith(LEAD_TITLE_PREFIXES.order)) return 'order'
  if (title.startsWith(LEAD_TITLE_PREFIXES.quote)) return 'quote'
  if (title.startsWith(LEAD_TITLE_PREFIXES.contact)) return 'contact'
  if (title.startsWith(LEAD_TITLE_PREFIXES.booking)) return 'booking'
  return 'other'
}

type LeadFields = Record<string, unknown>

export function buildQuoteLeadPayload(quote: FailedQuote): { fields: LeadFields; params: Record<string, string> } {
  return {
    fields: {
      TITLE: `${LEAD_TITLE_PREFIXES.quote} ${quote.projectType || 'General Inquiry'}`,
      NAME: quote.firstName,
      LAST_NAME: quote.lastName,
      EMAIL: [{ VALUE: quote.email, VALUE_TYPE: 'WORK' }],
      PHONE: [{ VALUE: quote.phone, VALUE_TYPE: 'WORK' }],
      COMMENTS: `Project Type: ${quote.projectType}\n\nDetails:\n${quote.details || 'No additional details provided'}`,
      SOURCE_ID: 'WEB',
    },
    params: { REGISTER_SONET_EVENT: 'Y' },
  }
}

export function buildContactLeadPayload(contact: FailedContact): {
  fields: LeadFields
  params: Record<string, string>
} {
  return {
    fields: {
      TITLE: `${LEAD_TITLE_PREFIXES.contact} ${contact.subject || 'No Subject'}`,
      NAME: contact.name,
      EMAIL: [{ VALUE: contact.email, VALUE_TYPE: 'WORK' }],
      PHONE: [{ VALUE: contact.phone || '', VALUE_TYPE: 'WORK' }],
      COMMENTS: `Inquiry Type: General Contact Form\nSubject: ${contact.subject || 'No Subject'}\n\nMessage:\n${contact.message}`,
      SOURCE_ID: 'WEB',
      OPENED: 'Y',
    },
    params: { REGISTER_SONET_EVENT: 'Y' },
  }
}

export function buildBookingLeadPayload(booking: FailedBooking): {
  fields: LeadFields
  params: Record<string, string>
} {
  return {
    fields: {
      TITLE: `${LEAD_TITLE_PREFIXES.booking} ${booking.serviceType}`,
      NAME: booking.firstName,
      LAST_NAME: booking.lastName,
      EMAIL: [{ VALUE: booking.email, VALUE_TYPE: 'WORK' }],
      PHONE: [{ VALUE: booking.phone, VALUE_TYPE: 'WORK' }],
      COMMENTS: `SERVICE REQUEST DETAILS\n------------------------\nService: ${booking.serviceType}\nPreferred Date: ${booking.preferredDate}\nService Address: ${booking.address}\n\nCustomer Notes:\n${booking.details || 'None provided'}`,
      SOURCE_ID: 'WEB',
    },
    params: { REGISTER_SONET_EVENT: 'Y' },
  }
}

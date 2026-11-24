/**
 * The dealer and partner sign-up for the end-of-year party. Same party as the
 * staff form (shared/party.ts), its own guest list and its own closing time.
 */
import { PARTY, hourLabel } from './party'

export const PARTNER_EVENT = 'eoy-2026'

// After this nobody can register or change an RSVP. Lagos time (UTC+1).
// Starts the same as the staff form; move it if partners need longer.
export const PARTNER_CLOSES_AT = '2026-11-26T12:00:00+01:00'
export const PARTNER_CLOSES_LABEL = '12 noon on Thursday 26 November'

export function partnerRsvpClosed(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(PARTNER_CLOSES_AT).getTime()
}

export interface PartnerRsvp {
  fullName: string
  company: string
  plusOne: boolean
  arriveHour: number
  leaveHour: number
}

export interface PartnerReportRow extends PartnerRsvp {
  id: string
  updatedAt: string
}

/** Lower-case words, letters and digits only, sorted: who an RSVP belongs to. */
export function partnerKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

const clean = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

function hour(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : null
}

/** Checks a submitted form, returning it cleaned or a message for the person filling it in. */
export function parsePartnerRsvp(input: unknown): { rsvp: PartnerRsvp } | { error: string } {
  const body = (input ?? {}) as Record<string, unknown>

  const fullName = clean(body.fullName)
  if (partnerKey(fullName).split(' ').length < 2) return { error: 'Please enter your full name: first name and surname.' }
  if (fullName.length > 80) return { error: 'That name is too long.' }

  const company = clean(body.company)
  if (!partnerKey(company)) return { error: 'Please enter your company name.' }
  if (company.length > 120) return { error: 'That company name is too long.' }

  if (typeof body.plusOne !== 'boolean') return { error: 'Please say whether you are bringing a plus one.' }

  const arriveHour = hour(body.arriveHour, PARTY.startHour, PARTY.endHour - 1)
  const leaveHour = hour(body.leaveHour, PARTY.startHour + 1, PARTY.endHour)
  if (arriveHour === null || leaveHour === null || arriveHour >= leaveHour) {
    return {
      error: `Please choose when you will arrive and leave, between ${hourLabel(PARTY.startHour)} and ${hourLabel(PARTY.endHour)}.`,
    }
  }

  return { rsvp: { fullName, company, plusOne: body.plusOne, arriveHour, leaveHour } }
}

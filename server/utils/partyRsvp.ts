import { createHash, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { logger } from './logger'
import { PARTY_EVENT, type Lane4Stay, type PartyChild, type PartyReportRow, type PartyRsvp } from '#shared/party'

/**
 * SHA-256 of the secret in HR's results link (/party-results#<secret>). Only
 * the hash is in this public repo; the secret itself was handed to Davies.
 * To issue a new link, generate a fresh secret and replace this hash.
 */
const RESULTS_KEY_SHA256 = '8170c15acf75678c840c2a4a6e98ddd908de50f2146e56321aaa5c527ea17291'

export function isPartyResultsKey(key: unknown): boolean {
  if (typeof key !== 'string' || !key) return false
  const given = createHash('sha256').update(key).digest()
  return timingSafeEqual(given, Buffer.from(RESULTS_KEY_SHA256, 'hex'))
}

/** Every RSVP for the party, newest first, with the staff member's name. */
export async function listPartyRsvps(): Promise<PartyReportRow[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = (await supabase
    .from('party_rsvps')
    .select(RSVP_COLUMNS)
    .eq('event', PARTY_EVENT)
    .order('updated_at', { ascending: false })
    .range(0, 999)) as { data: PartyRsvpRow[] | null; error: { message: string } | null }

  if (error) {
    logger.error('Party', 'RSVP list failed', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load RSVPs.' })
  }

  const rows = data ?? []
  const staff = new Map<string, { first_name: string; last_name: string; job_title: string | null }>()
  if (rows.length) {
    const { data: people } = (await supabase
      .from('staff_codes')
      .select('code, first_name, last_name, job_title')
      .in(
        'code',
        rows.flatMap((r) => (r.staff_code ? [r.staff_code] : [])),
      )) as { data: { code: string; first_name: string; last_name: string; job_title: string | null }[] | null }
    for (const p of people ?? []) staff.set(p.code, p)
  }

  return rows.map((row) => {
    const person = row.staff_code ? staff.get(row.staff_code) : undefined
    return {
      id: row.id,
      staffCode: row.staff_code,
      onBitrix: Boolean(row.staff_code),
      name: person ? `${person.first_name} ${person.last_name}`.trim() : (row.full_name ?? row.staff_code ?? ''),
      jobTitle: person?.job_title ?? null,
      ...rowToRsvp(row),
    }
  })
}

export interface PartyRsvpRow {
  id: string
  event: string
  /** Set for Bitrix staff; null for someone not on Bitrix, who has full_name instead. */
  staff_code: string | null
  full_name: string | null
  name_key: string | null
  attending: boolean
  match_only: boolean
  adult_guests: number
  children: PartyChild[]
  arrive_hour: number | null
  leave_hour: number | null
  novelty_match: boolean
  lane4_stay: Lane4Stay | null
  created_at: string
  updated_at: string
}

export const RSVP_COLUMNS =
  'id, event, staff_code, full_name, name_key, attending, match_only, adult_guests, children, arrive_hour, leave_hour, novelty_match, lane4_stay, created_at, updated_at'

export function rowToRsvp(row: PartyRsvpRow): PartyRsvp & { updatedAt: string } {
  return {
    attending: row.attending,
    matchOnly: row.match_only,
    adultGuests: row.adult_guests,
    children: Array.isArray(row.children) ? row.children : [],
    arriveHour: row.arrive_hour,
    leaveHour: row.leave_hour,
    noveltyMatch: row.novelty_match,
    lane4Stay: row.lane4_stay,
    updatedAt: row.updated_at,
  }
}

const NOT_FOUND =
  'We could not find that name in the staff list. Enter your first name and surname as they appear in Bitrix.'

/** Lower-case words, letters only: "Folorunso,  DAVIES" -> ["folorunso", "davies"]. */
const words = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .split(/[\s,.-]+/)
    .map((w) => w.replace(/[^a-z]/g, ''))
    .filter(Boolean)

/** Who an RSVP belongs to: a Bitrix staff member, or someone not on Bitrix known by name. */
export type PartyGuest =
  | { kind: 'staff'; code: string; firstName: string }
  | { kind: 'unlisted'; fullName: string; nameKey: string; firstName: string }

/**
 * Who is filling in the form. First, the staff member whose first name AND
 * surname are both in the full name typed, in either order, with middle names
 * ignored. Two current staff with the same name cannot be told apart, so that
 * is refused rather than guessed.
 *
 * With no match, the answer is a 404 with code NOT_ON_STAFF_LIST, unless the
 * person has said they are not on Bitrix (`notOnBitrix: true`); then they are
 * known by the name they typed. A name that does match Bitrix always resolves
 * to the staff member, so nobody ends up registered twice. Rate limited in
 * 1.rate-limit.ts.
 */
export async function identifyPartyGuest(body: unknown): Promise<PartyGuest> {
  const input = (body ?? {}) as Record<string, unknown>
  const typed = new Set(words(input.name))
  if (typed.size < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Please enter your full name: first name and surname.' })
  }

  const { data, error } = (await getSupabaseAdminClient()
    .from('staff_codes')
    .select('code, first_name, last_name')
    .eq('in_bitrix', true)
    .range(0, 1999)) as {
    data: { code: string; first_name: string; last_name: string }[] | null
    error: { message: string } | null
  }

  if (error) {
    logger.error('Party', 'Staff list read failed', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not check your name just now. Please try again.' })
  }

  const matches = (data ?? []).filter((s) => {
    const first = words(s.first_name)
    const last = words(s.last_name)
    return first.length > 0 && last.length > 0 && [...first, ...last].every((w) => typed.has(w))
  })

  if (matches.length > 1) {
    logger.warn('Party', 'Name matches more than one staff member', { codes: matches.map((m) => m.code) })
    throw createError({
      statusCode: 409,
      statusMessage: 'More than one member of staff has that name. Please ask HR to register you.',
    })
  }
  const [staff] = matches
  if (staff) return { kind: 'staff', code: staff.code, firstName: staff.first_name }

  if (input.notOnBitrix !== true) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND, data: { code: 'NOT_ON_STAFF_LIST' } })
  }

  const fullName = String(input.name).replace(/\s+/g, ' ').trim()
  if (fullName.length > 80) throw createError({ statusCode: 400, statusMessage: 'That name is too long.' })
  const firstName = fullName.split(' ')[0] ?? fullName
  return { kind: 'unlisted', fullName, nameKey: [...typed].sort().join(' '), firstName }
}

export async function readPartyRsvp(guest: PartyGuest): Promise<PartyRsvpRow | null> {
  const base = getSupabaseAdminClient().from('party_rsvps').select(RSVP_COLUMNS).eq('event', PARTY_EVENT)
  const query = guest.kind === 'staff' ? base.eq('staff_code', guest.code) : base.eq('name_key', guest.nameKey)
  const { data, error } = (await query.maybeSingle()) as { data: PartyRsvpRow | null; error: { message: string } | null }

  if (error) {
    logger.error('Party', 'RSVP read failed', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load your RSVP just now. Please try again.' })
  }
  return data
}

/** For logs: the staff code, or just the fact that it is a name-only entry (no names in logs). */
export const guestLogId = (guest: PartyGuest) => (guest.kind === 'staff' ? guest.code : 'not-on-bitrix')

import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { RSVP_COLUMNS, rowToRsvp, type PartyRsvpRow } from '../../utils/partyRsvp'
import { logger } from '../../utils/logger'
import { PARTY_EVENT } from '#shared/party'

/** GET /api/admin/party-rsvps: every RSVP for the party, with the staff member's name. */
export default defineEventHandler(async () => {
  const supabase = getSupabaseAdminClient()
  const { data, error } = (await supabase
    .from('party_rsvps')
    .select(RSVP_COLUMNS)
    .eq('event', PARTY_EVENT)
    .order('updated_at', { ascending: false })
    .range(0, 999)) as { data: PartyRsvpRow[] | null; error: { message: string } | null }

  if (error) {
    logger.error('Party', 'Admin RSVP list failed', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load RSVPs.' })
  }

  const rows = data ?? []
  const codes = rows.map((r) => r.staff_code)
  const staff = new Map<string, { first_name: string; last_name: string; job_title: string | null }>()
  if (codes.length) {
    const { data: people } = (await supabase
      .from('staff_codes')
      .select('code, first_name, last_name, job_title')
      .in('code', codes)) as {
      data: { code: string; first_name: string; last_name: string; job_title: string | null }[] | null
    }
    for (const p of people ?? []) staff.set(p.code, p)
  }

  return {
    rsvps: rows.map((row) => {
      const person = staff.get(row.staff_code)
      return {
        staffCode: row.staff_code,
        name: person ? `${person.first_name} ${person.last_name}`.trim() : row.staff_code,
        jobTitle: person?.job_title ?? null,
        ...rowToRsvp(row),
      }
    }),
  }
})

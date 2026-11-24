import { getSupabaseAdminClient } from './supabaseAdmin'
import { logger } from './logger'
import { PARTNER_EVENT, type PartnerReportRow } from '#shared/partnerParty'

export interface PartnerRsvpRow {
  id: string
  full_name: string
  company: string
  plus_one: boolean
  arrive_hour: number
  leave_hour: number
  updated_at: string
}

export const PARTNER_COLUMNS = 'id, full_name, company, plus_one, arrive_hour, leave_hour, updated_at'

export const partnerRowToReport = (row: PartnerRsvpRow): PartnerReportRow => ({
  id: row.id,
  fullName: row.full_name,
  company: row.company,
  plusOne: row.plus_one,
  arriveHour: row.arrive_hour,
  leaveHour: row.leave_hour,
  updatedAt: row.updated_at,
})

/** Every partner RSVP for the party, newest first. */
export async function listPartnerRsvps(): Promise<PartnerReportRow[]> {
  const { data, error } = (await getSupabaseAdminClient()
    .from('partner_rsvps')
    .select(PARTNER_COLUMNS)
    .eq('event', PARTNER_EVENT)
    .order('updated_at', { ascending: false })
    .range(0, 999)) as { data: PartnerRsvpRow[] | null; error: { message: string } | null }

  if (error) {
    logger.error('Partner party', 'RSVP list failed', { error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load partner RSVPs.' })
  }
  return (data ?? []).map(partnerRowToReport)
}

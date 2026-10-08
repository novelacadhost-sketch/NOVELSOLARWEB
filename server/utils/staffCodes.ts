import { bitrixFetch } from './bitrixAuth'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { logger } from './logger'

/**
 * Staff referral codes: first two letters of the first name, first two of the
 * surname, then the Bitrix user id. Davies Folorunso, user 12, is DAFO12.
 *
 * The id is what makes a code unique — 12 letter pairs are shared by two or
 * more of the 185 staff — and the letters are what make it harder to guess
 * than the bare id. It is a reference, not a secret: anyone who knows a name
 * and an id can work one out, which is acceptable for a small discount.
 */

export interface StaffCode {
  code: string
  bitrixUserId: number
  firstName: string
  lastName: string
}

interface StaffCodeRow {
  code: string
  bitrix_user_id: number
  first_name: string
  last_name: string
  job_title: string | null
  email: string | null
  in_bitrix: boolean
  enabled: boolean
}

interface BitrixUser {
  ID: string
  NAME?: string | null
  LAST_NAME?: string | null
  EMAIL?: string | null
  WORK_POSITION?: string | null
}

const CODE_PATTERN = /^[A-Z]{2,4}\d{1,6}$/

/**
 * Letters only, accents folded: "Ọlá" gives "OLA". NFD splits each accented
 * letter into the plain letter plus a combining mark, and the A-Z filter then
 * drops the mark.
 */
function letters(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[^A-Z]/gi, '')
    .toUpperCase()
}

export function buildStaffCode(firstName: string | null | undefined, lastName: string | null | undefined, id: number | string): string {
  let prefix = letters(firstName).slice(0, 2) + letters(lastName).slice(0, 2)
  // Every one of the 185 staff has both names today. This only stops a
  // nameless account from producing a code the table refuses.
  if (prefix.length < 2) prefix = `${prefix}NS`.slice(0, 2)
  return `${prefix}${id}`
}

/** What a customer typed or a link carried, in the form codes are stored. */
export function normaliseStaffCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.replace(/[\s-]/g, '').toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

/**
 * A code that can be used right now: issued, the person still active in
 * Bitrix, and not switched off by an admin. Null otherwise, including when the
 * lookup itself fails — a code that cannot be checked is not honoured, and the
 * order goes through without it.
 */
export async function lookupStaffCode(raw: unknown): Promise<StaffCode | null> {
  const code = normaliseStaffCode(raw)
  if (!code) return null

  try {
    const { data, error } = await getSupabaseAdminClient()
      .from('staff_codes')
      .select('code, bitrix_user_id, first_name, last_name, in_bitrix, enabled')
      .eq('code', code)
      .maybeSingle()
    if (error) throw error

    const row = data as Pick<StaffCodeRow, 'code' | 'bitrix_user_id' | 'first_name' | 'last_name' | 'in_bitrix' | 'enabled'> | null
    if (!row || !row.in_bitrix || !row.enabled) return null

    return { code: row.code, bitrixUserId: row.bitrix_user_id, firstName: row.first_name, lastName: row.last_name }
  } catch (error) {
    logger.warn('StaffCodes', 'Code lookup failed; not applied', {
      code,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/** The name on a code, for the deal comment. Null if it cannot be read. */
export async function staffNameFor(bitrixUserId: number): Promise<string | null> {
  try {
    const { data } = await getSupabaseAdminClient()
      .from('staff_codes')
      .select('first_name, last_name')
      .eq('bitrix_user_id', bitrixUserId)
      .maybeSingle()
    const row = data as { first_name: string; last_name: string } | null
    return row ? `${row.first_name} ${row.last_name}`.trim() : null
  } catch {
    return null
  }
}

async function fetchActiveEmployees(): Promise<BitrixUser[]> {
  const users: BitrixUser[] = []
  for (let start = 0; ; ) {
    const response = await bitrixFetch<{ result?: BitrixUser[]; next?: number; error?: string; error_description?: string }>(
      'user.get',
      { method: 'POST', body: { FILTER: { ACTIVE: true, USER_TYPE: 'employee' }, start } },
    )
    if (response.error) throw new Error(response.error_description || String(response.error))
    users.push(...(response.result ?? []))
    if (response.next === undefined) break
    start = response.next
  }
  return users
}

export interface StaffCodeSyncResult {
  employees: number
  created: number
  deactivated: number
}

/**
 * Bring the codes table into line with Bitrix's active employees.
 *
 * New staff get a code. Existing staff keep the one they were issued, even if
 * their name has since been corrected — the name columns are refreshed, the
 * code is not. Anyone no longer active in Bitrix is marked so and their code
 * stops working; their row stays, because past orders point at it.
 *
 * Throws if Bitrix cannot be read: a partial employee list would deactivate
 * everyone missing from it.
 */
export async function syncStaffCodes(): Promise<StaffCodeSyncResult> {
  const employees = await fetchActiveEmployees()
  if (employees.length === 0) throw new Error('Bitrix returned no active employees; refusing to deactivate everyone')

  const supabase = getSupabaseAdminClient()
  const { data: existingData, error: readError } = await supabase.from('staff_codes').select('code, bitrix_user_id')
  if (readError) throw readError

  const issued = new Map<number, string>()
  for (const row of (existingData ?? []) as { code: string; bitrix_user_id: number }[]) issued.set(row.bitrix_user_id, row.code)

  const now = new Date().toISOString()
  let created = 0
  const rows = employees.map((user) => {
    const id = Number(user.ID)
    let code = issued.get(id)
    if (!code) {
      code = buildStaffCode(user.NAME, user.LAST_NAME, id)
      created++
    }
    return {
      code,
      bitrix_user_id: id,
      first_name: (user.NAME ?? '').trim(),
      last_name: (user.LAST_NAME ?? '').trim(),
      job_title: user.WORK_POSITION?.trim() || null,
      email: user.EMAIL?.trim() || null,
      in_bitrix: true,
      updated_at: now,
    }
  })

  // Keyed on the user id, and every existing row is sent back with the code it
  // already has, so an upsert can never re-issue one. `enabled` is left out so
  // an admin's switch survives the sync.
  const { error: upsertError } = await supabase.from('staff_codes').upsert(rows as never, { onConflict: 'bitrix_user_id' })
  if (upsertError) throw upsertError

  const activeIds = rows.map((r) => r.bitrix_user_id)
  const { data: gone, error: deactivateError } = await supabase
    .from('staff_codes')
    .update({ in_bitrix: false, updated_at: now } as never)
    .eq('in_bitrix', true)
    .not('bitrix_user_id', 'in', `(${activeIds.join(',')})`)
    .select('code')
  if (deactivateError) throw deactivateError

  const result = { employees: employees.length, created, deactivated: (gone ?? []).length }
  logger.info('StaffCodes', 'Staff codes synced', { ...result })
  return result
}

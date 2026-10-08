import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { normaliseStaffCode } from '../../../utils/staffCodes'
import { adminUuid, logPromotionChange } from '../../../utils/promotionAudit'

const bodySchema = z.object({
  code: z.string().trim().min(3).max(32),
  enabled: z.boolean(),
})

/**
 * Switch one staff code on or off — for a code being misused, without touching
 * anyone else's. Separate from Bitrix: someone who leaves is switched off by
 * the sync, and this switch survives every sync.
 */
export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(await readBody(event))
  const code = parsed.success ? normaliseStaffCode(parsed.data.code) : null
  if (!parsed.success || !code) {
    throw createError({ statusCode: 400, statusMessage: 'A valid staff code and on/off are required.' })
  }

  const { data, error } = await getSupabaseAdminClient()
    .from('staff_codes')
    .update({ enabled: parsed.data.enabled, updated_at: new Date().toISOString(), updated_by: adminUuid(event) } as never)
    .eq('code', code)
    .select('code, first_name, last_name')
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'The code could not be updated.' })
  }

  const row = (data as { code: string; first_name: string; last_name: string }[] | null)?.[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'No such staff code.' })
  }

  await logPromotionChange(event, parsed.data.enabled ? 'code_enabled' : 'code_disabled', {
    code: row.code,
    staff: `${row.first_name} ${row.last_name}`.trim(),
  })

  return { success: true, code: row.code, enabled: parsed.data.enabled }
})

import { syncStaffCodes } from '../../../utils/staffCodes'
import { logPromotionChange } from '../../../utils/promotionAudit'

/** "Refresh now": issue codes for new staff the same day instead of overnight. */
export default defineEventHandler(async (event) => {
  try {
    const result = await syncStaffCodes()
    await logPromotionChange(event, 'codes_refreshed', { ...result })
    return { success: true, ...result }
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: `Could not read the staff list from Bitrix: ${error instanceof Error ? error.message : 'unknown error'}`,
    })
  }
})

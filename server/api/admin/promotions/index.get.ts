import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { MAX_DISCOUNT_PERCENT } from '../../../utils/promotions'

/** The Promotions page: current settings, every staff code, and the change history. */
export default defineEventHandler(async () => {
  const supabase = getSupabaseAdminClient()

  // Read directly, not through getPromotionSettings(): that one fails closed to
  // "off, 0%" for checkout's sake, which here would show an admin a setting
  // that is not the real one.
  const [settingsResult, codesResult, changesResult] = await Promise.all([
    supabase
      .from('promotion_settings')
      .select('discount_enabled, discount_percent, min_order_amount, max_discount_amount, updated_at')
      .eq('id', 1)
      .single(),
    supabase
      .from('staff_codes')
      .select('code, bitrix_user_id, first_name, last_name, job_title, in_bitrix, enabled, created_at')
      .order('first_name')
      .order('last_name'),
    supabase
      .from('promotion_changes')
      .select('created_at, admin_email, action, details')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (settingsResult.error || codesResult.error) {
    throw createError({ statusCode: 500, statusMessage: 'Could not read the promotion settings.' })
  }

  const settings = settingsResult.data as {
    discount_enabled: boolean
    discount_percent: number | string
    min_order_amount: number | string
    max_discount_amount: number | string
    updated_at: string
  }

  return {
    settings: {
      discountEnabled: settings.discount_enabled,
      discountPercent: Number(settings.discount_percent),
      minOrderAmount: Number(settings.min_order_amount),
      maxDiscountAmount: Number(settings.max_discount_amount),
      updatedAt: settings.updated_at,
    },
    maxDiscountPercent: MAX_DISCOUNT_PERCENT,
    codes: codesResult.data ?? [],
    changes: changesResult.data ?? [],
  }
})

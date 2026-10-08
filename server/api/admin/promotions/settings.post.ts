import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { clearPromotionSettingsCache, MAX_DISCOUNT_PERCENT } from '../../../utils/promotions'
import { adminUuid, logPromotionChange } from '../../../utils/promotionAudit'

const bodySchema = z.object({
  discountEnabled: z.boolean(),
  // Two decimal places is what the column holds; anything finer would be
  // silently rounded by Postgres and then disagree with what the admin typed.
  discountPercent: z
    .number()
    .min(0)
    .max(MAX_DISCOUNT_PERCENT, `The rate cannot be more than ${MAX_DISCOUNT_PERCENT}%.`)
    // Compared with a tolerance: 1.1 * 100 is 110.00000000000001 in floating point.
    .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'Use at most two decimal places.'),
  // Whole naira. 0 = no minimum / no cap.
  minOrderAmount: z.number().int('Use whole naira for the minimum order.').min(0).max(1_000_000_000),
  maxDiscountAmount: z.number().int('Use whole naira for the maximum discount.').min(0).max(1_000_000_000),
})

/**
 * Change the discount for everyone. Takes effect on new checkouts within about
 * a minute (the settings cache); an order already opened keeps the rate it was
 * given, since its Paystack amount was fixed when checkout opened it.
 */
export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Invalid settings.' })
  }
  const next = parsed.data

  const supabase = getSupabaseAdminClient()
  const { data: before } = await supabase
    .from('promotion_settings')
    .select('discount_enabled, discount_percent, min_order_amount, max_discount_amount')
    .eq('id', 1)
    .single()
  const previous = before as {
    discount_enabled: boolean
    discount_percent: number | string
    min_order_amount: number | string
    max_discount_amount: number | string
  } | null

  const { error } = await supabase
    .from('promotion_settings')
    .update({
      discount_enabled: next.discountEnabled,
      discount_percent: next.discountPercent,
      min_order_amount: next.minOrderAmount,
      max_discount_amount: next.maxDiscountAmount,
      updated_at: new Date().toISOString(),
      updated_by: adminUuid(event),
    } as never)
    .eq('id', 1)
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'The settings could not be saved.' })
  }

  clearPromotionSettingsCache()
  await logPromotionChange(event, 'settings', {
    from: previous
      ? {
          discountEnabled: previous.discount_enabled,
          discountPercent: Number(previous.discount_percent),
          minOrderAmount: Number(previous.min_order_amount),
          maxDiscountAmount: Number(previous.max_discount_amount),
        }
      : null,
    to: next,
  })

  return { success: true, settings: next }
})

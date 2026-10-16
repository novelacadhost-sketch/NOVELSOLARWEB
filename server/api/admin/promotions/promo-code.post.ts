import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { normaliseCode } from '../../../utils/promotions'
import { adminUuid, logPromotionChange } from '../../../utils/promotionAudit'
import { promotionTargetSchema, targetColumns, toTarget } from '../../../utils/promotionTargetInput'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const wholeNaira = (label: string) => z.number().int(`Use whole naira for ${label}.`).min(0).max(1_000_000_000)

const bodySchema = z
  .object({
    isNew: z.boolean(),
    code: z.string().trim().min(3).max(32),
    description: z.string().trim().max(200).nullish(),
    discountType: z.enum(['percent', 'fixed']),
    discountValue: z.number().positive('The discount must be more than 0.'),
    minOrderAmount: wholeNaira('the minimum order'),
    maxDiscountAmount: wholeNaira('the maximum discount'),
    // Calendar days, Lagos time. Null = no start / no end.
    startsOn: z.string().regex(DAY).nullish(),
    expiresOn: z.string().regex(DAY).nullish(),
    usageLimit: z.number().int().positive('The usage limit must be at least 1.').nullish(),
    oncePerCustomer: z.boolean(),
    allowDealers: z.boolean(),
    enabled: z.boolean(),
    target: promotionTargetSchema,
  })
  .superRefine((b, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    if (b.discountType === 'percent') {
      if (b.discountValue > 90) issue('A percentage discount cannot be more than 90%.')
      // Compared with a tolerance: 1.1 * 100 is 110.00000000000001 in floating point.
      if (Math.abs(Math.round(b.discountValue * 100) - b.discountValue * 100) > 1e-6) issue('Use at most two decimal places.')
    } else {
      if (!Number.isInteger(b.discountValue)) issue('Use whole naira for a fixed discount.')
      // Without a minimum above the amount, "₦5,000 off" hands out a ₦5,000
      // product for free, and "₦80,000 off" with a ₦50,000 minimum a ₦60,000 order.
      if (!(b.minOrderAmount > b.discountValue)) {
        issue('A fixed-amount code needs a minimum order larger than the discount.')
      }
    }
    if (b.startsOn && b.expiresOn && b.expiresOn < b.startsOn) issue('The expiry date is before the start date.')
  })

interface PromoCodeWrite {
  code?: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_amount: number
  max_discount_amount: number
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  once_per_customer: boolean
  allow_dealers: boolean
  enabled: boolean
  applies_to: string
  target_sections: string[]
  target_product_ids: string[]
  updated_at: string
  updated_by: string | null
  created_by?: string | null
}

/**
 * Create or edit a promo code. The code itself is fixed once created: it may
 * already be printed or shared, and orders refer to it by name.
 *
 * Edits apply to orders from now on; past orders keep what they were given.
 */
export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Invalid promo code.' })
  }
  const b = parsed.data

  const code = normaliseCode(b.code)
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Codes are 3 to 20 letters and numbers, with no spaces.' })
  }

  const target = toTarget(b.target)
  const supabase = getSupabaseAdminClient()

  if (b.isNew) {
    // One box takes both kinds, so a promo code may not share a staff code's
    // name — the staff code would win and the promo would never apply.
    const [{ data: staff }, { data: existing }] = await Promise.all([
      supabase.from('staff_codes').select('code').eq('code', code).maybeSingle(),
      supabase.from('promo_codes').select('code').eq('code', code).maybeSingle(),
    ])
    if (staff) throw createError({ statusCode: 409, statusMessage: `${code} is a staff code. Choose another name.` })
    if (existing) throw createError({ statusCode: 409, statusMessage: `${code} already exists.` })
  }

  const row: PromoCodeWrite = {
    description: b.description?.trim() || null,
    discount_type: b.discountType,
    discount_value: b.discountValue,
    min_order_amount: b.minOrderAmount,
    // A cap only means something on a percentage.
    max_discount_amount: b.discountType === 'percent' ? b.maxDiscountAmount : 0,
    // Lagos is UTC+1 all year: a code runs from the start of its first day to
    // the end of its last.
    starts_at: b.startsOn ? `${b.startsOn}T00:00:00+01:00` : null,
    expires_at: b.expiresOn ? `${b.expiresOn}T23:59:59.999+01:00` : null,
    usage_limit: b.usageLimit ?? null,
    once_per_customer: b.oncePerCustomer,
    allow_dealers: b.allowDealers,
    enabled: b.enabled,
    ...targetColumns(target),
    updated_at: new Date().toISOString(),
    updated_by: adminUuid(event),
  }

  const { error } = b.isNew
    ? await supabase.from('promo_codes').insert({ ...row, code, created_by: adminUuid(event) } as never)
    : await supabase.from('promo_codes').update(row as never).eq('code', code)
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'The promo code could not be saved.' })
  }

  await logPromotionChange(event, b.isNew ? 'promo_created' : 'promo_updated', {
    code,
    discountType: b.discountType,
    discountValue: b.discountValue,
    minOrderAmount: b.minOrderAmount,
    maxDiscountAmount: row.max_discount_amount,
    startsOn: b.startsOn ?? null,
    expiresOn: b.expiresOn ?? null,
    usageLimit: b.usageLimit ?? null,
    oncePerCustomer: b.oncePerCustomer,
    allowDealers: b.allowDealers,
    enabled: b.enabled,
    target,
  })

  return { success: true, code }
})

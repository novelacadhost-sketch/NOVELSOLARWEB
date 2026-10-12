import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { MAX_DISCOUNT_PERCENT } from '../../../utils/promotions'
import { isCountedOrder, PROMO_CODE_COLUMNS, toPromoCode, type PromoCodeRow } from '../../../utils/promoCodes'

const PAGE = 1000

/** A stored instant as the Lagos calendar day an admin picked. Lagos is UTC+1 all year. */
const lagosDay = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 3600_000).toISOString().slice(0, 10) : null)

/** The Promotions page: settings, staff codes, promo codes with their usage, and the change history. */
export default defineEventHandler(async () => {
  const supabase = getSupabaseAdminClient()

  // Read directly, not through getPromotionSettings(): that one fails closed to
  // "off, 0%" for checkout's sake, which here would show an admin a setting
  // that is not the real one.
  const [settingsResult, codesResult, promoResult, changesResult] = await Promise.all([
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
    supabase.from('promo_codes').select(PROMO_CODE_COLUMNS).order('created_at', { ascending: false }),
    supabase
      .from('promotion_changes')
      .select('created_at, admin_email, action, details')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (settingsResult.error || codesResult.error || promoResult.error) {
    throw createError({ statusCode: 500, statusMessage: 'Could not read the promotion settings.' })
  }

  // Uses and discount given per promo code, by the same rule that enforces the
  // usage limit, so the number an admin sees is the number checkout counts.
  const usage = new Map<string, { uses: number; discountGiven: number }>()
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase
      .from('orders')
      .select('promo_code, status, payment_method, created_at, discount_amount')
      .not('promo_code', 'is', null)
      .range(start, start + PAGE - 1)
    if (error) throw createError({ statusCode: 500, statusMessage: 'Could not count promo code uses.' })
    const rows = (data ?? []) as {
      promo_code: string
      status: string
      payment_method: string | null
      created_at: string
      discount_amount: number | string
    }[]
    for (const row of rows) {
      if (!isCountedOrder(row)) continue
      const entry = usage.get(row.promo_code) ?? { uses: 0, discountGiven: 0 }
      entry.uses++
      entry.discountGiven += Number(row.discount_amount) || 0
      usage.set(row.promo_code, entry)
    }
    if (rows.length < PAGE) break
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
    promoCodes: ((promoResult.data ?? []) as unknown as PromoCodeRow[]).map((row) => {
      const promo = toPromoCode(row)
      return {
        ...promo,
        startsOn: lagosDay(promo.startsAt),
        expiresOn: lagosDay(promo.expiresAt),
        uses: usage.get(promo.code)?.uses ?? 0,
        discountGiven: usage.get(promo.code)?.discountGiven ?? 0,
      }
    }),
    changes: changesResult.data ?? [],
  }
})

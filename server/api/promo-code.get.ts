import { resolveIsDealerFromEvent } from '../utils/dealerCheck'
import { REJECT_MESSAGES, resolvePromotion } from '../utils/promotions'
import { getSupabaseAdminClient } from '../utils/supabaseAdmin'
import { logger } from '../utils/logger'
import { describeTarget, targetCovers, type PromotionTarget } from '#shared/promotionTarget'

const MAX_ITEMS = 50

/**
 * GET /api/promo-code?code=NOVEL10[&items=19736,20352]
 *
 * Lets checkout say "code applied" while the customer is still typing. Checkout
 * decides again on submit; nothing here is binding. Also served at
 * /api/staff-code, the name it had before promo codes existed.
 *
 * Answers only whether the code works and its terms for THIS caller — never
 * whose code it is, which would make it a staff directory for anyone willing
 * to try codes. Rate limited for the same reason. Once-per-customer cannot be
 * checked here (no email yet); checkout refuses a repeat with a 409.
 *
 * With `items` (the cart's product ids) it also says which of them the
 * discount covers, so the preview can show a code that applies only to some
 * products. Sections come from the product mirror; checkout itself reads them
 * from Bitrix.
 */
export default defineEventHandler(async (event) => {
  // The answer depends on who is asking (dealers), so never cache it.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const query = getQuery(event)
  const code = query.code
  const resolved = await resolvePromotion({
    typed: typeof code === 'string' ? code : '',
    isDealer: await resolveIsDealerFromEvent(event),
  })

  const terms = resolved.terms
  const items =
    typeof query.items === 'string'
      ? [...new Set(query.items.split(',').map((id) => id.trim()).filter((id) => /^\d{1,12}$/.test(id)))].slice(0, MAX_ITEMS)
      : null

  return {
    valid: resolved.status === 'applied',
    code: resolved.code,
    kind: resolved.kind,
    // Set when valid is false: why, and what to tell the customer.
    reason: resolved.rejectReason,
    message: resolved.rejectReason ? REJECT_MESSAGES[resolved.rejectReason] : null,
    discountType: terms?.type ?? null,
    discountValue: terms?.value ?? 0,
    // Kept for clients written before fixed-amount codes.
    discountPercent: terms?.type === 'percent' ? terms.value : 0,
    // 'dealer' or 'disabled' when the code is accepted but takes nothing off.
    noDiscountReason: resolved.noDiscountReason,
    // The cart is not known here, so these are the terms, not the outcome. 0 = none.
    // Both are measured on the covered items only.
    minOrderAmount: terms?.minOrderAmount ?? 0,
    maxDiscountAmount: terms?.maxDiscountAmount ?? 0,
    // 'all' | 'sections' | 'products', and the same in words ("Inverters").
    appliesTo: terms?.target.appliesTo ?? 'all',
    appliesToLabel: terms ? describeTarget(terms.target) : null,
    // Of the `items` sent, those the discount covers. Null when no items were sent.
    eligibleProductIds: terms && items ? await coveredItems(terms.target, items) : null,
  }
})

async function coveredItems(target: PromotionTarget, ids: string[]): Promise<string[]> {
  if (target.appliesTo === 'all') return ids
  if (target.appliesTo === 'products') return ids.filter((id) => target.productIds.includes(id))
  if (!ids.length) return []
  const { data, error } = await getSupabaseAdminClient().from('products').select('id, section_name').in('id', ids)
  if (error) {
    // The preview then shows no discount; checkout still decides from Bitrix.
    logger.warn('PromoCode', 'Section lookup failed for the preview', { error: error.message })
    return []
  }
  const rows = (data ?? []) as { id: string; section_name: string | null }[]
  return rows.filter((row) => targetCovers(target, { id: row.id, sectionName: row.section_name })).map((row) => String(row.id))
}

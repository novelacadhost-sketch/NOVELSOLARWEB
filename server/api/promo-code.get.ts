import { resolveIsDealerFromEvent } from '../utils/dealerCheck'
import { REJECT_MESSAGES, resolvePromotion } from '../utils/promotions'

/**
 * GET /api/promo-code?code=NOVEL10
 *
 * Lets checkout say "code applied" while the customer is still typing. Checkout
 * decides again on submit; nothing here is binding. Also served at
 * /api/staff-code, the name it had before promo codes existed.
 *
 * Answers only whether the code works and its terms for THIS caller — never
 * whose code it is, which would make it a staff directory for anyone willing
 * to try codes. Rate limited for the same reason. Once-per-customer cannot be
 * checked here (no email yet); checkout refuses a repeat with a 409.
 */
export default defineEventHandler(async (event) => {
  // The answer depends on who is asking (dealers), so never cache it.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const code = getQuery(event).code
  const resolved = await resolvePromotion({
    typed: typeof code === 'string' ? code : '',
    isDealer: await resolveIsDealerFromEvent(event),
  })

  const terms = resolved.terms
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
    minOrderAmount: terms?.minOrderAmount ?? 0,
    maxDiscountAmount: terms?.maxDiscountAmount ?? 0,
  }
})

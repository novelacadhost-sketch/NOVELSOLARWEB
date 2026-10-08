import { resolveIsDealerFromEvent } from '../utils/dealerCheck'
import { resolveReferral } from '../utils/promotions'

/**
 * GET /api/staff-code?code=DAFO12
 *
 * Lets checkout say "code applied" while the customer is still typing. Checkout
 * itself decides again on submit; nothing here is binding.
 *
 * Answers only whether the code works and what it is worth to THIS caller —
 * never whose code it is. Names would turn it into a staff directory for anyone
 * willing to try codes, and it is rate limited for the same reason.
 */
export default defineEventHandler(async (event) => {
  // The rate depends on who is asking (dealers get none), so never cache it.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const code = getQuery(event).code
  const referral = await resolveReferral(typeof code === 'string' ? code : '', await resolveIsDealerFromEvent(event))

  return {
    valid: referral.status === 'applied',
    code: referral.code,
    discountPercent: referral.discountPercent,
    // 'dealer' or 'disabled' when the code is accepted but takes nothing off.
    noDiscountReason: referral.noDiscountReason,
    // The cart is not known here, so these are the terms, not the outcome: the
    // order gets nothing under the minimum and never more than the cap. 0 = none.
    minOrderAmount: referral.minOrderAmount,
    maxDiscountAmount: referral.maxDiscountAmount,
  }
})

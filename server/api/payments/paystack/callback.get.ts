import { logger } from '../../../utils/logger'
import { isPaid, verifyTransaction } from '../../../utils/paystack'
import { recordPaystackPayment } from '../../../utils/recordPayment'

/**
 * Where Paystack returns the customer's browser after payment. Set this as the
 * callback URL in the dashboard, and/or pass it as `callback_url` when
 * initialising a transaction.
 *
 * Paystack appends `?reference=…&trxref=…`, and that is the whole problem with
 * this route: it is a plain GET anyone can type, with the reference on show.
 * So the query string decides nothing. It names a transaction; Paystack is
 * asked what happened to it, and the answer is what counts.
 *
 * This route only redirects. The customer ends up on /thank-you either way,
 * because the order exists regardless of whether the payment landed — the
 * banner there tells them which.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  // trxref and reference are the same value; Paystack sends both.
  const reference = String(query.reference || query.trxref || '').trim()

  if (!reference) {
    return sendRedirect(event, '/thank-you?payment=unknown', 302)
  }

  try {
    const transaction = await verifyTransaction(reference)

    if (!isPaid(transaction)) {
      logger.info('PaystackCallback', 'Customer returned from an unpaid transaction', {
        reference,
        status: transaction.status,
      })
      return sendRedirect(event, `/thank-you?payment=failed&ref=${encodeURIComponent(reference)}`, 302)
    }

    // The webhook usually gets here first. recordPaystackPayment is repeatable
    // precisely so whichever arrives second changes nothing.
    const outcome = await recordPaystackPayment(event, transaction)

    if (outcome.result === 'amount_mismatch') {
      return sendRedirect(event, `/thank-you?payment=review&ref=${encodeURIComponent(reference)}`, 302)
    }

    return sendRedirect(event, `/thank-you?payment=success&ref=${encodeURIComponent(reference)}`, 302)
  } catch (err) {
    // Verification itself failed — Paystack unreachable, or a bad key. The
    // customer may well have paid, so this must not read as failure to them.
    logger.error('PaystackCallback', 'Could not verify transaction', {
      reference,
      error: err instanceof Error ? err.message : String(err),
    })
    return sendRedirect(event, `/thank-you?payment=pending&ref=${encodeURIComponent(reference)}`, 302)
  }
})

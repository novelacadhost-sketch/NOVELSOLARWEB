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
 * This route only redirects. The order exists regardless of whether the
 * payment landed, so the customer always gets a result page — /thank-you on
 * the website, /payment-complete.html in the app — and it says which.
 */

/**
 * Where to send the customer once the outcome is known.
 *
 * The mobile app loads Paystack in a WebView and needs to be handed the
 * result, not dropped on the website's thank-you page — so an order placed by
 * the app goes to /payment-complete.html, a bridge page that passes the
 * outcome to the app and closes the loop.
 *
 * The flag comes from the transaction's metadata as returned by Paystack's
 * verify call, which our server set when it opened the transaction. It is
 * deliberately not read from this request's query string, which anyone can
 * edit. Only the verified paths have it; the rare can't-verify path cannot
 * know, and falls back to /thank-you — which the app also treats as done.
 */
function destinationFor(metadata: unknown): string {
  let meta = metadata
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta)
    } catch {
      meta = null
    }
  }
  const client = meta && typeof meta === 'object' ? (meta as Record<string, unknown>).client : undefined
  return client === 'app' ? '/payment-complete.html' : '/thank-you'
}

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
      return sendRedirect(
        event,
        `${destinationFor(transaction.metadata)}?payment=failed&ref=${encodeURIComponent(reference)}`,
        302,
      )
    }

    // The webhook usually gets here first. recordPaystackPayment is repeatable
    // precisely so whichever arrives second changes nothing.
    const outcome = await recordPaystackPayment(event, transaction)

    const destination = destinationFor(transaction.metadata)

    if (outcome.result === 'amount_mismatch') {
      return sendRedirect(event, `${destination}?payment=review&ref=${encodeURIComponent(reference)}`, 302)
    }

    return sendRedirect(event, `${destination}?payment=success&ref=${encodeURIComponent(reference)}`, 302)
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

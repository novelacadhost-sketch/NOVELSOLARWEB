import { logger } from '../../../utils/logger'
import { isPaid, verifyPaystackSignature, type PaystackTransaction } from '../../../utils/paystack'
import { recordPaystackPayment } from '../../../utils/recordPayment'

/**
 * Paystack webhook. Set this URL in Dashboard -> Settings -> API Keys &
 * Webhooks.
 *
 * The path contains "webhook", which is what exempts it from CSRF and rate
 * limiting — both middlewares match on that substring. Renaming it silently
 * re-arms both and every Paystack delivery starts failing, so do not.
 *
 * Authentication is the signature, nothing else. There is no cookie, no token
 * in the URL, and the body is the only thing that proves the sender.
 *
 * ALWAYS ANSWER 200 ONCE THE SIGNATURE CHECKS OUT. Paystack retries anything
 * else for days, and a retry cannot fix a problem on our side — the event is
 * already recorded in their dashboard, and the callback plus the verify API
 * are the recovery path. A non-200 is reserved for "this was not Paystack".
 */
export default defineEventHandler(async (event) => {
  // Must be the raw bytes: re-serialising the parsed body changes key order
  // and whitespace, and the HMAC then never matches.
  const rawBody = await readRawBody(event, 'utf8')

  if (!rawBody) {
    setResponseStatus(event, 400)
    return { received: false }
  }

  const signature = getHeader(event, 'x-paystack-signature')
  if (!verifyPaystackSignature(rawBody, signature)) {
    logger.warn('PaystackWebhook', 'Rejected unsigned or badly signed request', {
      hasSignature: Boolean(signature),
      bytes: rawBody.length,
    })
    // 401, not 400: this is an authentication failure, and saying so keeps a
    // misconfigured secret distinguishable from a malformed payload in logs.
    setResponseStatus(event, 401)
    return { received: false }
  }

  let payload: { event?: string; data?: PaystackTransaction }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    setResponseStatus(event, 400)
    return { received: false }
  }

  const eventName = payload.event ?? 'unknown'
  const transaction = payload.data

  if (!transaction?.reference) {
    logger.warn('PaystackWebhook', 'Signed event carried no transaction reference', { event: eventName })
    return { received: true, handled: false }
  }

  logger.info('PaystackWebhook', 'Received event', {
    event: eventName,
    reference: transaction.reference,
    status: transaction.status,
  })

  // charge.success is the only event that settles an order today. The rest are
  // acknowledged so Paystack stops retrying, and logged so adding one later is
  // a matter of reading the logs rather than guessing what arrives.
  if (eventName !== 'charge.success' || !isPaid(transaction)) {
    return { received: true, handled: false, event: eventName }
  }

  const outcome = await recordPaystackPayment(event, transaction)
  return { received: true, handled: true, outcome: outcome.result }
})

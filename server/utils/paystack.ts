import { createHmac, timingSafeEqual } from 'node:crypto'
import { logger } from './logger'

/**
 * Paystack plumbing: signature verification and server-side transaction lookup.
 *
 * TWO RULES THIS FILE EXISTS TO ENFORCE.
 *
 * 1. A webhook is only trustworthy if its signature checks out against the RAW
 *    request body. Re-serialising the parsed JSON will not reproduce Paystack's
 *    byte order and the HMAC will not match, so callers must pass the raw body.
 *
 * 2. Nothing the browser hands back is evidence of payment. The callback URL
 *    carries `?reference=` in plain sight, so anyone can visit it with any
 *    reference; the only proof is asking Paystack directly, which is what
 *    verifyTransaction does.
 */

const PAYSTACK_API = 'https://api.paystack.co'

/** Paystack works in the minor unit — kobo for NGN. 1000 naira is 100000. */
export const toKobo = (naira: number) => Math.round(naira * 100)
export const fromKobo = (kobo: number) => kobo / 100

export function getPaystackSecret(): string {
  const key = useRuntimeConfig().paystackSecretKey
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured')
  return String(key)
}

/**
 * Timing-safe compare of the `x-paystack-signature` header.
 *
 * Returns false rather than throwing on a malformed header: an unsigned or
 * badly signed POST is a rejected request, not a server fault.
 */
export function verifyPaystackSignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false

  let expected: string
  try {
    expected = createHmac('sha512', getPaystackSecret()).update(rawBody, 'utf8').digest('hex')
  } catch (err) {
    logger.error('Paystack', 'Cannot verify signature; secret key missing', {
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  // timingSafeEqual throws on a length mismatch, which is itself a leak of
  // sorts — compare lengths first and bail without touching it.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export interface PaystackTransaction {
  id: number
  status: string
  reference: string
  /** Minor unit. Divide by 100 for naira. */
  amount: number
  currency: string
  channel?: string
  paid_at?: string | null
  customer?: { email?: string }
  metadata?: Record<string, unknown> | string | null
}

interface PaystackEnvelope<T> {
  status: boolean
  message?: string
  data?: T
}

/**
 * Ask Paystack what actually happened to a reference.
 *
 * Throws on anything other than a clean answer, because the caller is deciding
 * whether to treat an order as paid and "we could not check" must never read
 * as "it was fine".
 */
export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  const response = await $fetch<PaystackEnvelope<PaystackTransaction>>(
    `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${getPaystackSecret()}` } },
  )

  if (!response.status || !response.data) {
    throw new Error(response.message || 'Paystack verification returned no data')
  }
  return response.data
}

/**
 * A transaction is only settled when Paystack says `success`. Every other
 * status — abandoned, failed, ongoing, pending, reversed — is not payment.
 */
export const isPaid = (transaction: Pick<PaystackTransaction, 'status'>) => transaction.status === 'success'

export interface InitialisedTransaction {
  authorization_url: string
  access_code: string
  reference: string
}

export interface InitialiseArgs {
  /** The ORD-… id. Becomes orders.client_order_ref, which is how a payment finds its order. */
  reference: string
  /** Naira. Converted to kobo here so no caller has to remember. */
  amount: number
  email: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}

/**
 * Open a transaction and get the URL to send the customer to.
 *
 * THE AMOUNT MUST BE SERVER-DERIVED. This is called from /api/checkout with
 * the total that resolveTrustedCart() computed from Bitrix with the dealer
 * gate applied — never with a number the browser sent, or the customer picks
 * their own price.
 *
 * Throws. A caller that cannot open a transaction has to tell the customer,
 * not quietly hand them an order they have no way to pay for.
 */
export async function initialiseTransaction(args: InitialiseArgs): Promise<InitialisedTransaction> {
  const response = await $fetch<PaystackEnvelope<InitialisedTransaction>>(`${PAYSTACK_API}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getPaystackSecret()}` },
    body: {
      reference: args.reference,
      amount: toKobo(args.amount),
      email: args.email,
      callback_url: args.callbackUrl,
      currency: 'NGN',
      metadata: args.metadata ?? {},
    },
  })

  if (!response.status || !response.data?.authorization_url) {
    throw new Error(response.message || 'Paystack did not return an authorization url')
  }
  return response.data
}

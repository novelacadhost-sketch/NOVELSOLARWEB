import { timingSafeEqual } from 'node:crypto'
import { readBody, sendRedirect } from 'h3'
import type { H3Event } from 'h3'
import { verifyBitrixApplicationToken } from '../../utils/bitrixWebhookVerify'
import { bindProductEvents, buildHandlerUrl } from '../../utils/bitrixEventBindings'
import { logger } from '../../utils/logger'

/**
 * End the request without Nitro's error envelope.
 *
 * `createError` produces a JSON body that includes the request `url` — and this
 * endpoint's shared secret travels in the query string (`?t=…`), so every error
 * response echoed the token back in plain text, into anything that captured the
 * body. Returning a bare status and a fixed message keeps it out.
 *
 * The status code is what Bitrix acts on; it ignores the body entirely.
 */
function fail(event: H3Event, status: number, message: string) {
  setResponseStatus(event, status)
  return { success: false, message }
}

/** Constant-time compare that tolerates length mismatches without leaking them. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the failure isn't distinguishable by timing.
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

/**
 * Pull the product id out of a Bitrix event payload, whichever shape it arrives in.
 *
 * Bitrix posts events as `application/x-www-form-urlencoded` with bracket keys
 * (`data[FIELDS][ID]=218`). h3's `readBody` hands that back **flat** — the key
 * is the literal string `"data[FIELDS][ID]"` — so the nested read this handler
 * used to do (`body.data.FIELDS.ID`) was always undefined for a real webhook.
 * It then returned `{ success: true, message: 'Event accepted (no product id)' }`,
 * so Bitrix recorded a 200 and never retried. Verified against production on
 * 2026-09-15 with a synthetic event.
 *
 * Both shapes are accepted because a JSON-bodied caller (our own tests, or a
 * future OAuth app) does produce the nested form. FIELDS_AFTER is checked first
 * for ADD; some Bitrix versions send FIELDS there instead, so fall through
 * rather than assume.
 */
function extractProductId(body: Record<string, unknown> | undefined): string | null {
  if (!body) return null

  const nested = body.data as { FIELDS?: { ID?: unknown }; FIELDS_AFTER?: { ID?: unknown } } | undefined
  const candidates = [
    nested?.FIELDS_AFTER?.ID,
    nested?.FIELDS?.ID,
    body['data[FIELDS_AFTER][ID]'],
    body['data[FIELDS][ID]'],
  ]

  for (const value of candidates) {
    if (value === undefined || value === null) continue
    const id = String(value).trim()
    if (id) return id
  }

  return null
}

interface BitrixUserCurrentResponse {
  result?: {
    ID?: string | number
    ADMIN?: boolean | string
    [key: string]: unknown
  }
  error?: string | boolean
  error_description?: string
}

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    return fail(event, 405, 'Method Not Allowed')
  }

  const body = await readBody(event)

  // Defence-in-depth: verify Bitrix application_token before processing.
  // This endpoint is exempt from CSRF and admin guards, so the token is the
  // only proof that the request originated from our Bitrix24 portal.
  const { bitrixApplicationToken, bitrixHandlerToken } = useRuntimeConfig()

  // Shared secret embedded in the handler URL configured on the Bitrix side
  // (?t=...). Bitrix's own application_token is only ever delivered in the
  // request body, never shown in its UI, so this is the practical way to
  // authenticate the caller. Checked first: when set it is authoritative, and
  // unlike the application_token check it does not fail open.
  if (bitrixHandlerToken) {
    const supplied = String(getQuery(event).t ?? '')
    if (!timingSafeEqualStr(supplied, String(bitrixHandlerToken))) {
      logger.warn('Bitrix Webhook', 'Rejected request with missing or invalid handler token')
      return fail(event, 403, 'Forbidden')
    }
  }

  const tokenCheck = verifyBitrixApplicationToken(body ?? {}, bitrixApplicationToken as string)
  if (!tokenCheck.valid) {
    return fail(event, 403, 'Forbidden')
  }

  if (!bitrixHandlerToken && tokenCheck.reason === 'unconfigured') {
    logger.warn(
      'Bitrix Webhook',
      'Endpoint is UNAUTHENTICATED — set BITRIX_HANDLER_TOKEN (and add ?t=<value> to the Bitrix handler URL) or BITRIX_APPLICATION_TOKEN.',
    )
  }

  // Handle product sync webhooks
  const eventName = body?.event
  if (eventName === 'ONCRMPRODUCTUPDATE' || eventName === 'ONCRMPRODUCTADD' || eventName === 'ONCRMPRODUCTDELETE') {
    const config = useRuntimeConfig()
    const productId = extractProductId(body)

    if (!productId) {
      // 400, not 200: a product event with no id we can read is a payload we do
      // not understand, and answering "accepted" told Bitrix to stop retrying.
      logger.error('ProductSync', 'Product event carried no readable id', {
        eventName,
        bodyKeys: Object.keys(body ?? {}),
      })
      return fail(event, 400, 'Product event missing a readable product id')
    }

    // Awaited: on serverless the instance is frozen once the response is
    // sent, so a detached promise is killed mid-write. This previously
    // returned "Event accepted" whether or not the product actually synced,
    // which is why the mirror only ever caught updates intermittently.
    try {
      const { syncSingleProduct } = await import('../../utils/syncSingleProduct')
      await syncSingleProduct(String(productId), config)
      return { success: true, message: 'Event accepted', productId: String(productId) }
    } catch (error) {
      logger.error('ProductSync', 'Single product sync failed', { error, productId, eventName })
      // 500 so Bitrix records a delivery failure and retries, rather than
      // treating a silent no-op as success.
      return fail(event, 500, 'Product sync failed')
    }
  }

  const AUTH_ID = body?.AUTH_ID
  const DOMAIN = body?.DOMAIN

  if (!AUTH_ID || !DOMAIN) {
    return fail(event, 400, 'Missing Bitrix24 authentication tokens')
  }

  try {
    // 1. Fetch the user profile purely to decide where to redirect
    const userResponse = await $fetch<BitrixUserCurrentResponse>(`https://${DOMAIN}/rest/user.current?auth=${AUTH_ID}`)

    if (!userResponse || !userResponse.result) {
      throw new Error('Failed to retrieve user profile from Bitrix24')
    }

    // Bitrix24 returns ADMIN as a boolean or string depending on context, usually boolean true/false in REST
    const isAdmin = userResponse.result.ADMIN === true || userResponse.result.ADMIN === 'Y'

    // 2. Register product event handlers.
    //
    // This is the only point where we hold an OAuth token — event.bind is
    // denied to inbound-webhook auth — so if it does not happen here it does
    // not happen at all. Failures are logged, never fatal: the install itself
    // must still complete, and the daily CRON keeps the mirror correct.
    const runtime = useRuntimeConfig()
    if (AUTH_ID && DOMAIN) {
      try {
        await bindProductEvents(
          DOMAIN,
          AUTH_ID,
          buildHandlerUrl(runtime.public.baseUrl as string, runtime.bitrixHandlerToken as string | undefined),
        )
      } catch (bindError) {
        logger.error('Bitrix Auth', 'Event binding failed during install', { error: bindError })
      }
    }

    // 3. Redirect based on permissions
    const redirectUrl = isAdmin ? '/admin' : '/'
    return sendRedirect(event, redirectUrl)
  } catch (error) {
    logger.error('Bitrix Auth', 'Handler error', { error })
    return fail(event, 500, 'Authentication failed')
  }
})

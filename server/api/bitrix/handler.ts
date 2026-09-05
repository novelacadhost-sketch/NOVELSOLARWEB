import { timingSafeEqual } from 'node:crypto'
import { readBody, sendRedirect, setCookie, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { verifyBitrixApplicationToken } from '../../utils/bitrixWebhookVerify'
import { logger } from '../../utils/logger'

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

interface BitrixUserCurrentResponse {
  result?: {
    ID?: string | number
    ADMIN?: boolean | string
    [key: string]: unknown
  }
  error?: string | boolean
  error_description?: string
}

interface AuthSessionRow {
  id: string
}

interface AuthSessionUpdate {
  domain: string
  auth_id: string
  refresh_id?: string
  expires_at: string
  updated_at?: string
}

interface AuthSessionInsert extends AuthSessionUpdate {
  bitrix_user_id: string
  member_id: string
}

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
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
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }

  const tokenCheck = verifyBitrixApplicationToken(body ?? {}, bitrixApplicationToken as string)
  if (!tokenCheck.valid) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: invalid Bitrix application token' })
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
    const productId = eventName === 'ONCRMPRODUCTADD' ? body?.data?.FIELDS_AFTER?.ID : body?.data?.FIELDS?.ID

    if (!productId) {
      return { success: true, message: 'Event accepted (no product id)' }
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
      throw createError({ statusCode: 500, statusMessage: 'Product sync failed' })
    }
  }

  const member_id = body?.member_id
  const AUTH_ID = body?.AUTH_ID
  const REFRESH_ID = body?.REFRESH_ID
  const DOMAIN = body?.DOMAIN

  if (!AUTH_ID || !DOMAIN) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Bitrix24 authentication tokens' })
  }

  try {
    // 1. Fetch user profile to get bitrix_user_id and check admin status
    const userResponse = await $fetch<BitrixUserCurrentResponse>(`https://${DOMAIN}/rest/user.current?auth=${AUTH_ID}`)

    if (!userResponse || !userResponse.result) {
      throw new Error('Failed to retrieve user profile from Bitrix24')
    }

    const bitrixUserId = userResponse.result.ID?.toString()
    // Bitrix24 returns ADMIN as a boolean or string depending on context, usually boolean true/false in REST
    const isAdmin = userResponse.result.ADMIN === true || userResponse.result.ADMIN === 'Y'

    // Calculate expiration if provided (usually in seconds from now)
    const expiresAt = new Date()
    const authExpires = Number.parseInt(body.AUTH_EXPIRES || '3600', 10)
    expiresAt.setSeconds(expiresAt.getSeconds() + authExpires)

    // 2. Store credentials in Supabase auth_sessions.
    // `supabase` is untyped (no Database generic configured) so we narrow the
    // returned shape per query rather than casting the whole client.
    const supabase = getSupabaseAdminClient()
    const authSessions = supabase.from('auth_sessions')

    const { data: existingSession } = await authSessions
      .select('id')
      .eq('member_id', member_id || '')
      .eq('bitrix_user_id', bitrixUserId || '')
      .single<AuthSessionRow>()

    let sessionId: string

    if (existingSession?.id) {
      // Update
      const updatePayload: AuthSessionUpdate = {
        domain: DOMAIN,
        auth_id: AUTH_ID,
        refresh_id: REFRESH_ID,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('auth_sessions')
        .update(updatePayload as never)
        .eq('id', existingSession.id)
        .select('id')
        .single<AuthSessionRow>()

      if (error) throw error
      if (!data) throw new Error('Supabase returned no row after update')
      sessionId = data.id
    } else {
      // Insert
      const insertPayload: AuthSessionInsert = {
        bitrix_user_id: bitrixUserId || '',
        member_id: member_id || '',
        domain: DOMAIN,
        auth_id: AUTH_ID,
        refresh_id: REFRESH_ID,
        expires_at: expiresAt.toISOString(),
      }
      const { data, error } = await supabase
        .from('auth_sessions')
        .insert(insertPayload as never)
        .select('id')
        .single<AuthSessionRow>()

      if (error) throw error
      if (!data) throw new Error('Supabase returned no row after insert')
      sessionId = data.id
    }

    // 3. Set cookie
    setCookie(event, 'bitrix_session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: authExpires,
    })

    // 4. Redirect based on permissions
    const redirectUrl = isAdmin ? '/admin' : '/'
    return sendRedirect(event, redirectUrl)
  } catch (error) {
    logger.error('Bitrix Auth', 'Handler error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Authentication failed',
    })
  }
})

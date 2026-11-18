/**
 * Thin wrapper around the Bitrix24 REST webhook.
 *
 * This used to resolve a per-user OAuth context from a `bitrix_session`
 * cookie and the `auth_sessions` table — a leftover from before Supabase Auth
 * handled identity. That path was removed on 2026-09-14: `auth_sessions` had
 * never held a row, so every call already took the webhook fallback, and the
 * OAuth branch carried two latent faults (no `expires_at` check, and a
 * `refreshBitrixToken()` that nothing ever called, so an hour-old session
 * would have failed with no recovery).
 *
 * All Bitrix calls now go out as the service webhook. If per-user attribution
 * is ever needed, build it deliberately rather than reviving that code.
 */
export async function bitrixFetch<T>(endpoint: string, options: Record<string, unknown> = {}): Promise<T> {
  const config = useRuntimeConfig()
  const baseUrl = config.bitrixWebhookUrl as string | undefined

  if (!baseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server configuration error: Bitrix Webhook URL is missing.',
    })
  }

  // An external URL, so $fetch's internal-route typing does not apply. Casting
  // its typed result instead made TS compare it against every API route, which
  // hit "excessive stack depth" once one more route existed. Every call site
  // already asserts the Bitrix shape.
  const fetchExternal = $fetch as unknown as (url: string, opts: Record<string, unknown>) => Promise<T>
  return fetchExternal(`${baseUrl.replace(/\/$/, '')}/${endpoint}`, options)
}

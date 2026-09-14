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

  // Cast: $fetch's TypedInternalResponse cannot be proven equal to a caller
  // supplied generic, and every call site already asserts the Bitrix shape.
  return $fetch(`${baseUrl.replace(/\/$/, '')}/${endpoint}`, options) as Promise<T>
}

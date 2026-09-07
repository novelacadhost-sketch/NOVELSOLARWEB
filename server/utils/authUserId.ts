/**
 * Extract the Supabase user id from whatever `serverSupabaseUser()` returns.
 *
 * @nuxtjs/supabase resolves the session from the JWT claims rather than
 * calling the auth API, so the object it hands back is a claims payload —
 * `{ iss, sub, aud, exp, iat, email, phone, app_metadata, user_metadata,
 * role, aal, amr, session_id, is_anonymous }`. There is **no `id` field**;
 * the user id is the standard JWT subject, `sub`.
 *
 * Reading `.id` therefore yields `undefined`, which Postgres rejects with
 * `invalid input syntax for type uuid: "undefined"` — and because the call
 * sites wrap the lookup in try/catch, that failed silently and every approved
 * dealer was served retail pricing.
 *
 * Falls back to `.id` so this keeps working if the module reverts to
 * returning a full User object.
 */
export function getAuthUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null
  const u = user as { sub?: unknown; id?: unknown }
  if (typeof u.sub === 'string' && u.sub) return u.sub
  if (typeof u.id === 'string' && u.id) return u.id
  return null
}

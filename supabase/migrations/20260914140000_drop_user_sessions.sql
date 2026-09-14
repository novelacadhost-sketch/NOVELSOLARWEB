-- Drop the second customer session store and the duplicate contact-link table.
--
-- `user_sessions` held { token, contact_id, email } behind an `auth_token`
-- cookie. It was never an alternative login: /api/auth/session required a
-- valid Supabase session first, then cached which Bitrix CRM contact the
-- customer maps to. That is a permanent property of the user, not of a
-- session, and `profiles.bitrix_contact_id` already existed for it — with an
-- index — and was read by nothing.
--
-- `bitrix_contact_links` (user_id -> bitrix_contact_id) was a third store for
-- the same fact. No application code has ever read or written it.
--
-- Safe to drop as of 2026-09-14:
--   * `user_sessions` is empty — no customer has completed the /confirm flow
--     on this project, so there is no live token to invalidate
--   * `bitrix_contact_links` is empty and has no reader in the codebase
--   * server/utils/userSession.ts is deleted; the `auth_token` cookie is no
--     longer set, read, or cleared anywhere
--
-- The link now lives on profiles.bitrix_contact_id, written by
-- server/utils/bitrixContact.ts on first sign-in.
--
-- Run only after the application change is deployed. Re-check both are empty:
--     SELECT count(*) FROM public.user_sessions;
--     SELECT count(*) FROM public.bitrix_contact_links;

DROP TABLE IF EXISTS public.user_sessions;
DROP TABLE IF EXISTS public.bitrix_contact_links;

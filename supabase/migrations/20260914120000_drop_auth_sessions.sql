-- Drop the Bitrix OAuth session store.
--
-- `auth_sessions` predates Supabase Auth: it held a per-user Bitrix24 OAuth
-- token, looked up from a `bitrix_session` cookie, so REST calls could be made
-- as the portal user who opened the iframe. Supabase Auth now owns identity and
-- all Bitrix calls go out as the service webhook.
--
-- Safe to drop as of 2026-09-14:
--   * the table is empty — no OAuth session was ever stored on this project
--   * the last reader (getBitrixContext in server/utils/bitrixAuth.ts) is gone
--   * the writer (server/api/bitrix/handler.ts) no longer touches it
--
-- Run only after the application change is deployed, so nothing is mid-flight.
-- Re-check it is still empty first:
--     SELECT count(*) FROM public.auth_sessions;

DROP TABLE IF EXISTS public.auth_sessions;

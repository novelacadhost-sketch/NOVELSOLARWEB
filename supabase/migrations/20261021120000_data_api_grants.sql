-- Data API grants, written down.
--
-- From 30 October 2026 Supabase stops granting anon / authenticated / service_role
-- access to NEW tables in "public" automatically. Existing tables keep what they
-- have, so the live project is unaffected, but a database rebuilt from these
-- migrations (new project, branch, `supabase db reset`) would create tables that
-- nothing can reach: eight earlier migrations, the baseline included, rely on the
-- old automatic grants. This restates the live project's grants as read on
-- 2026-10-21, so applying it to the live project changes nothing.
--
-- Every table here has row-level security on; a grant only lets a role reach the
-- table, and RLS decides which rows. Several of these grants are wider than the
-- policies need (e.g. anon on admin_profiles / admin_sessions, which RLS blocks
-- entirely); they are copied as they are, not endorsed. Tightening them is a
-- separate change.
--
-- notifications, user_fcm_tokens and the product_categories view were created by
-- hand for the mobile app and are in no migration, so their grants are skipped
-- when they do not exist.
--
-- Any NEW table must carry its own GRANT statements from now on.

DO $grants$
DECLARE
  g record;
BEGIN
  FOR g IN
    SELECT * FROM (VALUES
      ('admin_profiles', 'anon', 'ALL'),
      ('admin_profiles', 'authenticated', 'ALL'),
      ('admin_profiles', 'service_role', 'ALL'),
      ('admin_sessions', 'anon', 'ALL'),
      ('admin_sessions', 'authenticated', 'ALL'),
      ('admin_sessions', 'service_role', 'ALL'),
      ('admin_settings', 'anon', 'ALL'),
      ('admin_settings', 'authenticated', 'ALL'),
      ('admin_settings', 'service_role', 'ALL'),
      ('bitrix_order_links', 'anon', 'ALL'),
      ('bitrix_order_links', 'authenticated', 'ALL'),
      ('bitrix_order_links', 'service_role', 'ALL'),
      ('cart_items', 'authenticated', 'ALL'),
      ('cart_items', 'service_role', 'ALL'),
      ('crm_outbox', 'service_role', 'ALL'),
      ('dealer_applications', 'anon', 'INSERT'),
      ('dealer_applications', 'authenticated', 'INSERT, SELECT, UPDATE'),
      ('dealer_applications', 'service_role', 'ALL'),
      ('dealer_invitations', 'service_role', 'ALL'),
      ('newsletter_subscribers', 'service_role', 'ALL'),
      ('notifications', 'anon', 'ALL'),
      ('notifications', 'authenticated', 'ALL'),
      ('notifications', 'service_role', 'ALL'),
      ('order_events', 'authenticated', 'REFERENCES, SELECT, TRIGGER, TRUNCATE'),
      ('order_events', 'service_role', 'ALL'),
      ('order_items', 'anon', 'INSERT, SELECT'),
      ('order_items', 'authenticated', 'ALL'),
      ('order_items', 'service_role', 'ALL'),
      ('orders', 'anon', 'INSERT, SELECT'),
      ('orders', 'authenticated', 'ALL'),
      ('orders', 'service_role', 'ALL'),
      ('partners', 'service_role', 'ALL'),
      ('product_categories', 'anon', 'ALL'),
      ('product_categories', 'authenticated', 'ALL'),
      ('product_categories', 'service_role', 'ALL'),
      ('product_visibility', 'service_role', 'ALL'),
      ('products', 'anon', 'SELECT'),
      ('products', 'authenticated', 'SELECT'),
      ('products', 'service_role', 'ALL'),
      ('profiles', 'authenticated', 'REFERENCES, SELECT, TRIGGER, TRUNCATE'),
      ('profiles', 'service_role', 'ALL'),
      ('promo_codes', 'service_role', 'ALL'),
      ('promotion_changes', 'service_role', 'ALL'),
      ('promotion_settings', 'service_role', 'ALL'),
      ('public_products', 'anon', 'ALL'),
      ('public_products', 'authenticated', 'ALL'),
      ('public_products', 'service_role', 'ALL'),
      ('site_content', 'service_role', 'ALL'),
      ('staff_codes', 'authenticated', 'SELECT, UPDATE'),
      ('staff_codes', 'service_role', 'ALL'),
      ('sync_meta', 'anon', 'ALL'),
      ('sync_meta', 'authenticated', 'ALL'),
      ('sync_meta', 'service_role', 'ALL'),
      ('user_fcm_tokens', 'anon', 'ALL'),
      ('user_fcm_tokens', 'authenticated', 'ALL'),
      ('user_fcm_tokens', 'service_role', 'ALL')
    ) AS v(tbl, grantee, privs)
  LOOP
    IF to_regclass('public.' || g.tbl) IS NOT NULL THEN
      EXECUTE format('GRANT %s ON public.%I TO %I', g.privs, g.tbl, g.grantee);
    END IF;
  END LOOP;
END
$grants$;

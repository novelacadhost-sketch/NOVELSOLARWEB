-- Post-cutover verification. Run on the NEW project after the baseline.
-- Every row should read PASS.
WITH t AS (
  SELECT c.relname, c.relrowsecurity,
         (SELECT count(*) FROM information_schema.role_table_grants g
           WHERE g.table_schema = 'public' AND g.table_name = c.relname
             AND g.grantee IN ('anon', 'authenticated'))::int AS pub_grants
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
)
SELECT '1. table count' AS check,
       count(*)::text || ' of 16' AS actual,
       CASE WHEN count(*) = 16 THEN 'PASS' ELSE 'FAIL' END AS result
FROM t
UNION ALL
SELECT '2. RLS enabled everywhere',
       coalesce(string_agg(relname, ', ') FILTER (WHERE NOT relrowsecurity), 'all 16 enabled'),
       CASE WHEN count(*) FILTER (WHERE NOT relrowsecurity) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM t
UNION ALL
SELECT '3. dealer tables deny anon',
       coalesce(string_agg(relname || '=' || pub_grants, ', '), 'tables missing'),
       CASE WHEN coalesce(sum(pub_grants), -1) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM t WHERE relname IN ('dealer_applications', 'dealer_invitations')
UNION ALL
SELECT '4. enum types',
       count(DISTINCT t.typname)::text || ' of 4',
       CASE WHEN count(DISTINCT t.typname) = 4 THEN 'PASS' ELSE 'FAIL' END
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
UNION ALL
SELECT '5. RLS policies',
       count(*)::text || ' of 16',
       CASE WHEN count(*) = 16 THEN 'PASS' ELSE 'FAIL' END
FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT '6. tables the app queries',
       coalesce(string_agg(x, ', '), 'none missing'),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM unnest(ARRAY['admin_profiles','admin_sessions','auth_sessions','dealer_applications',
                  'dealer_invitations','orders','products','profiles','sync_meta','user_sessions']) AS x
WHERE x NOT IN (SELECT relname FROM t)
UNION ALL
SELECT '7. admin_settings is empty',
       (SELECT count(*)::text FROM public.admin_settings) || ' rows (want 0 — no stale passcode)',
       CASE WHEN (SELECT count(*) FROM public.admin_settings) = 0 THEN 'PASS' ELSE 'FAIL' END
ORDER BY 1;

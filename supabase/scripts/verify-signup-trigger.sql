-- Verify the signup trigger after 20260916120000_handle_new_user_metadata.sql.
--
-- Paste into the Supabase SQL editor. Every row should read PASS.
-- Checks 4 and 5 are the ones that matter: they assert the function does NOT
-- take a role from client-supplied metadata, and cannot abort a signup.

SELECT '1. trigger exists on auth.users' AS check,
       coalesce(string_agg(t.tgname, ', '), 'MISSING') AS detail,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users'
  AND NOT t.tgisinternal
  AND t.tgname = 'on_auth_user_created'

UNION ALL
SELECT '2. function is SECURITY DEFINER',
       CASE WHEN p.prosecdef THEN 'yes' ELSE 'no — it cannot write profiles' END,
       CASE WHEN p.prosecdef THEN 'PASS' ELSE 'FAIL' END
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'

UNION ALL
SELECT '3. search_path is empty',
       coalesce(array_to_string(p.proconfig, ', '), 'NOT SET'),
       CASE WHEN 'search_path=' = ANY(coalesce(p.proconfig, '{}')) THEN 'PASS' ELSE 'FAIL' END
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'

UNION ALL
-- The important one. A role read from raw_user_meta_data is a role the person
-- signing up chose for themselves.
SELECT '4. role NOT taken from client metadata',
       CASE WHEN pg_get_functiondef(p.oid) ILIKE '%raw_user_meta_data->>''role''%'
            THEN 'FOUND — the function trusts client input'
            ELSE 'role is hardcoded' END,
       CASE WHEN pg_get_functiondef(p.oid) ILIKE '%raw_user_meta_data->>''role''%'
            THEN 'FAIL' ELSE 'PASS' END
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'

UNION ALL
-- Without this, a duplicate profile row aborts the whole signup: the trigger
-- runs inside that transaction.
SELECT '5. insert cannot abort signup',
       CASE WHEN pg_get_functiondef(p.oid) ILIKE '%on conflict%' THEN 'ON CONFLICT present' ELSE 'missing' END,
       CASE WHEN pg_get_functiondef(p.oid) ILIKE '%on conflict%' THEN 'PASS' ELSE 'FAIL' END
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'

UNION ALL
-- Everyone should have a profile. A non-zero count means accounts created
-- before the trigger, or a signup where it failed.
SELECT '6. auth users without a profile',
       count(*)::text || ' of ' || (SELECT count(*) FROM auth.users)::text,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'CHECK' END
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.admin_profiles a ON a.user_id = u.id
WHERE p.user_id IS NULL AND a.user_id IS NULL

UNION ALL
-- Nobody should hold a dealer role without an approval behind it.
SELECT '7. no self-declared dealers',
       coalesce(string_agg(DISTINCT role || '/' || dealer_status, ', '), 'none'),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.profiles
WHERE role = 'dealer' AND dealer_status <> 'approved'

UNION ALL
SELECT '8. profiles by role',
       coalesce(string_agg(r.role || ': ' || r.n::text, ', ' ORDER BY r.n DESC), 'none'),
       'INFO'
FROM (SELECT role, count(*) AS n FROM public.profiles GROUP BY role) r

UNION ALL
SELECT '9. names captured',
       (SELECT count(*) FROM public.profiles WHERE first_name IS NOT NULL)::text || ' with a first name, '
       || (SELECT count(*) FROM public.profiles WHERE phone IS NOT NULL)::text || ' with a phone',
       'INFO'
ORDER BY 1;

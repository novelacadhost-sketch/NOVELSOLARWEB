-- Capture the name and phone a user supplies at signup, and refuse the role.
--
-- Replaces the trigger added in 20260914160000, which only recorded the email.
-- The mobile client can pass details through supabase.auth.signUp():
--
--     signUp(email: e, password: p, data: {
--       'first_name': 'Ada', 'last_name': 'Obi', 'phone': '080...'
--     })
--
-- and the profile is populated on creation instead of staying blank until
-- someone edits it.
--
-- `role` is deliberately NOT read from that metadata, even though it is sitting
-- right there. `raw_user_meta_data` is whatever the CLIENT sent — anyone
-- signing up can put {"role": "dealer"} in it. Copying that into profiles.role
-- makes an authorization column a mirror of untrusted input.
--
-- It is not exploitable on its own: dealer_status stays 'none' and
-- resolveIsDealerFromEvent() requires role = 'dealer' AND
-- dealer_status = 'approved'. But it is one careless check away from mattering
-- — ROLES.md already warns that testing role without the status grants
-- wholesale pricing to rejected applicants — and self-declared dealers would
-- show up in the admin Customers list immediately. A role is granted by
-- approve-dealer after a human approves it. That is the only writer.
--
-- Two other deliberate choices:
--
--   search_path = ''  — a mutable search_path inside a SECURITY DEFINER
--   function is the classic escalation route. Every reference below is
--   schema-qualified, so the empty setting costs nothing. ('public' is better
--   than nothing but still resolvable.)
--
--   ON CONFLICT DO NOTHING — the trigger runs inside the signup transaction, so
--   an unhandled unique violation would abort the signup itself. A profile that
--   already exists is not a reason to refuse someone an account.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    email,
    first_name,
    last_name,
    phone,
    role,
    dealer_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    'customer',
    'none'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreated so the trigger is bound to the new definition on any Postgres
-- version that caches it, and so this migration stands alone if the earlier one
-- was never applied.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill names for anyone who signed up between the two triggers and supplied
-- them. Only fills blanks: a name the customer has since edited through
-- /api/user/profile is the better value and must not be overwritten by the
-- signup metadata.
UPDATE public.profiles p
SET
  first_name = COALESCE(p.first_name, NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), '')),
  last_name  = COALESCE(p.last_name,  NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), '')),
  phone      = COALESCE(p.phone,      NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''))
FROM auth.users u
WHERE u.id = p.user_id
  AND (p.first_name IS NULL OR p.last_name IS NULL OR p.phone IS NULL)
  AND u.raw_user_meta_data IS NOT NULL;

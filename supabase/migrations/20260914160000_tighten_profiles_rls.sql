-- Tighten RLS on public.profiles, and create the profile row at signup.
--
-- Context: a second developer building the mobile client was blocked inserting
-- a profile row after signup — there is no INSERT policy. The fix is NOT to add
-- one. `profiles` carries the dealer gate (role, dealer_status) and the dealer
-- onboarding token, so a client-side insert lets a customer write those columns
-- directly. The row is now created by a trigger instead, and the client never
-- needs to insert at all.
--
-- Two pre-existing faults are closed here as well.

-- ── 1. Create the profile at signup ──────────────────────────────────────
-- Nothing created a profiles row for a retail customer before 2026-09-14: the
-- only writers were the dealer approve/reject endpoints, which is why the admin
-- Customers list only ever showed dealers. SECURITY DEFINER so it runs as the
-- owner and needs no client privilege; ON CONFLICT so it cannot race with
-- resolveBitrixContactId() or approve-dealer's upsert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role, dealer_status)
  VALUES (NEW.id, NEW.email, 'customer', 'none')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. Stop every signed-in user reading every profile ───────────────────
-- The old policy was USING (true). That exposed all customer and dealer PII to
-- anyone holding any authenticated JWT, including `onboarding_token` — and
-- /api/dealer/create-account authenticates on nothing but that token, so a
-- leaked one is a password reset on the dealer's account.
--
-- Safe to narrow: every server read of this table uses the service role, which
-- bypasses RLS. The one user-scoped reader, server/api/dealer/auth/login.post.ts,
-- selects its own row by user_id and still matches.
DROP POLICY IF EXISTS "Allow authenticated read on profiles" ON public.profiles;
CREATE POLICY "Users can read their own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ── 3. Stop self-promotion to dealer ─────────────────────────────────────
-- The row-level check (auth.uid() = user_id) was already correct; the gap is
-- that RLS cannot restrict WHICH COLUMNS an update touches, so a customer could
-- set role='dealer', dealer_status='approved' on their own row and be served
-- dealer pricing. Column-level GRANTs are the mechanism for that.
DROP POLICY IF EXISTS "Allow authenticated update on own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (first_name, last_name, phone, address) ON public.profiles TO authenticated;

-- Defence in depth: there is no INSERT or DELETE policy, so both are already
-- refused. Revoking the grant as well means adding a policy later cannot
-- silently re-open them.
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;
REVOKE ALL ON public.profiles FROM anon;

-- ── 4. Backfill ──────────────────────────────────────────────────────────
-- Existing auth users predate the trigger. Idempotent.
--
-- Admins are excluded: an admin is a row in admin_profiles, never in profiles,
-- and admin/customers.get.ts lists everyone whose role is customer or dealer —
-- so giving an admin a customer profile would put them in the Customers console.
--
-- NOTE: the trigger cannot make this distinction. It fires on the auth.users
-- insert, before create-admin.post.ts writes admin_profiles, so a NEWLY created
-- admin will get a stray customer profile. Either delete it in create-admin
-- after the admin_profiles insert, or exclude admins from customers.get.ts.
INSERT INTO public.profiles (user_id, email, role, dealer_status)
SELECT u.id, u.email, 'customer', 'none'
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.admin_profiles a ON a.user_id = u.id
WHERE p.user_id IS NULL
  AND a.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

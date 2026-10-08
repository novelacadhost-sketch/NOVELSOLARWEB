-- Staff referral codes and the discount that goes with them.
--
-- Every staff member has a code (first two letters of the first name, first two
-- of the surname, then their Bitrix user id: Davies Folorunso, user 12, is
-- DAFO12). A customer who uses one is credited to that staff member, and a
-- retail customer also gets a discount. Dealers are credited but never
-- discounted: dealer pricing is already the discount.
--
-- APPLY THIS BEFORE DEPLOYING THE CODE THAT USES IT. /api/checkout writes the
-- new orders columns on every order; against a database without them the
-- order mirror fails, and a Paystack order whose mirror failed cannot get its
-- deal after payment.

-- 1. The codes. Built from Bitrix's employee list by the nightly sync.
CREATE TABLE IF NOT EXISTS public.staff_codes (
  -- Never changed once issued, even if the name is later corrected in Bitrix:
  -- a code already printed or shared must keep working.
  code text NOT NULL,
  bitrix_user_id integer NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  job_title text,
  email text,
  -- Active in Bitrix. Someone who leaves is switched off here by the sync; their
  -- past sales stay credited because orders keep the id, not a reference.
  in_bitrix boolean DEFAULT true NOT NULL,
  -- The admin's per-code switch, independent of Bitrix.
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid,
  CONSTRAINT staff_codes_pkey PRIMARY KEY (code),
  CONSTRAINT staff_codes_bitrix_user_id_key UNIQUE (bitrix_user_id),
  -- Upper case, letters then the id. Two to four letters, not exactly four, so
  -- a one-letter name cannot make the sync fail.
  CONSTRAINT staff_codes_code_format CHECK (code ~ '^[A-Z]{2,4}[0-9]+$')
);

-- 2. The promotion itself: one row, edited from the admin Promotions page.
CREATE TABLE IF NOT EXISTS public.promotion_settings (
  id smallint DEFAULT 1 NOT NULL,
  -- Off by default: the feature ships crediting staff but giving no discount,
  -- and an admin switches the discount on once it has been tested.
  discount_enabled boolean DEFAULT false NOT NULL,
  discount_percent numeric(5,2) DEFAULT 1 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid,
  CONSTRAINT promotion_settings_pkey PRIMARY KEY (id),
  CONSTRAINT promotion_settings_single_row CHECK (id = 1),
  -- The ceiling is a typo guard, not a business rule: "10" typed for "1.0"
  -- would otherwise take a tenth off every order.
  CONSTRAINT promotion_settings_percent_range CHECK (discount_percent >= 0 AND discount_percent <= 20)
);

INSERT INTO public.promotion_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. Who changed what, for the switch, the rate and the per-code switches.
CREATE TABLE IF NOT EXISTS public.promotion_changes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  admin_user_id text,
  admin_email text,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT promotion_changes_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS promotion_changes_created_at_idx
  ON public.promotion_changes USING btree (created_at DESC);

-- 4. What each order was given. subtotal is before the discount and total is
-- what was charged, so subtotal - discount_amount = total. The rate is stored
-- per order so changing it later never rewrites history.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS staff_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS staff_bitrix_id integer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) DEFAULT 0 NOT NULL;

-- Per unit, so a deal rebuilt after payment carries the same discount on each
-- product line as the order did. unit_price stays the undiscounted price.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_discount numeric(12,2) DEFAULT 0 NOT NULL;

-- The sales report filters on this; most orders have no code.
CREATE INDEX IF NOT EXISTS orders_staff_bitrix_id_idx
  ON public.orders USING btree (staff_bitrix_id, created_at)
  WHERE staff_bitrix_id IS NOT NULL;

-- Service role only. The codes table is a staff directory (names, emails, job
-- titles) and must not be listable with the public anon key; checkout looks a
-- code up server-side and the code-check endpoint never returns a name.
ALTER TABLE public.staff_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on staff_codes" ON public.staff_codes;
CREATE POLICY "Allow service role full access on staff_codes" ON public.staff_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on promotion_settings" ON public.promotion_settings;
CREATE POLICY "Allow service role full access on promotion_settings" ON public.promotion_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on promotion_changes" ON public.promotion_changes;
CREATE POLICY "Allow service role full access on promotion_changes" ON public.promotion_changes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.staff_codes FROM anon, authenticated;
REVOKE ALL ON public.promotion_settings FROM anon, authenticated;
REVOKE ALL ON public.promotion_changes FROM anon, authenticated;

-- Supabase grants this by default, but said explicitly so the server's access
-- does not depend on a project setting.
GRANT ALL ON public.staff_codes, public.promotion_settings, public.promotion_changes TO service_role;

-- Promo codes an admin creates, each with its own terms, alongside the staff
-- codes from 20261008120000.
--
-- The two kinds do different jobs. A staff code credits a member of staff and
-- carries the global terms in promotion_settings. A promo code (NOVEL10, say)
-- carries its own discount, dates and limits, and credits nobody — though a
-- staff member whose link the customer arrived through is still credited.

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code text NOT NULL,
  -- For admins only: what the code is for. Never shown to customers.
  description text,
  discount_type text NOT NULL,
  -- A percentage for 'percent', naira for 'fixed'.
  discount_value numeric(12,2) NOT NULL,
  -- 0 = no minimum. A fixed-amount code must have one (see the check below).
  min_order_amount numeric(12,2) DEFAULT 0 NOT NULL,
  -- 0 = no cap. Only meaningful for a percentage.
  max_discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
  -- Null = no start / no end.
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  -- Null = unlimited. Counted from real orders; see server/utils/promoCodes.ts.
  usage_limit integer,
  once_per_customer boolean DEFAULT true NOT NULL,
  -- Off by default: dealer pricing already is the dealer's discount.
  allow_dealers boolean DEFAULT false NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT promo_codes_pkey PRIMARY KEY (code),
  CONSTRAINT promo_codes_code_format CHECK (code ~ '^[A-Z0-9]{3,20}$'),
  CONSTRAINT promo_codes_discount_type CHECK (discount_type IN ('percent', 'fixed')),
  -- 90% is a typo guard: a whole order free is never what was meant.
  CONSTRAINT promo_codes_discount_value CHECK (
    discount_value > 0 AND (discount_type <> 'percent' OR discount_value <= 90)
  ),
  CONSTRAINT promo_codes_limits_non_negative CHECK (min_order_amount >= 0 AND max_discount_amount >= 0),
  -- Without a minimum above the amount, "₦5,000 off" would hand out a ₦5,000
  -- product for free, and "₦80,000 off" with a ₦50,000 minimum a ₦60,000 order.
  CONSTRAINT promo_codes_fixed_needs_minimum CHECK (discount_type <> 'fixed' OR min_order_amount > discount_value),
  CONSTRAINT promo_codes_dates CHECK (starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT promo_codes_usage_limit CHECK (usage_limit IS NULL OR usage_limit > 0)
);

-- The code that gave the order its discount, when it was a promo code. The
-- staff_code columns from 20261008120000 now mean "who is credited", which may
-- come from a staff link even when a promo code gave the discount.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code text;

-- Usage limits count orders per code, and once-per-customer counts them per
-- code and email.
CREATE INDEX IF NOT EXISTS orders_promo_code_idx
  ON public.orders USING btree (promo_code, created_at)
  WHERE promo_code IS NOT NULL;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on promo_codes" ON public.promo_codes;
CREATE POLICY "Allow service role full access on promo_codes" ON public.promo_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- A list of every live promo code would be worth having to the wrong people.
-- Checkout looks a code up server-side; nothing reads this from a browser.
REVOKE ALL ON public.promo_codes FROM anon, authenticated;
GRANT ALL ON public.promo_codes TO service_role;

-- Money limits on the staff-code discount, set from the admin Promotions page.
--
--   min_order_amount     the order (before discount) must reach this for any
--                        discount at all. Below it the staff member is still
--                        credited; the customer just gets nothing off.
--   max_discount_amount  the discount never exceeds this, whatever the rate.
--
-- Both start at 0, which means "no limit", until an admin sets them.

ALTER TABLE public.promotion_settings ADD COLUMN IF NOT EXISTS min_order_amount numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.promotion_settings ADD COLUMN IF NOT EXISTS max_discount_amount numeric(12,2) DEFAULT 0 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_settings_limits_non_negative') THEN
    ALTER TABLE public.promotion_settings
      ADD CONSTRAINT promotion_settings_limits_non_negative CHECK (min_order_amount >= 0 AND max_discount_amount >= 0);
  END IF;
END $$;

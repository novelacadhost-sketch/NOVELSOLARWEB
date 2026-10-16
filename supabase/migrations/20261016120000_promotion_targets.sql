-- Which products a discount applies to, for the staff-code discount
-- (promotion_settings) and for each promo code: every product, the products in
-- some Bitrix sections, or a hand-picked list of products.
--
-- Sections are stored by NAME: section ids on this portal have changed when
-- sections were deleted and re-added, and names survived. Products by their
-- Bitrix id, as text, like every other product id in this schema.
--
-- Existing rows default to 'all', so nothing changes until an admin picks a
-- narrower target. A minimum order is measured on the covered items only, so
-- the fixed-amount guard (minimum above the amount) still means no order can
-- be made free. Re-runnable.

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS applies_to text DEFAULT 'all' NOT NULL,
  ADD COLUMN IF NOT EXISTS target_sections text[] DEFAULT '{}' NOT NULL,
  ADD COLUMN IF NOT EXISTS target_product_ids text[] DEFAULT '{}' NOT NULL;

ALTER TABLE public.promotion_settings
  ADD COLUMN IF NOT EXISTS applies_to text DEFAULT 'all' NOT NULL,
  ADD COLUMN IF NOT EXISTS target_sections text[] DEFAULT '{}' NOT NULL,
  ADD COLUMN IF NOT EXISTS target_product_ids text[] DEFAULT '{}' NOT NULL;

-- A narrowed target must name something: "sections" with none would apply to nothing.
ALTER TABLE public.promo_codes DROP CONSTRAINT IF EXISTS promo_codes_target;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_target CHECK (
  applies_to = 'all'
  OR (applies_to = 'sections' AND cardinality(target_sections) > 0)
  OR (applies_to = 'products' AND cardinality(target_product_ids) > 0)
);

ALTER TABLE public.promotion_settings DROP CONSTRAINT IF EXISTS promotion_settings_target;
ALTER TABLE public.promotion_settings ADD CONSTRAINT promotion_settings_target CHECK (
  applies_to = 'all'
  OR (applies_to = 'sections' AND cardinality(target_sections) > 0)
  OR (applies_to = 'products' AND cardinality(target_product_ids) > 0)
);

-- Carry the Bitrix product section (category) on the mirror.
--
-- Bitrix maintains a real 26-section taxonomy and 1153 of 1154 active products
-- sit in one. The site never used it: app/pages/shop/index.vue guesses the
-- category from the product NAME with rules like
--
--     isLighting = (title.includes('bulb') || title.includes('light'))
--                  && !title.includes('hanger') && !title.includes('arrestor')
--
-- which is wrong by construction — "Solar Kit" contains no keyword, "Inverter
-- Generator" matches two — and drifts every time a product is renamed. The
-- shop's seven categories even carry a `SECTION_ID: null` field, so this was
-- clearly the intent and was never finished.
--
-- section_name is denormalised deliberately. It is a 26-value lookup rewritten
-- on every sync, and the Flutter client reads public_products directly, where a
-- join is far more awkward than a repeated string.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS section_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS section_name text;

CREATE INDEX IF NOT EXISTS products_section_id_idx ON public.products USING btree (section_id);

-- Rebuild the public view to include them. CREATE OR REPLACE cannot add columns
-- to an existing view, so it is dropped first.
DROP VIEW IF EXISTS public.public_products;
CREATE VIEW public.public_products
WITH (security_invoker = true) AS
SELECT id, name, price, description, specs, gallery_urls, image_url, quantity, section_id, section_name
FROM public.products
WHERE active = true;

GRANT SELECT ON public.public_products TO anon, authenticated;

-- The column grant on the base table is a fixed list, so the two new columns are
-- invisible until named here. Still no dealer_price, still no raw.
REVOKE ALL ON public.products FROM anon, authenticated;
GRANT SELECT (
  id, name, price, description, specs, gallery_urls, image_url, quantity, active, section_id, section_name
) ON public.products TO anon, authenticated;

-- ── the category list itself ──────────────────────────────────────────────
-- Derived rather than stored: a category exists exactly when an active product
-- is in it, so a section emptied in Bitrix disappears from the site on the next
-- sync with nothing to tidy up. The count is what makes it useful — the shop can
-- hide an empty category instead of offering a filter that returns nothing.
--
-- security_invoker so the caller's own permissions and the active=true policy on
-- products still apply; this is a convenience, not a way around them.
DROP VIEW IF EXISTS public.product_categories;
CREATE VIEW public.product_categories
WITH (security_invoker = true) AS
SELECT
  section_id   AS id,
  section_name AS name,
  count(*)::int AS product_count
FROM public.products
WHERE active = true
  AND section_id IS NOT NULL
GROUP BY section_id, section_name;

GRANT SELECT ON public.product_categories TO anon, authenticated;

-- Keep stock out of public_products, so WordPress stays as it is.
--
-- products.quantity is being filled with real stock from the Bitrix catalog
-- for the first time; until now it was null on every row, because the sync
-- read crm.product.list, which never returns QUANTITY.
--
-- The WordPress plugin reads public_products and switches on WooCommerce
-- stock management by itself the moment a non-null quantity appears. Davies
-- wants WordPress left unchanged, so the view keeps a `quantity` column that is
-- always null. It is kept rather than dropped because the plugin selects it by
-- name: removing it would make PostgREST reject the plugin's request outright
-- and stop the WordPress sync entirely.
--
-- The mobile app reads real stock from products.quantity instead, which anon
-- and authenticated can already select (see 20260914170000 and 20260915160000).
--
-- RUN THIS BEFORE deploying the sync change that fills products.quantity.
-- In the other order, WordPress picks up real numbers in the gap between the
-- two.
--
-- CREATE OR REPLACE rather than DROP + CREATE: same column names, types and
-- order, so it is allowed, and it keeps the existing grants and does not
-- disturb product_categories. Safe to re-run.

CREATE OR REPLACE VIEW public.public_products
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  price,
  description,
  specs,
  gallery_urls,
  image_url,
  NULL::numeric AS quantity,
  section_id,
  section_name
FROM public.products
WHERE active = true;

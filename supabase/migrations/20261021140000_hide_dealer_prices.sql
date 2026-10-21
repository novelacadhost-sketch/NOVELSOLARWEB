-- Dealer prices were readable by anyone holding the public anon key.
--
-- A hand-made policy, "Allow public read active products" (anon + authenticated,
-- USING active = true), together with table-wide SELECT grants, let any caller
-- read every column of products, including dealer_price and raw (the full
-- Bitrix record, which carries the dealer price too). The anon key ships in the
-- website and the mobile app, so this was the whole wholesale price list.
--
-- The policy stays (it decides which ROWS: active products). What changes is
-- which COLUMNS the public roles may read: everything except dealer_price and
-- raw. Dealer prices reach approved dealers only through the API, which checks
-- the dealer gate server-side (MOBILE-API.md, "Prices — API only"). The server
-- uses the service role and is unaffected. The public_products and
-- product_categories views are security_invoker and read only granted columns.
--
-- A client that selects "*" from products is now refused ("permission denied");
-- it must list columns, or read public_products.
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (
  id,
  name,
  price,
  description,
  specs,
  gallery_urls,
  image_url,
  bitrix_image_id,
  quantity,
  section_id,
  section_name,
  active,
  created_at,
  synced_at
) ON public.products TO anon, authenticated;

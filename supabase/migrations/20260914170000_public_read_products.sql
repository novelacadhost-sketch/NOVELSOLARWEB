-- Allow clients to read the active product catalogue, without leaking dealer pricing.
--
-- The mobile client needs to list products. The obvious policy
--
--     CREATE POLICY ... ON products FOR SELECT TO anon, authenticated
--       USING (active = true);
--
-- is NOT safe on this table. RLS filters ROWS, not COLUMNS, so it would also
-- expose `dealer_price` (populated on 1121 of 1148 products) and `raw`, which
-- carries the same figure again as PROPERTY_184. The anon key is public — it
-- ships in the Flutter bundle and in the website's JS — so that is the whole
-- wholesale price list, published.
--
-- Column-level GRANTs are the mechanism RLS lacks. The policy decides the rows,
-- the grant decides the columns.

-- ── rows: active products only ───────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read active products" ON public.products;
CREATE POLICY "Allow public read active products" ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- ── columns: everything except dealer_price and raw ──────────────────────
-- Revoke first: Supabase grants ALL on public tables to anon/authenticated by
-- default, and a table-level grant outranks any column list added later.
REVOKE ALL ON public.products FROM anon, authenticated;

GRANT SELECT (id, name, price, description, specs, gallery_urls, image_url, quantity, active)
  ON public.products TO anon, authenticated;

-- A client doing `select *` now gets 42501 rather than silently receiving the
-- excluded columns — it fails loudly, which is the behaviour we want. Clients
-- must name their columns, or read the view below.

-- ── convenience view, so `select *` works ────────────────────────────────
-- security_invoker so the policy above still applies to the caller; the view is
-- not a way around RLS, only a way around typing the column list.
DROP VIEW IF EXISTS public.public_products;
CREATE VIEW public.public_products
WITH (security_invoker = true) AS
SELECT id, name, price, description, specs, gallery_urls, image_url, quantity
FROM public.products
WHERE active = true;

GRANT SELECT ON public.public_products TO anon, authenticated;

-- NOTE: dealer pricing is deliberately unreachable from any client. It is not a
-- column a dealer is allowed to read for themselves — the discount is resolved
-- server-side by resolveIsDealerFromEvent() and applied in /api/inventory,
-- /api/products and /api/checkout. A dealer-priced catalogue must come from
-- those endpoints with an Authorization: Bearer token, never from this table.

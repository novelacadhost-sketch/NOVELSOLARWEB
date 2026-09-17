-- Hide a product from the website without touching Bitrix.
--
-- The admin's "Disable" wrote ACTIVE: 'N' through crm.product.update, which
-- deactivates the product in the CRM for everyone — sales, quotes, the
-- catalogue — and then the webhook deleted it from the mirror entirely. The UI
-- described that as "hide it from all customer-facing product pages", so
-- someone tidying the shop could deactivate a product company-wide without
-- realising.
--
-- Visibility now lives here instead, and Bitrix is never told.
--
-- A SEPARATE TABLE, not a column on products, for two reasons. The sync upserts
-- whole rows from Bitrix, so a column would be overwritten on every run unless
-- carefully carried forward — the same trap that silently blanked image_url.
-- And a product deleted from the mirror (deactivated in Bitrix, or dropped from
-- the catalogue) would lose the flag; here it survives and applies again if the
-- product returns.

CREATE TABLE IF NOT EXISTS public.product_visibility (
  -- The Bitrix product id. Deliberately no foreign key to products: the mirror
  -- is a cache that rows come and go from, and a hidden product must stay
  -- hidden across a delete and re-sync.
  product_id text NOT NULL,
  hidden boolean DEFAULT true NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid,
  CONSTRAINT product_visibility_pkey PRIMARY KEY (product_id)
);

-- The read is always "which products are hidden", so index that alone.
CREATE INDEX IF NOT EXISTS product_visibility_hidden_idx
  ON public.product_visibility USING btree (product_id)
  WHERE hidden = true;

ALTER TABLE public.product_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on product_visibility" ON public.product_visibility;
CREATE POLICY "Allow service role full access on product_visibility" ON public.product_visibility
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No client grants. Writes go through /api/admin/update-product behind
-- adminGuard; reads are applied server-side in the listing endpoints. A table
-- that decides what the public sees should not be writable from a browser.
REVOKE ALL ON public.product_visibility FROM anon, authenticated;

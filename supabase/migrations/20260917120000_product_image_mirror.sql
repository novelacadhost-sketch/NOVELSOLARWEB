-- Track which Bitrix image a product's mirrored picture came from.
--
-- Product photos uploaded in Bitrix live on the catalog side
-- (catalog.productImage.list), not on the CRM fields the sync already reads —
-- DETAIL_PICTURE and PREVIEW_PICTURE are 0% populated, and PROPERTY_44 returns
-- a portal-relative path that needs authentication, which is why
-- /api/bitrix-image exists as a proxy.
--
-- The catalog API returns a detailUrl on cdn.bitrix24.com that is public and
-- needs no proxy. Rather than serve that directly, the sync copies it into
-- Cloudinary and stores the Cloudinary URL, for two reasons: Bitrix's CDN
-- serves the raw file with no format or size negotiation (a sampled PNG was
-- 215 KB where Cloudinary's f_auto,q_auto,w_1200 gives ~30 KB of WebP), and a
-- Bitrix URL dies if the product is deleted or the portal moves.
--
-- This column is what stops that being expensive. The nightly sync walks all
-- ~1150 products; without a record of which Bitrix image is already mirrored it
-- would re-upload every picture every night. With it, an unchanged image is a
-- comparison rather than an upload.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS bitrix_image_id text;

-- Partial: only the mirrored rows are ever looked up by it.
CREATE INDEX IF NOT EXISTS products_bitrix_image_id_idx
  ON public.products USING btree (bitrix_image_id)
  WHERE bitrix_image_id IS NOT NULL;

-- Deliberately NOT added to public_products or the anon column grant. It is a
-- sync bookkeeping value; clients read image_url, which already points at
-- Cloudinary. Exposing it would only invite someone to reconstruct a Bitrix URL.

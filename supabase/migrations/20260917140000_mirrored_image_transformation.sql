-- Add the delivery transformation to already-mirrored image URLs.
--
-- The first mirror run stored Cloudinary's `secure_url`, which points at the
-- ORIGINAL asset. Measured on one of them: 427 KB of PNG, where the same image
-- through f_auto,q_auto,w_1200 is 98 KB of WebP. Serving the untransformed URL
-- discards most of the reason for copying the file to Cloudinary at all.
--
-- The code now inserts the transformation when it mirrors, so this only has to
-- repair the rows written before that. It cannot be left to the sync: a
-- mirrored row is carried forward untouched on every later run precisely so
-- that it costs no API call, which means nothing would ever rewrite these.
--
-- Matches the URL shape already used by images set in Bitrix PROPERTY_102, so
-- every product picture on the site is delivered the same way.

UPDATE public.products
SET image_url = replace(image_url, '/image/upload/', '/image/upload/f_auto,q_auto,w_1200/')
WHERE bitrix_image_id IS NOT NULL
  AND image_url LIKE '%/image/upload/%'
  AND image_url NOT LIKE '%/image/upload/f_auto%';

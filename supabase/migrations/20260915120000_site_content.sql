-- Editable page content: banners and images an admin can change without a deploy.
--
-- Every image on the marketing pages is currently a hardcoded path in a .vue
-- file — 73 references across 58 files, 16 of them on the homepage alone — so
-- swapping a banner needs a developer, an edit and a deploy.
--
-- Rows here OVERRIDE the hardcoded value. They do not replace it: each page
-- keeps its literal as a fallback, so an empty table, a missing row or an
-- unreachable database renders exactly what the site renders today. That is
-- what makes this safe to roll out one page at a time.
--
-- Images live in Cloudinary (already used for product media); this table stores
-- the delivered URL, never a file.

CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid DEFAULT gen_random_uuid() NOT NULL,

  -- Which page: 'home', 'about', 'partners/hithium'. Free text rather than an
  -- enum so a new page needs no migration.
  page text NOT NULL,

  -- Which area of that page: 'hero', 'banner-academy', 'services'.
  slot text NOT NULL,

  -- Position within a slot. A single image is sort 0; the homepage hero is an
  -- ordered set, so its slides are 0..n and reordering rewrites this.
  sort integer DEFAULT 0 NOT NULL,

  image_url text,
  alt text,

  -- The hero slides carry copy as well as an image. Null for plain image slots.
  eyebrow text,
  title text,
  description text,
  caption text,
  link text,

  -- Lets an admin retire a slide without deleting it, so it can come back.
  active boolean DEFAULT true NOT NULL,

  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid,

  CONSTRAINT site_content_pkey PRIMARY KEY (id),
  CONSTRAINT site_content_page_slot_sort_key UNIQUE (page, slot, sort)
);

CREATE INDEX IF NOT EXISTS site_content_page_slot_idx
  ON public.site_content USING btree (page, slot, sort);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Writes go through /api/admin/page-content/* behind adminGuard, which uses the
-- service role. No client writes, so there is deliberately no policy for
-- `authenticated` — an editable-content table with a client write path is how a
-- site gets defaced.
DROP POLICY IF EXISTS "Allow service role full access on site_content" ON public.site_content;
CREATE POLICY "Allow service role full access on site_content" ON public.site_content
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public reads go through /api/page-content, not PostgREST. Keeping the grants
-- off means one read path to reason about, and the API can keep serving the
-- hardcoded fallback if this table ever misbehaves.
REVOKE ALL ON public.site_content FROM anon, authenticated;

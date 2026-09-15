-- Partner pages that can be created from the admin, without a deploy.
--
-- The five existing partners (itel, haisic, yinergy, livoltek, hithium) are
-- bespoke Vue components and stay that way. This table is for the ones created
-- in the admin, which render through a shared template.
--
-- THE RESOLUTION ORDER IS THE POINT. partners/[brand]/index.vue checks for a
-- custom component FIRST and falls back to the template. So a partner someone
-- adds here while you are busy can later be rebuilt as a hand-designed
-- component: add PartnerFoo.vue, register it in the component map, and it takes
-- over the same URL on the next deploy. No data migration, no redirect, no
-- admin change. The row can stay — it simply stops being read — or be
-- deactivated once the custom page is live.
--
-- Images and galleries for these pages reuse site_content with
-- page = 'partners/<slug>', so there is one content mechanism, not two.

CREATE TABLE IF NOT EXISTS public.partners (
  slug text NOT NULL,
  name text NOT NULL,

  tagline text,
  description text,

  logo_url text,
  hero_url text,

  -- Optional: a brand colour for the template's accents. Null uses the house blue.
  accent_color text,

  website_url text,

  -- Off by default so a half-finished page is not public the moment it is created.
  active boolean DEFAULT false NOT NULL,
  sort integer DEFAULT 0 NOT NULL,

  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid,

  CONSTRAINT partners_pkey PRIMARY KEY (slug),
  -- The slug is a URL segment: lowercase letters, digits and hyphens. Enforced
  -- here as well as in the API, because a slug with a slash or a space would
  -- produce a page that cannot be linked to.
  CONSTRAINT partners_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT partners_slug_length CHECK (char_length(slug) BETWEEN 2 AND 60)
);

CREATE INDEX IF NOT EXISTS partners_active_sort_idx ON public.partners USING btree (active, sort);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on partners" ON public.partners;
CREATE POLICY "Allow service role full access on partners" ON public.partners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Reads go through /api/partners and /api/partner/[slug]; writes through
-- /api/admin/partners/* behind adminGuard. No client grants, same reasoning as
-- site_content: a table that renders public pages should not be writable from a
-- browser session.
REVOKE ALL ON public.partners FROM anon, authenticated;

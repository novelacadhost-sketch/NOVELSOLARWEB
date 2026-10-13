-- Newsletter sign-ups from the website footer.
--
-- The footer form discarded every address until 2026-10-13. Subscribers are
-- now kept here (the list marketing exports) and also sent to Bitrix as a lead.
--
-- Email is stored lower-cased and trimmed by the API, so the UNIQUE constraint
-- is the one-row-per-address rule and the upsert target. consented_at records
-- the explicit opt-in the NDPA requires for marketing email; unsubscribed_at is
-- set instead of deleting, so a later re-subscribe keeps the history.
--
-- Service role only: the browser never reads or writes this table directly.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  site text NOT NULL DEFAULT 'solar' CHECK (site IN ('solar', 'homes')),
  source text NOT NULL DEFAULT 'footer',
  consented_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  bitrix_lead_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email),
  CONSTRAINT newsletter_subscribers_email_lower CHECK (email = lower(btrim(email)))
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role full access on newsletter_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Allow service role full access on newsletter_subscribers" ON public.newsletter_subscribers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.newsletter_subscribers FROM anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

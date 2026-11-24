-- RSVPs from dealers and partners for the 2026 end-of-year party
-- (Saturday 19 December, 1pm to 10pm).
--
-- Kept apart from party_rsvps: partners are not staff, have no staff code and
-- give a company instead. No login, so a person is known by name and company;
-- name_key and company_key are their words, lower case and sorted, so
-- "Ada Obi, Sunpower Ltd" and "obi ada, SUNPOWER LTD" are the same RSVP and
-- sending the form again replaces it. The server writes with the service role only.

CREATE TABLE IF NOT EXISTS public.partner_rsvps (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event text NOT NULL,
  full_name text NOT NULL,
  company text NOT NULL,
  name_key text NOT NULL,
  company_key text NOT NULL,
  plus_one boolean DEFAULT false NOT NULL,
  -- Whole hours on the 24-hour clock; the party runs 13:00 to 22:00.
  arrive_hour smallint NOT NULL,
  leave_hour smallint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT partner_rsvps_pkey PRIMARY KEY (id),
  CONSTRAINT partner_rsvps_person_key UNIQUE (event, name_key, company_key),
  CONSTRAINT partner_rsvps_lengths CHECK (
    length(full_name) BETWEEN 1 AND 80 AND length(company) BETWEEN 1 AND 120
  ),
  CONSTRAINT partner_rsvps_hours CHECK (
    arrive_hour BETWEEN 13 AND 21 AND leave_hour BETWEEN 14 AND 22 AND arrive_hour < leave_hour
  )
);

ALTER TABLE public.partner_rsvps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.partner_rsvps FROM anon, authenticated;
GRANT ALL ON public.partner_rsvps TO service_role;

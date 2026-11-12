-- Staff RSVPs for company events, starting with the 2026 end-of-year party
-- (Saturday 19 December, 1pm to 10pm; novelty match Sunday 20 December, 2pm).
--
-- One row per staff member per event. Staff identify themselves on /party with
-- their staff code plus their name, so there is no login and no user id here;
-- the code is the key. The server writes with the service role only.

CREATE TABLE IF NOT EXISTS public.party_rsvps (
  event text NOT NULL,
  staff_code text NOT NULL REFERENCES public.staff_codes (code) ON UPDATE CASCADE,
  attending boolean NOT NULL,
  -- Adults coming with the staff member, not counting them.
  adult_guests smallint DEFAULT 0 NOT NULL,
  -- One entry per child: {"age": 0..17}. Registered apart from the adults.
  children jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- Whole hours on the 24-hour clock; the party runs 13:00 to 22:00.
  arrive_hour smallint,
  leave_hour smallint,
  -- Coming to the Sunday novelty match (2026: Sunday 20 December, 2pm).
  novelty_match boolean DEFAULT false NOT NULL,
  -- Staying at the Lane 4 apartment, and for which nights.
  lane4_stay text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT party_rsvps_pkey PRIMARY KEY (event, staff_code),
  CONSTRAINT party_rsvps_adult_guests_range CHECK (adult_guests BETWEEN 0 AND 10),
  CONSTRAINT party_rsvps_children_is_array CHECK (jsonb_typeof(children) = 'array' AND jsonb_array_length(children) <= 10),
  CONSTRAINT party_rsvps_hours CHECK (
    (arrive_hour IS NULL AND leave_hour IS NULL)
    OR (arrive_hour BETWEEN 13 AND 21 AND leave_hour BETWEEN 14 AND 22 AND arrive_hour < leave_hour)
  ),
  CONSTRAINT party_rsvps_lane4 CHECK (lane4_stay IS NULL OR lane4_stay IN ('fri_sat', 'fri_sun')),
  -- Someone not coming has nothing else to record.
  CONSTRAINT party_rsvps_declined_is_empty CHECK (
    attending OR (adult_guests = 0 AND children = '[]'::jsonb AND arrive_hour IS NULL AND lane4_stay IS NULL AND NOT novelty_match)
  ),
  CONSTRAINT party_rsvps_attending_has_hours CHECK (NOT attending OR arrive_hour IS NOT NULL)
);

ALTER TABLE public.party_rsvps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.party_rsvps FROM anon, authenticated;
GRANT ALL ON public.party_rsvps TO service_role;

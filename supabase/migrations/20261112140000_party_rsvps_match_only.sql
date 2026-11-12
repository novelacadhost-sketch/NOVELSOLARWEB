-- Staff who come to the Sunday novelty match but not the Saturday party.
--
-- A flag rather than a new attendance column so every existing row, and the
-- code already deployed, stays valid: match_only defaults to false, which is
-- what every RSVP so far means.

ALTER TABLE public.party_rsvps ADD COLUMN IF NOT EXISTS match_only boolean DEFAULT false NOT NULL;

ALTER TABLE public.party_rsvps DROP CONSTRAINT IF EXISTS party_rsvps_declined_is_empty;
ALTER TABLE public.party_rsvps ADD CONSTRAINT party_rsvps_declined_is_empty CHECK (
  attending OR (
    adult_guests = 0 AND children = '[]'::jsonb AND arrive_hour IS NULL AND lane4_stay IS NULL
    AND NOT novelty_match AND NOT match_only
  )
);

-- Party-goers give their hours; match-only staff are not at the party, so have none.
ALTER TABLE public.party_rsvps DROP CONSTRAINT IF EXISTS party_rsvps_attending_has_hours;
ALTER TABLE public.party_rsvps DROP CONSTRAINT IF EXISTS party_rsvps_party_hours;
ALTER TABLE public.party_rsvps ADD CONSTRAINT party_rsvps_party_hours CHECK (
  NOT attending OR (match_only AND arrive_hour IS NULL) OR (NOT match_only AND arrive_hour IS NOT NULL)
);

ALTER TABLE public.party_rsvps DROP CONSTRAINT IF EXISTS party_rsvps_match_only_at_match;
ALTER TABLE public.party_rsvps ADD CONSTRAINT party_rsvps_match_only_at_match CHECK (NOT match_only OR novelty_match);

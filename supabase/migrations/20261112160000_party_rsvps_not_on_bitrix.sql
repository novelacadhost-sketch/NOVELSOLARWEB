-- Staff who are not on Bitrix (so have no staff code) can RSVP by name.
--
-- Each row is now either a Bitrix staff member (staff_code) or someone known
-- only by the name they typed (full_name + name_key). name_key is the name's
-- words, lower case and sorted, so "Ada Obi" and "obi ada" are one person.
--
-- Safe to apply before the code that uses it: (event, staff_code) stays unique
-- as a constraint, so the deployed upsert on it keeps working, and every
-- existing row is a staff_code row that already satisfies the new check.

ALTER TABLE public.party_rsvps ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.party_rsvps ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.party_rsvps ADD COLUMN IF NOT EXISTS name_key text;

ALTER TABLE public.party_rsvps DROP CONSTRAINT IF EXISTS party_rsvps_pkey;
ALTER TABLE public.party_rsvps ADD CONSTRAINT party_rsvps_pkey PRIMARY KEY (id);
ALTER TABLE public.party_rsvps ALTER COLUMN staff_code DROP NOT NULL;

-- NULLs are distinct in a UNIQUE constraint, so each holds only for its own kind of row.
ALTER TABLE public.party_rsvps DROP CONSTRAINT IF EXISTS party_rsvps_event_staff_code_key;
ALTER TABLE public.party_rsvps ADD CONSTRAINT party_rsvps_event_staff_code_key UNIQUE (event, staff_code);
ALTER TABLE public.party_rsvps DROP CONSTRAINT IF EXISTS party_rsvps_event_name_key_key;
ALTER TABLE public.party_rsvps ADD CONSTRAINT party_rsvps_event_name_key_key UNIQUE (event, name_key);

ALTER TABLE public.party_rsvps DROP CONSTRAINT IF EXISTS party_rsvps_who;
ALTER TABLE public.party_rsvps ADD CONSTRAINT party_rsvps_who CHECK (
  (staff_code IS NOT NULL AND full_name IS NULL AND name_key IS NULL)
  OR (staff_code IS NULL AND full_name IS NOT NULL AND name_key IS NOT NULL AND length(full_name) <= 80)
);

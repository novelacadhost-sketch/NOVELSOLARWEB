-- The check added in 20261021160000 did not check anything.
--
-- array_length(product_ids, 1) returns NULL for an empty array, not 0, so
--   role not in ('main','gallery') or array_length(product_ids, 1) >= 1
-- evaluated to NULL for exactly the case it was meant to catch -- and a CHECK
-- constraint accepts NULL, failing only on FALSE. A "main photo" row naming no
-- product inserted cleanly. Verified against the live table before this fix:
-- the insert succeeded where it should have raised check_violation.
--
-- cardinality() returns 0 for an empty array, which is the comparison that
-- actually holds. /api/photo-review/save already drops such rows in JS, so no
-- bad row ever reached the table; this restores the guarantee underneath it.
alter table public.photo_review_choices
  drop constraint if exists photo_review_choices_targets_present;

alter table public.photo_review_choices
  add constraint photo_review_choices_targets_present check (
    role not in ('main', 'gallery') or cardinality(product_ids) >= 1
  );

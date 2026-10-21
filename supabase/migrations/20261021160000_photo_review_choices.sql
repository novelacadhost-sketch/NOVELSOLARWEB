-- Where the bulk photo review records its answers.
--
-- 961 product photos arrived as a raw dump: camera filenames (IMG_3680,
-- GOPR0170), marketplace hashes and abbreviations, so name matching reaches
-- fewer than one in ten. The people who sent the photos are the only ones who
-- can identify them, which means a tool they can open and work through -- and
-- somewhere for their answers to land that is not a JSON file sent by email.
--
-- One row per (file, reviewer). NOT one row per file: several people review in
-- parallel, and keying on the file alone would let the last save silently
-- overwrite someone else's answer. Keeping both means a disagreement is
-- visible rather than lost, and is reconciled before anything is uploaded.
--
-- No foreign key to products, matching order_items and cart_items: products is
-- a sync mirror whose rows are deleted when they leave Bitrix, so a cascade
-- would quietly erase review work on a partial sync.
create table if not exists public.photo_review_choices (
  id uuid primary key default gen_random_uuid(),
  file text not null,
  reviewer text not null,
  -- Bitrix product ids. Plural because one picture can legitimately serve
  -- several products (the Ecolink files are category shots covering ten
  -- downlights between them).
  product_ids text[] not null default '{}',
  role text not null check (role in ('main', 'gallery', 'unknown', 'not_a_product')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An assignment must name at least one product; "unknown" and
  -- "not_a_product" are the ways to answer without naming one.
  constraint photo_review_choices_targets_present check (
    role not in ('main', 'gallery') or cardinality(product_ids) >= 1
  ),
  constraint photo_review_choices_one_per_reviewer unique (file, reviewer)
);

create index if not exists photo_review_choices_file_idx on public.photo_review_choices (file);

create or replace function public.touch_photo_review_choices()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_photo_review_choices on public.photo_review_choices;
create trigger trg_touch_photo_review_choices
  before update on public.photo_review_choices
  for each row execute function public.touch_photo_review_choices();

-- Service role only. The review page is unauthenticated (a token in the link is
-- all an external supplier has), so it never talks to Postgres directly -- it
-- posts to /api/photo-review, which writes with the service key. RLS is on with
-- no policies, so anon and authenticated can reach nothing here even if a grant
-- is added by hand later.
alter table public.photo_review_choices enable row level security;

revoke all on public.photo_review_choices from anon, authenticated;
grant all on public.photo_review_choices to service_role;

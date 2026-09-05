-- NovelSolar — complete public schema baseline
-- Introspected from the live database on 2026-09-05.
-- Run this ALONE on an empty project. Do not also run the older migrations;
-- everything they do is already folded in here.

BEGIN;

-- ─── extensions ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Present on the source project but deliberately NOT recreated here:
--   pg_cron             — nothing in this app uses it; product sync runs on
--                         Vercel CRON (vercel.json). Enabling it needs the
--                         dashboard and would abort this transaction.
--   pg_stat_statements  — Supabase installs and manages this itself.
--   supabase_vault      — Supabase installs and manages this itself.

-- ─── enum types ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                 WHERE t.typname='dealer_application_status_enum' AND n.nspname='public') THEN
    CREATE TYPE public.dealer_application_status_enum AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                 WHERE t.typname='dealer_status_enum' AND n.nspname='public') THEN
    CREATE TYPE public.dealer_status_enum AS ENUM ('none', 'pending', 'approved', 'rejected');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                 WHERE t.typname='order_status' AND n.nspname='public') THEN
    CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'cancelled', 'failed');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                 WHERE t.typname='outbox_status' AND n.nspname='public') THEN
    CREATE TYPE public.outbox_status AS ENUM ('pending', 'sent', 'failed');
  END IF;
END $$;

-- ─── tables ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  user_id uuid NOT NULL,
  admin_username text NOT NULL,
  is_master boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  CONSTRAINT admin_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT admin_profiles_admin_username_key UNIQUE (admin_username)
);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token text NOT NULL,
  user_id text,
  email text,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  CONSTRAINT admin_sessions_pkey PRIMARY KEY (token)
);

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text NOT NULL,
  value text NOT NULL,
  CONSTRAINT admin_settings_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  bitrix_user_id character varying(255) NOT NULL,
  member_id character varying(255) NOT NULL,
  domain character varying(255) NOT NULL,
  auth_id text NOT NULL,
  refresh_id text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT auth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_sessions_member_id_bitrix_user_id_key UNIQUE (member_id, bitrix_user_id)
);

CREATE TABLE IF NOT EXISTS public.bitrix_contact_links (
  user_id uuid NOT NULL,
  bitrix_contact_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT bitrix_contact_links_pkey PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS public.bitrix_order_links (
  order_id uuid NOT NULL,
  bitrix_deal_id text,
  bitrix_lead_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT bitrix_order_links_pkey PRIMARY KEY (order_id)
);

CREATE TABLE IF NOT EXISTS public.crm_outbox (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_type text NOT NULL,
  source_table text,
  source_id uuid,
  payload jsonb NOT NULL,
  status outbox_status DEFAULT 'pending'::outbox_status NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  next_retry_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT crm_outbox_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.dealer_applications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  status dealer_application_status_enum DEFAULT 'pending'::dealer_application_status_enum NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  previous_work_urls text[] DEFAULT '{}'::text[],
  former_purchase_url text,
  CONSTRAINT dealer_applications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.dealer_invitations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT dealer_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT dealer_invitations_token_key UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  status order_status NOT NULL,
  message text,
  meta jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT order_events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  bitrix_product_id text,
  name text NOT NULL,
  unit_price numeric(12,2) DEFAULT 0 NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  image_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT order_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  customer_email text,
  customer_first_name text,
  customer_last_name text,
  customer_phone text,
  shipping_address text,
  fulfillment text DEFAULT 'delivery'::text NOT NULL,
  branch jsonb,
  payment_method text,
  currency text DEFAULT 'NGN'::text NOT NULL,
  subtotal numeric(12,2) DEFAULT 0 NOT NULL,
  shipping numeric(12,2) DEFAULT 0 NOT NULL,
  total numeric(12,2) DEFAULT 0 NOT NULL,
  status order_status DEFAULT 'pending'::order_status NOT NULL,
  client_order_ref text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.products (
  id text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  dealer_price numeric,
  description text,
  specs jsonb,
  gallery_urls jsonb,
  image_url text,
  quantity numeric,
  active boolean DEFAULT true,
  raw jsonb,
  synced_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid NOT NULL,
  email text,
  first_name text,
  last_name text,
  phone text,
  address text,
  bitrix_contact_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  role text DEFAULT 'customer'::text NOT NULL,
  dealer_status dealer_status_enum DEFAULT 'none'::dealer_status_enum NOT NULL,
  onboarding_token text,
  token_expires_at timestamp with time zone,
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT profiles_onboarding_token_key UNIQUE (onboarding_token)
);

CREATE TABLE IF NOT EXISTS public.sync_meta (
  key text NOT NULL,
  value text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sync_meta_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  token text NOT NULL,
  contact_id text NOT NULL,
  email text NOT NULL,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  CONSTRAINT user_sessions_pkey PRIMARY KEY (token)
);

-- ─── foreign keys (added after all tables exist) ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='admin_profiles_created_by_fkey') THEN
    ALTER TABLE public.admin_profiles ADD CONSTRAINT admin_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='admin_profiles_user_id_fkey') THEN
    ALTER TABLE public.admin_profiles ADD CONSTRAINT admin_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bitrix_contact_links_user_id_fkey') THEN
    ALTER TABLE public.bitrix_contact_links ADD CONSTRAINT bitrix_contact_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bitrix_order_links_order_id_fkey') THEN
    ALTER TABLE public.bitrix_order_links ADD CONSTRAINT bitrix_order_links_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='order_events_order_id_fkey') THEN
    ALTER TABLE public.order_events ADD CONSTRAINT order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='order_items_order_id_fkey') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_user_id_fkey') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_user_id_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS crm_outbox_source_idx ON public.crm_outbox USING btree (source_table, source_id);
CREATE INDEX IF NOT EXISTS crm_outbox_status_idx ON public.crm_outbox USING btree (status, next_retry_at);
CREATE INDEX IF NOT EXISTS order_events_order_id_idx ON public.order_events USING btree (order_id);
CREATE INDEX IF NOT EXISTS order_items_bitrix_product_id_idx ON public.order_items USING btree (bitrix_product_id);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders USING btree (user_id);
CREATE INDEX IF NOT EXISTS products_active_idx ON public.products USING btree (active);
CREATE INDEX IF NOT EXISTS products_synced_at_idx ON public.products USING btree (synced_at);
CREATE INDEX IF NOT EXISTS profiles_bitrix_contact_id_idx ON public.profiles USING btree (bitrix_contact_id);

-- ─── row level security ───────────────────────────────────────────────
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitrix_contact_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitrix_order_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on admin_profiles" ON public.admin_profiles;
CREATE POLICY "Allow service role full access on admin_profiles" ON public.admin_profiles
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service role full access on admin_settings" ON public.admin_settings;
CREATE POLICY "Allow service role full access on admin_settings" ON public.admin_settings
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service role full access on bitrix_contact_links" ON public.bitrix_contact_links;
CREATE POLICY "Allow service role full access on bitrix_contact_links" ON public.bitrix_contact_links
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service role full access on bitrix_order_links" ON public.bitrix_order_links;
CREATE POLICY "Allow service role full access on bitrix_order_links" ON public.bitrix_order_links
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service role full access on crm_outbox" ON public.crm_outbox;
CREATE POLICY "Allow service role full access on crm_outbox" ON public.crm_outbox
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated read on order_events" ON public.order_events;
CREATE POLICY "Allow authenticated read on order_events" ON public.order_events
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Allow service role full access on order_events" ON public.order_events;
CREATE POLICY "Allow service role full access on order_events" ON public.order_events
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated read on order_items" ON public.order_items;
CREATE POLICY "Allow authenticated read on order_items" ON public.order_items
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Allow service role full access on order_items" ON public.order_items;
CREATE POLICY "Allow service role full access on order_items" ON public.order_items
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated read on orders" ON public.orders;
CREATE POLICY "Allow authenticated read on orders" ON public.orders
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Allow service role full access on orders" ON public.orders;
CREATE POLICY "Allow service role full access on orders" ON public.orders
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all_products" ON public.products;
CREATE POLICY "service_role_all_products" ON public.products
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated read on profiles" ON public.profiles;
CREATE POLICY "Allow authenticated read on profiles" ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Allow authenticated update on own profile" ON public.profiles;
CREATE POLICY "Allow authenticated update on own profile" ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Allow service role full access on profiles" ON public.profiles;
CREATE POLICY "Allow service role full access on profiles" ON public.profiles
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all_sync_meta" ON public.sync_meta;
CREATE POLICY "service_role_all_sync_meta" ON public.sync_meta
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── hardening: NOT a copy of the source project ──────────────────────────
-- The source project (sqzlfcdffcoyxvngvzpq) had RLS DISABLED on both dealer
-- tables while still granting SELECT/INSERT/UPDATE/DELETE to `anon`. Since the
-- anon key is public by design (it ships to the browser), that exposed every
-- dealer application's PII and — worse — dealer_invitations.token, which is
-- the credential /api/dealer/verify-token accepts to provision an account.
--
-- Every read and write of these two tables goes through the service role
-- (apply / approve-dealer / reject-dealer / renew-invite / verify-token /
-- create-account / dealers.get). The service role bypasses RLS, so enabling
-- RLS with no policies is correct: it denies anon and authenticated outright
-- without affecting the app. Do not add policies here without a reason.
ALTER TABLE public.dealer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_invitations  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.dealer_applications FROM anon, authenticated;
REVOKE ALL ON public.dealer_invitations  FROM anon, authenticated;

COMMIT;

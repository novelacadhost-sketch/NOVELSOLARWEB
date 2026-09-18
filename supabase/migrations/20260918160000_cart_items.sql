-- A server-side cart for the mobile client.
--
-- Context: the Flutter app was doing cart operations against order_items —
-- UPDATE to change a quantity, DELETE to remove a line. Both were refused in
-- 20260918140000, and should stay refused: order_items.unit_price is on that
-- table, so a scoped UPDATE would let a customer place an order at retail, let
-- it reach Bitrix with the real total, then rewrite the price afterwards. An
-- order is a record of something that already happened; the customer does not
-- get to edit it.
--
-- A cart is the opposite: mutable by definition, and worth nothing. So it gets
-- its own table, and the client may write it freely.
--
-- The website keeps its cart in localStorage (app/composables/useCart.ts) and
-- never syncs it. This table exists because the mobile cart should survive a
-- reinstall and follow the user across devices.

-- ── 1. The table ─────────────────────────────────────────────────────────
-- NOTE THE ABSENCE OF A PRICE COLUMN. That is the entire security design.
-- There is nothing on this row worth forging: the client may set the product
-- and the quantity, and /api/checkout still re-reads every price from Bitrix
-- through resolveTrustedCart() and applies the dealer gate server-side. A
-- tampered cart row buys the customer nothing.
--
-- bitrix_product_id deliberately has no FK to public.products, matching
-- order_items. products is a sync mirror whose rows are deleted when they
-- leave Bitrix, and a cascade from that would silently empty live carts on a
-- partial sync. An id that no longer resolves is rejected at checkout anyway.
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  bitrix_product_id text NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  -- Mirrors the checkout schema (z.number().int().min(1).max(99)), so a cart
  -- can never hold a quantity that checkout would reject.
  CONSTRAINT cart_items_quantity_check CHECK (quantity >= 1 AND quantity <= 99),
  -- Makes "add to cart" an upsert on (user_id, bitrix_product_id) instead of
  -- accumulating duplicate rows for the same product.
  CONSTRAINT cart_items_user_product_key UNIQUE (user_id, bitrix_product_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_user_id_fkey') THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- No separate index on user_id: the UNIQUE constraint above already builds a
-- btree with user_id leading, which serves the RLS predicate below.

-- ── 2. Keep updated_at honest ────────────────────────────────────────────
-- Every other table in this schema has an updated_at that nothing maintains.
-- A cart's is load-bearing — it is how abandoned rows get found — so this one
-- gets a trigger rather than a default that stops being true after the first
-- quantity change.
CREATE OR REPLACE FUNCTION public.touch_cart_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cart_items_set_updated_at ON public.cart_items;
CREATE TRIGGER cart_items_set_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_cart_items_updated_at();

-- ── 3. RLS: the owner may do anything to their own rows ──────────────────
-- auth.uid() is wrapped in a SELECT so it evaluates once per statement rather
-- than once per row.
--
-- WITH CHECK on INSERT and UPDATE is what stops a caller writing a row into
-- someone else's cart, or moving one of theirs into it.
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own cart" ON public.cart_items;
CREATE POLICY "Users can read their own cart" ON public.cart_items
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can add to their own cart" ON public.cart_items;
CREATE POLICY "Users can add to their own cart" ON public.cart_items
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own cart" ON public.cart_items;
CREATE POLICY "Users can update their own cart" ON public.cart_items
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete from their own cart" ON public.cart_items;
CREATE POLICY "Users can delete from their own cart" ON public.cart_items
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Allow service role full access on cart_items" ON public.cart_items;
CREATE POLICY "Allow service role full access on cart_items" ON public.cart_items
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 4. Grants ────────────────────────────────────────────────────────────
-- Full row privileges on purpose: there is no privileged column here, and
-- supabase-js .upsert() writes every column it is given, so a column-level
-- grant (the pattern used on profiles) would break the natural add-to-cart
-- call for no security gain.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;

-- A cart belongs to a signed-in user. Guests keep theirs on the device.
REVOKE ALL ON public.cart_items FROM anon;

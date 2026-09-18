-- Scope order reads to the customer who placed the order, and keep order
-- writes server-side.
--
-- Context: the mobile client was blocked creating orders and asked for
-- `FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)` on
-- public.orders. As with public.profiles in 20260914160000, the fix is NOT an
-- INSERT policy.
--
-- A client-side insert puts the price in the client's hands.
-- server/api/checkout.post.ts exists to prevent exactly that: resolveTrustedCart()
-- re-fetches every product from Bitrix, applies the dealer gate server-side, and
-- computes the total from those values. WITH CHECK (auth.uid() = user_id)
-- constrains WHOSE order a row is, not what it costs — a customer could insert a
-- 2,000,000 NGN inverter at 1 NGN, and claim dealer pricing without being a
-- dealer. A direct insert also never reaches Bitrix, where orders are actually
-- processed.
--
-- So /api/checkout now persists the order with the service role after computing
-- the total, and the client only ever reads. The mobile app reaches it with its
-- Bearer token (server/middleware/0.bearer-auth.ts).

-- ── 1. Stop every signed-in user reading every order ─────────────────────
-- The old policies were USING (true) on all three tables. That exposed every
-- customer's name, email, phone, shipping address and order total to anyone
-- holding any authenticated JWT — which includes every dealer applicant who
-- ever created an account.
--
-- Safe to narrow: nothing read these tables under a user JWT. The only reader
-- in the codebase, server/api/admin/customer/[id].get.ts, uses the service
-- role, which bypasses RLS.
--
-- auth.uid() is wrapped in a SELECT so it is evaluated once per statement
-- rather than once per row. orders_user_id_idx, order_items_order_id_idx and
-- order_events_order_id_idx already back these lookups.

DROP POLICY IF EXISTS "Allow authenticated read on orders" ON public.orders;
DROP POLICY IF EXISTS "Users can read their own orders" ON public.orders;
CREATE POLICY "Users can read their own orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Guest orders have user_id IS NULL, so the comparison is NULL and the row is
-- invisible to every authenticated caller. Only the service role sees them.

DROP POLICY IF EXISTS "Allow authenticated read on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Users can read their own order items" ON public.order_items;
CREATE POLICY "Users can read their own order items" ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Allow authenticated read on order_events" ON public.order_events;
DROP POLICY IF EXISTS "Users can read their own order events" ON public.order_events;
CREATE POLICY "Users can read their own order events" ON public.order_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_events.order_id
        AND o.user_id = (select auth.uid())
    )
  );

-- ── 2. Keep writes server-side ───────────────────────────────────────────
-- There is no INSERT, UPDATE or DELETE policy on any of the three, so all
-- three are already refused. Revoking the grants as well means adding a policy
-- later cannot silently re-open a write path that bypasses price validation.
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_events FROM authenticated;

REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;
REVOKE ALL ON public.order_events FROM anon;

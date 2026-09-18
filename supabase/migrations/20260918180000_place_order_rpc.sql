-- Let the mobile client place an order without calling /api/checkout.
--
-- The client asked to insert into public.orders directly. That stays refused
-- (20260918140000 revoked the grants) for the reason it was refused before: a
-- client INSERT lets the caller decide what an order costs.
--
-- This gives the same ergonomics without the hole. place_order_from_cart() is
-- SECURITY DEFINER, so it runs with the owner's rights and writes tables the
-- caller cannot touch, while the caller supplies only delivery details. Every
-- money value is resolved HERE, from the products mirror, exactly as
-- resolveTrustedCart() does it in the endpoint:
--
--   * unit price comes from public.products, never from the client
--   * the dealer tier is read from public.profiles, not claimed by the caller
--   * subtotal and total are summed from those prices
--   * inactive, hidden, unknown and out-of-stock products are rejected
--
-- From Flutter this is supabase.rpc('place_order_from_cart', {...}) — the same
-- client library as any other query, no HTTP endpoint involved.
--
-- WHAT THIS DOES NOT DO, and /api/checkout does:
--   * no confirmation email (the endpoint sends one through Brevo)
--   * Bitrix delivery is deferred. The order is queued into public.crm_outbox
--     instead of being pushed to the CRM inline, because a database function
--     cannot make an outbound HTTP call. Something must drain that queue or
--     the business never sees the order — see /api/admin/drain-crm-outbox.

-- ── 1. Dealer tier, read rather than claimed ─────────────────────────────
-- Own function so the policy-free lookup is in one place, and so the caller
-- cannot pass a flag. Mirrors resolveIsDealerFromEvent() in the app.
CREATE OR REPLACE FUNCTION public.is_approved_dealer(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND role = 'dealer'
      AND dealer_status = 'approved'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved_dealer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_dealer(uuid) TO authenticated, service_role;

-- ── 2. Place the order ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_order_from_cart(
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_shipping_address text,
  p_fulfillment      text DEFAULT 'delivery',
  p_branch           jsonb DEFAULT '{}'::jsonb,
  p_payment_method   text DEFAULT 'Bank Transfer'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_is_dealer boolean;
  v_order_id  uuid;
  v_ref       text;
  v_total     numeric(12,2);
  v_count     integer;
  v_bad       text;
BEGIN
  -- An order belongs to somebody. No anonymous path here; guests keep using
  -- /api/checkout, which handles them.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order.' USING ERRCODE = '42501';
  END IF;

  IF coalesce(btrim(p_first_name), '') = '' OR coalesce(btrim(p_last_name), '') = '' THEN
    RAISE EXCEPTION 'First and last name are required.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(btrim(p_email), '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'A valid email address is required.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(btrim(p_phone), '')) < 7 THEN
    RAISE EXCEPTION 'A valid phone number is required.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(btrim(p_shipping_address), '')) < 5 THEN
    RAISE EXCEPTION 'A delivery address is required.' USING ERRCODE = '22023';
  END IF;
  IF p_fulfillment NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Fulfillment must be delivery or pickup.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_count FROM public.cart_items WHERE user_id = v_uid;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Your cart is empty.' USING ERRCODE = '22023';
  END IF;

  v_is_dealer := public.is_approved_dealer(v_uid);

  -- Price the cart. Held in a CTE-backed temp result so every check below sees
  -- the same snapshot, and so a failure aborts before any row is written.
  CREATE TEMP TABLE IF NOT EXISTS _priced_cart (
    bitrix_product_id text,
    name              text,
    unit_price        numeric(12,2),
    quantity          integer,
    image_url         text,
    available         numeric,
    is_sellable       boolean
  ) ON COMMIT DROP;
  DELETE FROM _priced_cart;

  INSERT INTO _priced_cart
  SELECT
    c.bitrix_product_id,
    p.name,
    -- The dealer price only applies when the caller really is an approved
    -- dealer AND the mirror carries a sane value. A cleared or zero field
    -- falls back to retail rather than giving product away — same rule as
    -- parseBitrixPrice() treating <= 0 as unset.
    CASE
      WHEN v_is_dealer AND p.dealer_price IS NOT NULL AND p.dealer_price > 0
        THEN p.dealer_price
      ELSE p.price
    END,
    c.quantity,
    p.image_url,
    p.quantity,
    (p.id IS NOT NULL AND coalesce(p.active, true) AND v.product_id IS NULL)
  FROM public.cart_items c
  LEFT JOIN public.products p ON p.id = c.bitrix_product_id
  LEFT JOIN public.product_visibility v ON v.product_id = c.bitrix_product_id AND v.hidden
  WHERE c.user_id = v_uid;

  -- Unknown, inactive or hidden.
  SELECT string_agg(bitrix_product_id, ', ') INTO v_bad
  FROM _priced_cart WHERE NOT is_sellable;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Your cart contains an unavailable product: %', v_bad USING ERRCODE = '22023';
  END IF;

  -- Priced at nothing. Refuse rather than sell for free.
  SELECT string_agg(bitrix_product_id, ', ') INTO v_bad
  FROM _priced_cart WHERE unit_price IS NULL OR unit_price <= 0;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Your cart contains a product with invalid pricing: %', v_bad USING ERRCODE = '22023';
  END IF;

  -- Stock. A null available means the mirror does not track it, which the
  -- endpoint also treats as unlimited.
  SELECT string_agg(bitrix_product_id, ', ') INTO v_bad
  FROM _priced_cart WHERE available IS NOT NULL AND available < quantity;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Not enough stock for: %', v_bad USING ERRCODE = '22023';
  END IF;

  SELECT sum(unit_price * quantity) INTO v_total FROM _priced_cart;

  v_ref := 'ORD-' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text
                  || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.orders (
    user_id, customer_email, customer_first_name, customer_last_name,
    customer_phone, shipping_address, fulfillment, branch, payment_method,
    subtotal, shipping, total, status, client_order_ref
  ) VALUES (
    v_uid, btrim(p_email), btrim(p_first_name), btrim(p_last_name),
    btrim(p_phone), btrim(p_shipping_address), p_fulfillment,
    coalesce(p_branch, '{}'::jsonb), p_payment_method,
    v_total, 0, v_total, 'pending', v_ref
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, bitrix_product_id, name, unit_price, quantity, image_url)
  SELECT v_order_id, bitrix_product_id, name, unit_price, quantity, image_url FROM _priced_cart;

  INSERT INTO public.order_events (order_id, status, message, meta)
  VALUES (v_order_id, 'pending', 'Order placed from the mobile app',
          jsonb_build_object('source', 'place_order_from_cart', 'dealer_pricing', v_is_dealer));

  -- Bitrix cannot be called from here, so hand the order to the outbox and let
  -- a drain deliver it. Without a drain this row just accumulates and the CRM
  -- never learns about the order.
  INSERT INTO public.crm_outbox (event_type, source_table, source_id, payload)
  VALUES ('order.created', 'orders', v_order_id,
    jsonb_build_object(
      'orderId',       v_ref,
      'orderRecordId', v_order_id,
      'customer', jsonb_build_object(
        'firstName', btrim(p_first_name), 'lastName', btrim(p_last_name),
        'email', btrim(p_email), 'phone', btrim(p_phone),
        'address', btrim(p_shipping_address)
      ),
      'branch',        coalesce(p_branch, '{}'::jsonb),
      'paymentMethod', p_payment_method,
      'fulfillment',   p_fulfillment,
      'total',         v_total,
      'dealerPricing', v_is_dealer,
      'cart', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'id', bitrix_product_id, 'name', name,
                 'price', unit_price, 'quantity', quantity, 'image', image_url)), '[]'::jsonb)
               FROM _priced_cart)
    ));

  DELETE FROM public.cart_items WHERE user_id = v_uid;

  RETURN v_order_id;
END;
$$;

-- anon cannot call this: the function refuses a null auth.uid() anyway, but the
-- grant is the outer gate.
REVOKE EXECUTE ON FUNCTION public.place_order_from_cart(text,text,text,text,text,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order_from_cart(text,text,text,text,text,text,jsonb,text) TO authenticated, service_role;

-- ── 3. The outbox stays server-only ──────────────────────────────────────
-- Nothing had granted or policied crm_outbox before, since no code used it.
-- Be explicit now that it holds customer PII and drives CRM writes.
ALTER TABLE public.crm_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on crm_outbox" ON public.crm_outbox;
CREATE POLICY "Allow service role full access on crm_outbox" ON public.crm_outbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.crm_outbox FROM anon, authenticated;

-- Drains claim the oldest pending rows that are due.
CREATE INDEX IF NOT EXISTS crm_outbox_pending_idx
  ON public.crm_outbox USING btree (created_at)
  WHERE status = 'pending';

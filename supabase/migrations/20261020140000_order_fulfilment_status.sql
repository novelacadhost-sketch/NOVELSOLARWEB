-- Where an order is, set by staff on the admin Orders page and shown to the
-- customer in their order history. Separate from orders.status, which is the
-- payment/CRM state that checkout, the Paystack confirmation, the outbox drain
-- and promo-code counting all read; mixing the two would break those.
--
-- The steps live in shared/orderProgress.ts; keep this list in step with it.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfilment_status text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS fulfilment_updated_at timestamptz;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfilment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfilment_status_check CHECK (
  fulfilment_status IN (
    'received',
    'payment_confirmed',
    'preparing',
    'shipped',
    'at_fulfilment_centre',
    'out_for_delivery',
    'completed'
  )
);

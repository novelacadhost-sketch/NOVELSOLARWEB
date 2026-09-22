import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { getMailTransporter } from '../utils/mailer'
import { generateOrderReceiptHtml } from '../utils/emailTemplate'
import { bitrixFetch } from '../utils/bitrixAuth'
import { serverSupabaseServiceRole } from '#supabase/server'
import { normalizeProperty } from '../utils/normalizeProperty'
import { parseBitrixPrice } from '../utils/bitrixProperties'
import { resolveIsDealerFromEvent, resolveUserIdFromEvent } from '../utils/dealerCheck'
import { createOrderDeal } from '../utils/orderDeal'
import { describePaymentMethod } from '../utils/paymentMethod'
import { initialiseTransaction } from '../utils/paystack'
import { logger } from '../utils/logger'

import type { H3Event } from 'h3'

type SubmittedCartItem = {
  id?: string | number
  ID?: string | number
  quantity?: number
  image?: string
}

type TrustedCartItem = {
  id: string | number
  name: string
  price: number
  image: string
  quantity: number
}

// Note: TrustedCartItem is defined locally above; the import from '../types/database' was removed to avoid the duplicate declaration.

const checkoutSchema = z.object({
  customer: z.object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(7).max(30),
    address: z.string().trim().min(5).max(500),
    note: z.string().trim().max(1000).optional().default(''),
  }),
  cart: z
    .array(
      z
        .object({
          id: z.union([z.string().trim().min(1).max(80), z.number().int().positive()]).optional(),
          ID: z.union([z.string().trim().min(1).max(80), z.number().int().positive()]).optional(),
          quantity: z.number().int().min(1).max(99),
        })
        .refine((item) => item.id || item.ID, {
          message: 'A product id is required.',
        }),
    )
    .min(1)
    .max(50),
  branch: z
    .object({
      address: z.string().trim().max(500).optional(),
      state: z.string().trim().max(100).optional(),
      name: z.string().trim().max(160).optional(),
    })
    .passthrough()
    .optional()
    .default({}),
  paymentMethod: z.string().trim().min(2).max(80).optional().default('Bank Transfer'),
  // Sent by the client since 2026-09-22. Before that it was derived from
  // paymentMethod === 'pickup', which the website never sent — so every store
  // pickup was recorded, filed and receipted as a delivery. Optional so an
  // older cached client still checks out; absent falls back to the old guess.
  fulfillment: z.enum(['pickup', 'delivery']).optional(),
})

type BitrixProductResult = {
  result?: {
    ID: string | number
    ACTIVE: string
    NAME: string
    PRICE: string | number
    PROPERTY_184?: unknown
    PROPERTY_102: unknown
    PROPERTY_44?: unknown
    PREVIEW_PICTURE?: unknown
    DETAIL_PICTURE?: unknown
    QUANTITY?: string | number
    [key: string]: unknown
  }
}

async function resolveTrustedCart(event: H3Event, submittedCart: SubmittedCartItem[]) {
  const isDealer = await resolveIsDealerFromEvent(event)

  if (!Array.isArray(submittedCart) || submittedCart.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cart cannot be empty.',
    })
  }

  // Validate all items before making any network calls
  const validatedItems = submittedCart.map((item) => {
    const productId = item?.id || item?.ID
    const quantity = Number(item?.quantity)

    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cart contains an invalid product or quantity.',
      })
    }

    return { productId, quantity }
  })

  // Fetch all products in parallel instead of serially
  const responses = await Promise.all(
    validatedItems.map(({ productId }) =>
      bitrixFetch<BitrixProductResult>(`crm.product.get?id=${encodeURIComponent(String(productId))}`),
    ),
  )

  const trustedCart: TrustedCartItem[] = responses.map((response, index) => {
    const { productId, quantity } = validatedItems[index]!
    const product = response?.result

    if (!product || product.ACTIVE === 'N') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cart contains an unavailable product.',
      })
    }

    if (product.QUANTITY !== undefined && product.QUANTITY !== null && product.QUANTITY !== '') {
      const availableQty = Number(product.QUANTITY)
      if (!Number.isNaN(availableQty)) {
        if (availableQty <= 0) {
          throw createError({
            statusCode: 400,
            statusMessage: `Sorry, "${product.NAME || `Product ${productId}`}" is currently out of stock.`,
          })
        }
        if (availableQty < quantity) {
          throw createError({
            statusCode: 400,
            statusMessage: `Sorry, only ${availableQty} unit(s) of "${product.NAME || `Product ${productId}`}" are available.`,
          })
        }
      }
    }

    let price = Number(product.PRICE)
    if (isDealer) {
      // parseBitrixPrice returns null for unparseable values (e.g. the
      // "65000|NGN" money format), so an odd row falls back to retail rather
      // than making the order total NaN.
      const dealerPrice = parseBitrixPrice(normalizeProperty(product.PROPERTY_184))
      if (dealerPrice !== null) price = dealerPrice
    }

    if (!Number.isFinite(price) || price < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cart contains a product with invalid pricing.',
      })
    }

    const cloudinaryUrl = normalizeProperty(product.PROPERTY_102)
    const bitrixImage =
      normalizeProperty(product.PROPERTY_44) ||
      normalizeProperty(product.PREVIEW_PICTURE) ||
      normalizeProperty(product.DETAIL_PICTURE)
    const image =
      cloudinaryUrl ||
      (bitrixImage ? `/api/bitrix-image?url=${encodeURIComponent(bitrixImage)}` : '/images/placeholder.png')

    return {
      id: product.ID || productId,
      name: product.NAME || `Product ${productId}`,
      price,
      image,
      quantity,
    }
  })

  const total = trustedCart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return { cart: trustedCart, total }
}

type CheckoutCustomer = z.infer<typeof checkoutSchema>['customer']

// Supabase admin client carries no Database generic, so insert payloads resolve
// to `never`. Local interfaces plus `as never` at the call site is the house
// pattern — see server/api/bitrix/handler.ts.
type OrderRow = {
  user_id: string | null
  customer_email: string
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  shipping_address: string
  fulfillment: string
  branch: Record<string, unknown>
  payment_method: string
  subtotal: number
  shipping: number
  total: number
  status: string
  client_order_ref: string
}

type OrderItemRow = {
  order_id: string
  bitrix_product_id: string
  name: string
  unit_price: number
  quantity: number
  image_url: string
}

/**
 * Mirror the order into Supabase so the customer can look it up later.
 *
 * Every money value written here comes from resolveTrustedCart(), which reads
 * prices from Bitrix and applies the dealer gate server-side. Nothing the
 * client submitted reaches these columns. That is the whole reason the mobile
 * app inserts nothing directly: RLS (20260918140000) gives it read-only access
 * to its own rows and no write path at all.
 *
 * Never throws. A mirror failure must not cost the customer their order — the
 * CRM lead and the receipt are what actually matter, and the existing
 * failed-orders queue already covers a Bitrix outage.
 */
async function persistOrder(
  event: H3Event,
  order: {
    orderId: string
    customer: CheckoutCustomer
    cart: TrustedCartItem[]
    total: number
    branch: Record<string, unknown>
    paymentMethod: string
    fulfillment: 'pickup' | 'delivery'
  },
): Promise<string | null> {
  try {
    const supabase = serverSupabaseServiceRole(event)
    const userId = await resolveUserIdFromEvent(event)

    const orderRow: OrderRow = {
      user_id: userId,
      customer_email: order.customer.email,
      customer_first_name: order.customer.firstName,
      customer_last_name: order.customer.lastName,
      customer_phone: order.customer.phone,
      shipping_address: order.customer.address,
      fulfillment: order.fulfillment,
      branch: order.branch,
      payment_method: order.paymentMethod,
      subtotal: order.total,
      shipping: 0,
      total: order.total,
      status: 'pending',
      client_order_ref: order.orderId,
    }

    const { data, error } = (await supabase
      .from('orders')
      .insert(orderRow as never)
      .select('id')
      .single()) as { data: { id: string } | null; error: { message: string } | null }

    if (error || !data) {
      logger.error('Checkout API', 'Failed to mirror order to Supabase', {
        error: error?.message,
        orderId: order.orderId,
      })
      return null
    }

    const itemRows: OrderItemRow[] = order.cart.map((item) => ({
      order_id: data.id,
      bitrix_product_id: String(item.id),
      name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      image_url: item.image,
    }))

    const { error: itemsError } = (await supabase.from('order_items').insert(itemRows as never)) as {
      error: { message: string } | null
    }

    if (itemsError) {
      // The order header is already written. Leaving it is better than a silent
      // rollback: admin can still see the order exists and reconcile from Bitrix.
      logger.error('Checkout API', 'Order mirrored but line items failed', {
        error: itemsError.message,
        orderId: order.orderId,
      })
    }

    return data.id
  } catch (err) {
    logger.error('Checkout API', 'Order mirror threw', {
      error: err instanceof Error ? err.message : String(err),
      orderId: order.orderId,
    })
    return null
  }
}

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event)
  const parsedBody = checkoutSchema.safeParse(rawBody)

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedBody.error.issues[0]?.message || 'Invalid checkout details.',
    })
  }

  const body = parsedBody.data
  const config = useRuntimeConfig()
  const bitrixUrl = config.bitrixWebhookUrl

  // Safely extract data
  const customer = body.customer || {}
  const { cart, total } = await resolveTrustedCart(event, body.cart || [])
  const branch = body.branch || {}
  const paymentMethod = body.paymentMethod || 'Bank Transfer'
  const fulfillment = body.fulfillment ?? (paymentMethod === 'pickup' ? 'pickup' : 'delivery')
  const isPickup = fulfillment === 'pickup'

  if (!isValidEmail(customer.email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide a valid email address.',
    })
  }

  // Generate a unique order ID
  const orderId = `ORD-${Date.now()}-${randomUUID().slice(0, 8)}`

  // Prepare the order payload for CRM or fallback storage
  const orderPayload = {
    orderId,
    customer,
    cart,
    total,
    branch,
    paymentMethod,
    timestamp: new Date().toISOString(),
    status: 'pending',
  }

  // Mirrored before the CRM call, so a Bitrix outage cannot lose the record.
  const orderRecordId = await persistOrder(event, {
    orderId,
    customer,
    cart,
    total,
    branch,
    paymentMethod,
    fulfillment,
  })

  // A pay-now order does NOT get a deal yet.
  //
  // The deal is the sales pipeline, and an abandoned card form would otherwise
  // leave a "New Product Sales" deal nobody ever paid for. Payment creates it
  // instead — see recordPaystackPayment(). Pay-at-store is the opposite case:
  // there is no online payment to wait for, so the deal is created now and
  // sits until the customer walks in.
  const deferDealUntilPaid = paymentMethod === 'paystack'

  let crmSuccess = false
  if (deferDealUntilPaid) {
    logger.info('Checkout API', `Order ${orderId} awaiting payment; deal deferred`, { orderId })
  } else {
    logger.info('Checkout API', `Attempting to send order ${orderId} to Bitrix...`)
    try {
      // A sale is a Deal, not a Lead. See server/utils/orderDeal.ts.
      const deal = await createOrderDeal({
        orderId,
        customer,
        cart,
        total,
        branch,
        paymentMethod,
        fulfillment,
        userId: await resolveUserIdFromEvent(event),
      })

      crmSuccess = true
      logger.info('Checkout API', `✅ Created Deal in Bitrix for order ${orderId}`, {
        orderId,
        dealId: deal.dealId,
      })
    } catch (error: unknown) {
      const err = error as { data?: unknown }
      logger.error('Checkout API', 'Bitrix order submission failed', { error: err.data || error, orderId })

      // SAFETY NET: persist the order so it isn't lost while Bitrix is down.
      try {
        const storage = useStorage('data:failed-orders')
        await storage.setItem(orderId, orderPayload)
        logger.info('Checkout API', `Order ${orderId} saved to fallback queue.`)
      } catch (storageError) {
        logger.error('Checkout API', '[CRITICAL] Failed to save order to fallback storage', {
          error: storageError,
          orderId,
        })
      }
    }
  }

  // 3. GENERATE PREMIUM EMAIL HTML (always runs regardless of CRM status)
  const generatedOrderNumber = 'NS-' + Math.floor(100000 + Math.random() * 900000)

  const orderData = {
    orderNumber: generatedOrderNumber,
    orderDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    // Not paid yet when the deal was deferred — that is exactly what deferring
    // it means.
    paymentMethod: describePaymentMethod(paymentMethod, isPickup, !deferDealUntilPaid),
    branchName: branch?.address || 'N/A',
    subtotal: total,
    shipping: 0,
    total: total,
    products: cart.map((item: TrustedCartItem) => {
      // Absolute URLs only — these render in the confirmation email, where a
      // relative path resolves against the mail client, not the site.
      const siteUrl = config.public.baseUrl.replace(/\/$/, '')
      let finalImage = item.image || `${siteUrl}/images/placeholder.png`
      if (typeof finalImage === 'string' && finalImage.startsWith('/')) {
        finalImage = `${siteUrl}${finalImage}`
      }
      return {
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: finalImage,
      }
    }),
  }

  const premiumHtmlEmail = generateOrderReceiptHtml(orderData)

  // 4. SEND CONFIRMATION EMAIL VIA BREVO
  const transporter = getMailTransporter()
  if (transporter) {
    try {
      await transporter.sendMail({
        from: config.smtpFrom,
        to: customer.email,
        subject: `Your Novel Solar Order Confirmed: #${generatedOrderNumber}`,
        html: premiumHtmlEmail,
      })
      logger.info('Checkout API', 'Successfully sent order receipt email')
    } catch (error) {
      logger.error('Checkout API', 'Email error', { error })
    }
  }

  // Pay now: open the Paystack transaction here, with the total this handler
  // derived from Bitrix. Deliberately not a separate endpoint taking an
  // amount — that would let the browser name its own price.
  //
  // `reference` is the ORD- id, which is also orders.client_order_ref, so the
  // webhook and the callback can both find this order again.
  let paymentUrl: string | null = null
  let paymentError: string | null = null

  if (paymentMethod === 'paystack') {
    try {
      const transaction = await initialiseTransaction({
        reference: orderId,
        amount: total,
        email: customer.email,
        callbackUrl: `${String(config.public.baseUrl).replace(/\/$/, '')}/api/payments/paystack/callback`,
        metadata: {
          orderId,
          orderRecordId,
          fulfillment,
          branch: (branch?.name as string | undefined) ?? null,
        },
      })
      paymentUrl = transaction.authorization_url
    } catch (error: unknown) {
      // The order exists and is in the CRM; only the payment could not be
      // opened. Say so rather than sending the customer to a dead end.
      paymentError = error instanceof Error ? error.message : String(error)
      logger.error('Checkout API', 'Could not initialise Paystack transaction', { orderId, error: paymentError })
    }
  }

  return {
    success: true,
    orderId,
    // The public.orders uuid, for clients that want to read the order back.
    // Null when the mirror failed; the order itself still went through.
    orderRecordId,
    crmSuccess,
    // Present only for pay-now orders. The client must redirect here; the
    // order stays pending until Paystack confirms it.
    paymentUrl,
    paymentPending: paymentMethod === 'paystack' && !paymentUrl,
    message: crmSuccess ? 'Order processed successfully.' : 'Order received. (Saved locally for retry)',
  }
})

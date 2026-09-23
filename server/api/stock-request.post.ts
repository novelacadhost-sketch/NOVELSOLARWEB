import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { logger } from '../utils/logger'
import { fetchCatalogStock, type CatalogStock } from '../utils/catalogStock'
import {
  STOCK_REQUEST_EVENT,
  deliverStockRequest,
  type StockRequestItem,
  type StockRequestPayload,
} from '../utils/stockRequest'

/**
 * POST /api/stock-request
 *
 * What a customer submits after checkout refuses their order for lack of stock
 * (the 409 INSUFFICIENT_STOCK from /api/checkout): "we don't have that many
 * yet — leave your number and we'll call you about supply". It files a CRM
 * lead and messages procurement and sales support.
 *
 * DURABLE FIRST. The request is written to `crm_outbox` before Bitrix is
 * touched, because the obvious alternative — useStorage('data:…') like the
 * enquiry forms — has no driver configured and lives in the serverless
 * instance's memory on Vercel, so it is gone when the instance recycles. If
 * the immediate delivery fails, the row stays pending and the outbox drain
 * retries it every ten minutes with backoff.
 *
 * The row is written with next_retry_at a few minutes out so the drain cannot
 * pick it up while this request is still delivering it and file it twice.
 */

const bodySchema = z.object({
  customer: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().max(80).optional().default(''),
    phone: z.string().trim().min(7).max(30),
    email: z.string().trim().email().max(160).optional().or(z.literal('')),
  }),
  items: z
    .array(
      z.object({
        id: z.union([z.string().trim().min(1).max(40), z.number().int().positive()]),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  branch: z
    .object({
      name: z.string().trim().max(160).optional(),
      bitrixId: z.union([z.string().trim().max(20), z.number()]).optional(),
    })
    .passthrough()
    .optional(),
  note: z.string().trim().max(1000).optional(),
  client: z.enum(['web', 'app']).optional().default('web'),
})

const FIRST_RETRY_DELAY_MS = 5 * 60_000

export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(sanitizePayload(await readBody(event)))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Please provide your name, a phone number and the items.' })
  }
  const body = parsed.data

  // Names and stock come from the catalog, never from the client: what the
  // team is told about must be what is actually true, not what a request says.
  let stock = new Map<string, CatalogStock>()
  try {
    stock = await fetchCatalogStock(body.items.map((item) => item.id))
  } catch (error: unknown) {
    logger.warn('StockRequest', 'Stock lookup failed; filing the request without stock figures', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const items: StockRequestItem[] = body.items.map((item) => {
    const known = stock.get(String(item.id))
    return {
      id: String(item.id),
      name: known?.name || `Product ${item.id}`,
      requested: item.quantity,
      available: known && !known.isService ? known.quantity : null,
    }
  })

  const payload: StockRequestPayload = {
    customer: {
      firstName: body.customer.firstName,
      lastName: body.customer.lastName,
      phone: body.customer.phone,
      email: body.customer.email || null,
    },
    items,
    branch: body.branch
      ? { name: body.branch.name ?? null, bitrixId: body.branch.bitrixId ? String(body.branch.bitrixId) : null }
      : null,
    note: body.note || null,
    client: body.client,
    requestedAt: new Date().toISOString(),
  }

  const supabase = serverSupabaseServiceRole(event)

  let outboxId: string | null = null
  try {
    const { data, error } = await supabase
      .from('crm_outbox')
      .insert({
        event_type: STOCK_REQUEST_EVENT,
        payload,
        next_retry_at: new Date(Date.now() + FIRST_RETRY_DELAY_MS).toISOString(),
      } as never)
      .select('id')
      .single<{ id: string }>()
    if (error) throw error
    outboxId = data.id
  } catch (error: unknown) {
    // Not fatal yet: try to deliver anyway. Only both failing loses it.
    logger.error('StockRequest', 'Could not record stock request durably; delivering directly', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  try {
    const { leadId } = await deliverStockRequest(payload)

    if (outboxId) {
      await supabase
        .from('crm_outbox')
        .update({ status: 'sent', last_error: null, updated_at: new Date().toISOString() } as never)
        .eq('id', outboxId)
    }

    return { success: true, leadId }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    if (!outboxId) {
      // Neither recorded nor delivered. The one case the customer must be told.
      logger.error('StockRequest', '[CRITICAL] Stock request lost: not recorded and not delivered', {
        error: message,
        phone: payload.customer.phone,
        items,
      })
      throw createError({
        statusCode: 502,
        statusMessage: 'We could not send your request just now. Please try again or call us.',
      })
    }

    await supabase
      .from('crm_outbox')
      .update({ attempts: 1, last_error: message.slice(0, 500), updated_at: new Date().toISOString() } as never)
      .eq('id', outboxId)

    logger.warn('StockRequest', 'Delivery failed; queued for the outbox drain', { outboxId, error: message })

    // Recorded durably and will be retried, so from the customer's side it has
    // been received.
    return { success: true, leadId: null, queued: true }
  }
})

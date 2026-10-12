import { getSupabaseAdminClient } from './supabaseAdmin'
import { logger } from './logger'
import { bitrixFetch } from './bitrixAuth'

/**
 * Durable "send it to Bitrix later" for when Bitrix is down.
 *
 * The enquiry forms and checkout used to fall back to useStorage('data:failed-*').
 * No driver is configured for that mount, so on Vercel it is the function's
 * read-only bundle folder or instance memory: the write fails or vanishes,
 * while the customer was told "(Saved locally for retry)". These go to
 * crm_outbox instead, which the drain (/api/admin/drain-crm-outbox, run by
 * GitHub Actions) already retries with backoff.
 */

export const LEAD_EVENT = 'lead.create'

export interface QueuedLead {
  /** crm.lead.add `fields`, exactly as the endpoint would have sent them. */
  fields: Record<string, unknown>
  /** Which form it came from, for logs and for whoever reads the queue. */
  source: string
}

/** True when the lead is safely queued. Never throws. */
export async function queueLead(lead: QueuedLead): Promise<boolean> {
  try {
    const { error } = await getSupabaseAdminClient()
      .from('crm_outbox')
      .insert({ event_type: LEAD_EVENT, payload: lead } as never)
    if (error) throw error
    logger.info('CrmQueue', 'Lead queued for retry', { source: lead.source })
    return true
  } catch (error) {
    logger.error('CrmQueue', '[CRITICAL] Lead could not be queued', {
      source: lead.source,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/** Called by the drain. Throws on failure so the drain backs off and retries. */
export async function deliverQueuedLead(lead: QueuedLead): Promise<string> {
  const response = await bitrixFetch<{ result?: string | number; error?: string; error_description?: string }>(
    'crm.lead.add',
    { method: 'POST', body: { fields: lead.fields, params: { REGISTER_SONET_EVENT: 'Y' } } },
  )
  if (response.error) throw new Error(response.error_description || String(response.error))
  if (!response.result) throw new Error('crm.lead.add returned no lead id')
  return String(response.result)
}

/**
 * An order whose deal could not be created at checkout, in the shape the drain
 * already turns into a deal (event 'order.created').
 *
 * No source_id on purpose: the drain marks a linked order 'confirmed' when it
 * delivers, which is right for an app order but would wrongly mark an unpaid
 * pay-at-store order as settled.
 */
export async function queueOrderDeal(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const { error } = await getSupabaseAdminClient()
      .from('crm_outbox')
      .insert({ event_type: 'order.created', payload } as never)
    if (error) throw error
    return true
  } catch (error) {
    logger.error('CrmQueue', '[CRITICAL] Order could not be queued for its deal', {
      orderId: payload.orderId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

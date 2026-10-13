import { getSupabaseAdminClient } from '../utils/supabaseAdmin'
import { deliverQueuedLead, queueLead, type QueuedLead } from '../utils/crmQueue'
import { getSite } from '../utils/site'
import { logger } from '../utils/logger'

/**
 * Footer newsletter sign-up. Until 2026-10-13 the form had no handler and
 * every address was dropped.
 *
 * Kept in newsletter_subscribers (the list marketing exports) and sent to
 * Bitrix as a lead, falling back to the CRM outbox if Bitrix is down. Requires
 * the explicit consent tick: the NDPA does not allow marketing email on an
 * implied opt-in.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; consent?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 254)

  if (!isValidEmail(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Please enter a valid email address.' })
  }
  if (body?.consent !== true) {
    throw createError({ statusCode: 400, statusMessage: 'Please tick the box to agree to receive our emails.' })
  }

  const site = getSite(event)
  const supabase = getSupabaseAdminClient()

  const { data: existing } = (await supabase
    .from('newsletter_subscribers')
    .select('id, unsubscribed_at, bitrix_lead_id')
    .eq('email', email)
    .maybeSingle()) as { data: { id: string; unsubscribed_at: string | null; bitrix_lead_id: string | null } | null }

  // Already subscribed: say so, without a second row or a second lead.
  if (existing && !existing.unsubscribed_at) return { success: true, alreadySubscribed: true }

  const now = new Date().toISOString()
  const { data: row, error } = (await supabase
    .from('newsletter_subscribers')
    .upsert(
      { email, site: site.id, source: 'footer', consented_at: now, unsubscribed_at: null, updated_at: now } as never,
      { onConflict: 'email' },
    )
    .select('id')
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (error || !row) {
    logger.error('Newsletter', 'Could not save subscriber', { error: error?.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not subscribe you just now. Please try again.' })
  }

  const lead: QueuedLead = {
    source: 'newsletter',
    fields: {
      TITLE: `Newsletter sign-up (${site.name})`,
      EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
      COMMENTS: `Subscribed to the ${site.name} newsletter from the website footer, with explicit consent, on ${now}.`,
      SOURCE_ID: 'WEB',
      OPENED: 'Y',
    },
  }

  // A sign-up is saved either way; Bitrix is a copy, so a failure there
  // queues the lead rather than failing the request.
  try {
    const leadId = await deliverQueuedLead(lead)
    await supabase.from('newsletter_subscribers').update({ bitrix_lead_id: leadId } as never).eq('id', row.id)
  } catch (err) {
    logger.warn('Newsletter', 'Bitrix lead failed; queued', {
      error: String(err instanceof Error ? err.message : err).replace(/\/rest\/\d+\/[^/\s"]+\//g, '/rest/***/'),
    })
    await queueLead(lead)
  }

  return { success: true, alreadySubscribed: false }
})

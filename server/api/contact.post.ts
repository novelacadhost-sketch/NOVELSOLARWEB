import type { BitrixLeadResponse } from '../types/bitrix'
import { logger } from '../utils/logger'
import { queueLead } from '../utils/crmQueue'
export default defineEventHandler(async (event) => {
  interface ContactBody {
    name: string
    email: string
    message: string
    subject?: string
    phone?: string
    [key: string]: string | undefined
  }
  const body = sanitizePayload(await readBody(event)) as ContactBody
  const config = useRuntimeConfig()

  const webhookUrl = config.bitrixWebhookUrl

  if (!webhookUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CRM connection missing.',
    })
  }

  if (!body.name || !body.email || !body.message) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: name, email, message',
    })
  }

  if (!isValidEmail(body.email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide a valid email address.',
    })
  }

  const normalizedUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`

  const fields = {
    TITLE: `General Web Inquiry: ${body.subject || 'No Subject'}`,
    NAME: body.name,
    EMAIL: [{ VALUE: body.email, VALUE_TYPE: 'WORK' }],
    PHONE: [{ VALUE: body.phone || '', VALUE_TYPE: 'WORK' }],
    COMMENTS: `Inquiry Type: General Contact Form\nSubject: ${body.subject || 'No Subject'}\n\nMessage:\n${body.message}`,
    SOURCE_ID: 'WEB',
    OPENED: 'Y',
  }

  try {
    logger.info('Contact API', `Attempting to send contact inquiry to Bitrix for ${body.email}`)

    const response = await $fetch<BitrixLeadResponse>(`${normalizedUrl}crm.lead.add`, {
      method: 'POST',
      body: {
        fields,
        params: { REGISTER_SONET_EVENT: 'Y' },
      },
    })

    if (response.error) {
      logger.error('Contact API', 'Bitrix error response', {
        error: response.error,
        error_description: response.error_description,
      })
      throw new Error(response.error_description || 'Unknown Bitrix error')
    }

    logger.info('Contact API', `Successfully created Lead in Bitrix for ${body.email}`, { leadId: response.result })

    return {
      success: true,
      leadId: response.result,
    }
  } catch (error: unknown) {
    const err = error as { data?: unknown }
    logger.error('Contact API', 'Bitrix Contact Inquiry Error', { error: err.data || error, email: body.email })

    // Bitrix is down or refused it. Queue it in crm_outbox, which the drain
    // retries; the customer has done their part, so it counts as received.
    if (await queueLead({ fields, source: 'contact' })) {
      return { success: true, queued: true, message: 'Your message has been received. Our team will be in touch shortly.' }
    }

    throw createError({
      statusCode: 503,
      statusMessage: 'Failed to send message. Please try again, or reach us on WhatsApp.',
    })
  }
})

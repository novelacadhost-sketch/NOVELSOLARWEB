import type { BitrixLeadResponse } from '../types/bitrix'
import { logger } from '../utils/logger'
import { queueLead } from '../utils/crmQueue'

export default defineEventHandler(async (event) => {
  interface QuoteBody {
    firstName: string
    lastName: string
    email: string
    phone: string
    projectType: string
    details?: string
    [key: string]: string | undefined
  }
  const body = sanitizePayload(await readBody(event)) as QuoteBody
  const config = useRuntimeConfig()

  const webhookUrl = config.bitrixWebhookUrl

  if (!webhookUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CRM connection not configured.',
    })
  }

  // Validate required fields
  if (!body.firstName || !body.lastName || !body.email || !body.phone || !body.projectType) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: firstName, lastName, email, phone, projectType',
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
    TITLE: `Website Quote Request: ${body.projectType || 'General Inquiry'}`,
    NAME: body.firstName,
    LAST_NAME: body.lastName,
    EMAIL: [{ VALUE: body.email, VALUE_TYPE: 'WORK' }],
    PHONE: [{ VALUE: body.phone, VALUE_TYPE: 'WORK' }],
    COMMENTS: `Project Type: ${body.projectType}\n\nDetails:\n${body.details || 'No additional details provided'}`,
    SOURCE_ID: 'WEB',
  }

  try {
    // Format the data for Bitrix crm.lead.add
    logger.info('Quote API', `Attempting to send quote request to Bitrix for ${body.email}`, {
      projectType: body.projectType,
    })

    const response = await $fetch<BitrixLeadResponse>(`${normalizedUrl}crm.lead.add`, {
      method: 'POST',
      body: {
        fields,
        params: { REGISTER_SONET_EVENT: 'Y' },
      },
    })

    if (response.error) {
      logger.error('Quote API', 'Bitrix error response', {
        error: response.error,
        error_description: response.error_description,
        email: body.email,
      })
      throw new Error(response.error_description || 'Unknown Bitrix error')
    }

    logger.info('Quote API', `✅ Quote lead created in Bitrix for ${body.email}`, {
      leadId: response.result,
      projectType: body.projectType,
    })

    return {
      success: true,
      leadId: response.result,
      message: 'Your quote request has been submitted successfully. Our team will contact you shortly.',
    }
  } catch (error: unknown) {
    logger.error('Quote API', '❌ Bitrix Lead Creation Error', { error: error, email: body.email })

    // Bitrix is down or refused it. Queue it in crm_outbox, which the drain
    // retries; the customer has done their part, so it counts as received.
    if (await queueLead({ fields, source: 'quote' })) {
      return { success: true, queued: true, message: 'Your quote request has been received. Our team will contact you shortly.' }
    }

    throw createError({
      statusCode: 503,
      statusMessage: 'Failed to submit quote request. Please try again, or reach us on WhatsApp.',
    })
  }
})

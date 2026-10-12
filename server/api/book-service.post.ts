import type { BitrixLeadResponse } from '../types/bitrix'
import { logger } from '../utils/logger'
import { queueLead } from '../utils/crmQueue'
export default defineEventHandler(async (event) => {
  interface BookServiceBody {
    firstName: string
    lastName: string
    email: string
    phone: string
    serviceType: string
    preferredDate: string
    address: string
    details?: string
    [key: string]: string | undefined
  }
  const body = sanitizePayload(await readBody(event)) as BookServiceBody
  const config = useRuntimeConfig()
  const webhookUrl = config.bitrixWebhookUrl

  if (!webhookUrl) {
    throw createError({ statusCode: 500, statusMessage: 'CRM connection not configured.' })
  }

  if (!isValidEmail(body.email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide a valid email address.',
    })
  }

  // Ensure URL ends with a slash for safety
  const normalizedUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`

  const fields = {
    TITLE: `Service Booking: ${body.serviceType}`,
    NAME: body.firstName,
    LAST_NAME: body.lastName,
    EMAIL: [{ VALUE: body.email, VALUE_TYPE: 'WORK' }],
    PHONE: [{ VALUE: body.phone, VALUE_TYPE: 'WORK' }],
    // Put the crucial service details in the main comment block for the technician
    COMMENTS: `SERVICE REQUEST DETAILS\n------------------------\nService: ${body.serviceType}\nPreferred Date: ${body.preferredDate}\nService Address: ${body.address}\n\nCustomer Notes:\n${body.details || 'None provided'}`,
    SOURCE_ID: 'WEB',
  }

  try {
    // Format the data for Bitrix crm.lead.add
    logger.info('Book Service API', `Attempting to send booking request to Bitrix for ${body.email}`)

    const response = await $fetch<BitrixLeadResponse>(`${normalizedUrl}crm.lead.add`, {
      method: 'POST',
      body: {
        fields,
        params: { REGISTER_SONET_EVENT: 'Y' }, // Pings the sales/dispatch team in Bitrix
      },
    })

    if (response.error) {
      logger.error('Book Service API', 'Bitrix error response', {
        error: response.error,
        error_description: response.error_description,
      })
      throw new Error(response.error_description)
    }

    logger.info('Book Service API', `Successfully created Lead in Bitrix for ${body.email}`, {
      leadId: response.result,
    })

    return { success: true, leadId: response.result }
  } catch (error: unknown) {
    const err = error as { data?: unknown }
    logger.error('Book Service API', 'Bitrix Booking Error', { error: err.data || error, email: body.email })

    // Bitrix is down or refused it. Queue it in crm_outbox, which the drain
    // retries; the customer has done their part, so it counts as received.
    if (await queueLead({ fields, source: 'booking' })) {
      return { success: true, queued: true, message: 'Your booking request has been received. Our team will contact you shortly.' }
    }

    throw createError({
      statusCode: 503,
      statusMessage: 'Failed to submit booking request. Please try again, or reach us on WhatsApp.',
    })
  }
})

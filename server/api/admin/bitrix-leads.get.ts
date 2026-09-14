import { bitrixFetch } from '../../utils/bitrixAuth'
import { classifyLeadByTitle } from '../../utils/leadPayloads'
import { logger } from '../../utils/logger'
import type { BitrixLeadListResponse, TaggedLead } from '../../types/bitrix'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const startRaw = query.start
  const start = typeof startRaw === 'string' ? Number.parseInt(startRaw, 10) : Number(startRaw ?? 0)
  const safeStart = Number.isFinite(start) && start >= 0 ? start : 0

  try {
    // crm.lead.list bracket-syntax filter + ordering. Ask only for the fields we render.
    const response = await bitrixFetch<BitrixLeadListResponse>('crm.lead.list', {
      method: 'POST',
      body: {
        filter: { SOURCE_ID: 'WEB' },
        order: { DATE_CREATE: 'DESC' },
        select: [
          'ID',
          'TITLE',
          'NAME',
          'LAST_NAME',
          'EMAIL',
          'PHONE',
          'OPPORTUNITY',
          'CURRENCY_ID',
          'COMMENTS',
          'ADDRESS',
          'DATE_CREATE',
          'SOURCE_ID',
          'STATUS_ID',
        ],
        start: safeStart,
      },
    })

    if (response.error) {
      logger.error('Admin Leads', 'Bitrix error response', {
        error: response.error,
        error_description: response.error_description,
      })
      throw createError({
        statusCode: 502,
        statusMessage: 'Failed to fetch leads from Bitrix.',
      })
    }

    const leads: TaggedLead[] = (response.result || []).map((lead) => ({
      ...lead,
      submissionType: classifyLeadByTitle(lead.TITLE),
    }))

    return {
      success: true,
      leads,
      next: response.next,
      total: response.total,
    }
  } catch (error: unknown) {
    // If we already threw a createError above, surface it as-is.
    const err = error as { statusCode?: number; statusMessage?: string; data?: unknown }
    if (err.statusCode) throw error

    logger.error('Admin Leads', 'Unexpected error listing Bitrix leads', { error: err.data || error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Could not retrieve leads.',
    })
  }
})

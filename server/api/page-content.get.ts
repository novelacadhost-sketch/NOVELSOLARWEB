import { getPageContent, groupBySlot } from '../utils/siteContent'

/**
 * Editable content for one page, grouped by slot.
 *
 * Deliberately NOT a cached handler. A CMS whose edits take five minutes to
 * appear generates "I changed it and nothing happened" every time, and the
 * query is a single indexed lookup. Correctness beats the few milliseconds.
 */
export default defineEventHandler(async (event) => {
  const page = String(getQuery(event).page ?? '').trim()

  if (!page) {
    throw createError({ statusCode: 400, statusMessage: 'A page is required.' })
  }

  const rows = await getPageContent(page)

  // Edits must show up immediately, and this content is identical for everyone,
  // so a shared cache is safe — just a short one.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60')

  return { page, slots: groupBySlot(rows) }
})

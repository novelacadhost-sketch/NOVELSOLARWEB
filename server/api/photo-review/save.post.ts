import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { assertPhotoReviewAccess } from '../../utils/photoReview'
import { logger } from '../../utils/logger'

const saveSchema = z.object({
  reviewer: z.string().trim().min(2).max(80),
  items: z
    .array(
      z.object({
        file: z.string().trim().min(1).max(500),
        productIds: z.array(z.string().trim().min(1).max(40)).max(40).default([]),
        role: z.enum(['main', 'gallery', 'unknown', 'not_a_product']),
        note: z.string().trim().max(500).optional().default(''),
      }),
    )
    .min(1)
    // The page saves in batches as someone works, so a whole 961-file session
    // never arrives at once.
    .max(200),
})

interface ChoicePayload {
  file: string
  reviewer: string
  product_ids: string[]
  role: string
  note: string | null
}

export default defineEventHandler(async (event) => {
  assertPhotoReviewAccess(event)

  const parsed = saveSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Invalid request.' })
  }
  const { reviewer, items } = parsed.data

  const rows: ChoicePayload[] = items
    // An assignment must name a product; the DB check enforces this too, but a
    // rejected batch would lose the reviewer's other answers, so drop the bad
    // row here rather than failing the whole save.
    .filter((item) => !(['main', 'gallery'].includes(item.role) && item.productIds.length === 0))
    .map((item) => ({
      file: item.file,
      reviewer,
      product_ids: item.productIds,
      role: item.role,
      note: item.note || null,
    }))

  if (!rows.length) return { success: true, saved: 0 }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('photo_review_choices')
    .upsert(rows as never, { onConflict: 'file,reviewer' })

  if (error) {
    logger.error('PhotoReview', 'Could not save choices', { reviewer, count: rows.length, error: error.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not save. Your answers are still on screen.' })
  }

  logger.info('PhotoReview', 'Saved review choices', { reviewer, count: rows.length })
  return { success: true, saved: rows.length }
})

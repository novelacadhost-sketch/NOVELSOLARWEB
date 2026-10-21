import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { assertPhotoReviewAccess } from '../../utils/photoReview'
import { logger } from '../../utils/logger'

interface ProductRow {
  id: string
  name: string
  section_name: string | null
  image_url: string | null
}

interface ChoiceRow {
  file: string
  reviewer: string
  product_ids: string[]
  role: string
  note: string | null
}

/**
 * The catalogue a reviewer picks from, plus every answer given so far.
 *
 * Answers come back for ALL reviewers, not just the caller: several people
 * work through the same pile, and seeing that a file is already done is what
 * stops them duplicating each other.
 */
export default defineEventHandler(async (event) => {
  assertPhotoReviewAccess(event)

  const supabase = getSupabaseAdminClient()

  // Paged, because PostgREST caps a response at 1000 rows however the query is
  // written. The catalogue is past that, so an unpaged read silently returns a
  // truncated product list -- and a reviewer who cannot find a product marks
  // the photo "not sure" rather than identifying it. Same trap that cost the
  // mirrored images in 20261013; see CLAUDE.md.
  const products: ProductRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,section_name,image_url')
      .eq('active', true)
      .order('name', { ascending: true })
      .range(from, from + 999)

    if (error) {
      logger.error('PhotoReview', 'Could not load products', { error: error.message })
      throw createError({ statusCode: 500, statusMessage: 'Could not load the catalogue.' })
    }
    const page = (data ?? []) as ProductRow[]
    products.push(...page)
    if (page.length < 1000) break
  }

  const { data: choices, error: choicesError } = await supabase
    .from('photo_review_choices')
    .select('file,reviewer,product_ids,role,note')

  if (choicesError) {
    logger.error('PhotoReview', 'Could not load choices', { error: choicesError.message })
    throw createError({ statusCode: 500, statusMessage: 'Could not load existing answers.' })
  }

  setHeader(event, 'Cache-Control', 'private, no-store')

  return {
    products: products.map((p) => ({
      id: String(p.id),
      name: p.name,
      section: p.section_name,
      hasImage: Boolean(p.image_url),
    })),
    choices: ((choices ?? []) as ChoiceRow[]).map((c) => ({
      file: c.file,
      reviewer: c.reviewer,
      productIds: c.product_ids ?? [],
      role: c.role,
      note: c.note,
    })),
  }
})

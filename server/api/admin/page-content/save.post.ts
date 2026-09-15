import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { logger } from '../../../utils/logger'

/**
 * Replace every block in one (page, slot).
 *
 * The whole slot arrives at once rather than one block per request, because
 * reordering is just "here is the new order" — otherwise the client has to send
 * a sequence of moves and the server has to apply them without ever colliding
 * on the (page, slot, sort) unique key.
 *
 * Order of operations matters: upsert the incoming blocks FIRST, then delete
 * anything past the new length. Deleting first would leave the slot empty for
 * the length of the request, and a visitor landing in that window would see the
 * hardcoded fallback flash in.
 */

interface IncomingBlock {
  image_url?: string | null
  alt?: string | null
  eyebrow?: string | null
  title?: string | null
  description?: string | null
  caption?: string | null
  link?: string | null
  active?: boolean
}

interface SaveBody {
  page?: string
  slot?: string
  blocks?: IncomingBlock[]
}

const MAX_BLOCKS = 40
const str = (v: unknown, max: number) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SaveBody>(event)
  const page = str(body?.page, 120)
  const slot = str(body?.slot, 120)

  if (!page || !slot) {
    throw createError({ statusCode: 400, statusMessage: 'page and slot are required.' })
  }

  const blocks = Array.isArray(body?.blocks) ? body.blocks : null
  if (!blocks) {
    throw createError({ statusCode: 400, statusMessage: 'blocks must be an array.' })
  }
  if (blocks.length > MAX_BLOCKS) {
    throw createError({ statusCode: 400, statusMessage: `Too many blocks (max ${MAX_BLOCKS}).` })
  }

  // An image-less block renders nothing, and saving one silently drops that
  // slide from the page later — reject it here where the admin can see why.
  const missing = blocks.findIndex((b) => !str(b.image_url, 2000))
  if (missing !== -1) {
    throw createError({ statusCode: 400, statusMessage: `Block ${missing + 1} has no image.` })
  }

  const supabase = getSupabaseAdminClient()
  const updatedBy = event.context.admin?.user_id ?? null

  const rows = blocks.map((b, index) => ({
    page,
    slot,
    sort: index,
    image_url: str(b.image_url, 2000),
    alt: str(b.alt, 300),
    eyebrow: str(b.eyebrow, 200),
    title: str(b.title, 300),
    description: str(b.description, 2000),
    caption: str(b.caption, 300),
    link: str(b.link, 2000),
    active: b.active !== false,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }))

  try {
    if (rows.length) {
      const { error } = await supabase
        .from('site_content')
        .upsert(rows as never, { onConflict: 'page,slot,sort' })
      if (error) throw error
    }

    // Anything beyond the new length is a block that was removed.
    const { error: trimError } = await supabase
      .from('site_content')
      .delete()
      .eq('page', page)
      .eq('slot', slot)
      .gte('sort', rows.length)
    if (trimError) throw trimError

    logger.info('PageContent', 'Slot saved', { page, slot, blocks: rows.length })
    return { success: true, page, slot, blocks: rows.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('PageContent', 'Save failed', { page, slot, error: message })
    throw createError({ statusCode: 500, statusMessage: `Failed to save content: ${message}` })
  }
})

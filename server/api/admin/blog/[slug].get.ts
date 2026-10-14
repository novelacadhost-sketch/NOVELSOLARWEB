import { assertValidSlug } from '../../../utils/blogContent'
import { readPost } from '../../../utils/blogSource'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  assertValidSlug(slug)

  const post = await readPost(slug as string)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: `Blog post not found: ${slug}` })
  }

  return { success: true, post }
})

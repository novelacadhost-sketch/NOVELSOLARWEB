import { logger } from '../../../utils/logger'
import {
  assertValidSlug,
  isValidSlug,
  relativeFilePathForSlug,
  serializePost,
  type BlogFrontmatter,
} from '../../../utils/blogContent'
import { adminToCommitAuthor, commitMessageFor, getRemoteFile, putRemoteFile } from '../../../utils/blogGithub'
import { readPost } from '../../../utils/blogSource'

interface SaveBody {
  slug: string
  originalSlug?: string
  title: string
  description?: string
  excerpt?: string
  date?: string
  image?: string
  category?: string
  author?: string
  draft?: boolean
  body?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SaveBody>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required.' })
  }

  const slug = (body.slug || '').toLowerCase().trim()
  assertValidSlug(slug)

  const originalSlug = body.originalSlug ? body.originalSlug.toLowerCase().trim() : ''
  const isRename = originalSlug && originalSlug !== slug
  if (originalSlug && !isValidSlug(originalSlug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid originalSlug.' })
  }

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Post title is required.' })
  }

  // From the repo, not the disk: in production there is no content/blog on
  // disk, so this never found a clash and a new post could overwrite one.
  const collision = await readPost(slug).catch(() => null)

  // If a file already exists at the target slug, we MUST reject it,
  // UNLESS the user is updating this exact same post (originalSlug === slug).
  if (collision && originalSlug !== slug) {
    throw createError({
      statusCode: 409,
      statusMessage: `A post with the slug "${slug}" already exists. Please modify the title or slug.`,
    })
  }

  const frontmatter: BlogFrontmatter = {
    title: body.title.trim(),
    description: body.description?.trim() || undefined,
    excerpt: body.excerpt?.trim() || undefined,
    date: body.date || new Date().toISOString().slice(0, 10),
    image: body.image?.trim() || undefined,
    category: body.category?.trim() || undefined,
    author: body.author?.trim() || undefined,
    draft: body.draft === true,
  }

  const fileContent = serializePost({ frontmatter, body: body.body || '' })
  const filePath = relativeFilePathForSlug(slug)
  const author = adminToCommitAuthor(event.context.admin)

  const existing = await getRemoteFile(filePath)
  const isNew = !existing
  const action: 'publish' | 'update' = isNew ? 'publish' : 'update'

  const writeResult = await putRemoteFile({
    filePath,
    content: fileContent,
    message: commitMessageFor(action, slug),
    author,
    sha: existing?.sha,
  })

  let renameCommitSha: string | undefined
  if (isRename) {
    const oldPath = relativeFilePathForSlug(originalSlug)
    const oldRemote = await getRemoteFile(oldPath)
    if (oldRemote) {
      const { deleteRemoteFile } = await import('../../../utils/blogGithub')
      const del = await deleteRemoteFile({
        filePath: oldPath,
        message: commitMessageFor('delete', originalSlug),
        author,
        sha: oldRemote.sha,
      })
      renameCommitSha = del.commitSha
    }
  }

  // Trigger Vercel build immediately
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL
  if (deployHookUrl) {
    // Fire and forget - don't await so we don't block the UI
    $fetch(deployHookUrl, { method: 'POST' }).catch((err) => {
      logger.error('Blog Save', 'Failed to trigger Vercel deploy hook', { error: err })
    })
  }

  return {
    success: true,
    slug,
    action,
    commitSha: writeResult.commitSha,
    renameCommitSha,
    message: `Committed to GitHub. The change will be live after the deployment triggered by this commit completes.`,
  }
})

import {
  BLOG_CONTENT_DIR,
  assertValidSlug,
  isValidSlug,
  listLocalPosts,
  parseMarkdownFile,
  readLocalPost,
  relativeFilePathForSlug,
  type BlogPostFile,
} from './blogContent'
import { getRemoteFile, listRemoteDirectory } from './blogGithub'

/**
 * Where the admin blog screens read posts from.
 *
 * With BLOG_GITHUB_TOKEN set, the GitHub repo the editor commits to. That is
 * the source of truth, and the only one that exists in production: on Vercel
 * the serverless function has no content/blog folder, so reading it from disk
 * gave the admin an empty list and "post not found" for every post, while the
 * public blog (bundled by Nuxt Content at build) showed them fine. It also
 * shows a just-saved post before its deployment finishes.
 *
 * Without a token (local development), the files on disk.
 */
const remote = () => Boolean((process.env.BLOG_GITHUB_TOKEN || '').trim())

export async function listPosts(): Promise<BlogPostFile[]> {
  if (!remote()) return listLocalPosts()

  const files = (await listRemoteDirectory(BLOG_CONTENT_DIR)).filter(
    (f) => f.name.endsWith('.md') && isValidSlug(f.name.slice(0, -3)),
  )
  const posts = await Promise.all(
    files.map(async (f) => {
      const slug = f.name.slice(0, -3)
      const file = await getRemoteFile(f.path)
      return file ? parseMarkdownFile(file.content, slug) : null
    }),
  )
  return posts
    .filter((p): p is BlogPostFile => p !== null)
    .sort((a, b) => (b.frontmatter.date || '').localeCompare(a.frontmatter.date || ''))
}

export async function readPost(slug: string): Promise<BlogPostFile | null> {
  assertValidSlug(slug)
  if (!remote()) return readLocalPost(slug)
  const file = await getRemoteFile(relativeFilePathForSlug(slug))
  return file ? parseMarkdownFile(file.content, slug) : null
}

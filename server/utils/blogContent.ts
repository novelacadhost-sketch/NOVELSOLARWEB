import { promises as fs } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export const BLOG_CONTENT_DIR = 'content/blog'
export const BLOG_FRONTMATTER_FIELDS = [
  'title',
  'slug',
  'description',
  'excerpt',
  'date',
  'image',
  'category',
  'author',
  'draft',
] as const

export interface BlogFrontmatter {
  title: string
  description?: string
  excerpt?: string
  date: string
  image?: string
  category?: string
  author?: string
  draft: boolean
}

export interface BlogPostFile {
  slug: string
  frontmatter: BlogFrontmatter
  body: string
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && slug.length > 0 && slug.length <= 96 && SLUG_RE.test(slug)
}

export function assertValidSlug(slug: unknown): asserts slug is string {
  if (!isValidSlug(slug)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid slug. Use lowercase letters, numbers, and dashes (e.g. solar-101).',
    })
  }
}

export function relativeFilePathForSlug(slug: string) {
  assertValidSlug(slug)
  return `${BLOG_CONTENT_DIR}/${slug}.md`
}

export function absoluteFilePathForSlug(slug: string) {
  return path.join(process.cwd(), relativeFilePathForSlug(slug))
}

function coerceFrontmatter(raw: Record<string, any>, fallbackSlug: string): BlogFrontmatter {
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Post title is required.' })
  }

  const date = typeof raw.date === 'string' && raw.date ? raw.date : new Date().toISOString().slice(0, 10)

  return {
    title,
    description: typeof raw.description === 'string' ? raw.description.trim() : undefined,
    excerpt: typeof raw.excerpt === 'string' ? raw.excerpt.trim() : undefined,
    date,
    image: typeof raw.image === 'string' && raw.image ? raw.image : undefined,
    category: typeof raw.category === 'string' && raw.category ? raw.category : undefined,
    author: typeof raw.author === 'string' && raw.author ? raw.author : undefined,
    draft: raw.draft === true,
  }
}

export function parseMarkdownFile(raw: string, slug: string): BlogPostFile {
  // A byte-order mark (left by some Windows editors) stops the front matter
  // being recognised: itel-power-tank.md lost its title, image and date to one.
  const parsed = matter(raw.replace(/^\uFEFF/, ''))
  return {
    slug,
    frontmatter: coerceFrontmatter(parsed.data || {}, slug),
    body: (parsed.content || '').replace(/^\n+/, ''),
  }
}

export function serializePost(input: { frontmatter: BlogFrontmatter; body: string }): string {
  const { frontmatter, body } = input
  const ordered: Record<string, unknown> = {}
  for (const key of BLOG_FRONTMATTER_FIELDS) {
    if (key === 'slug') continue
    const value = (frontmatter as Record<string, unknown>)[key]
    if (value === undefined || value === null || value === '') continue
    ordered[key] = value
  }
  if (frontmatter.draft === false && !('draft' in ordered)) {
    ordered.draft = false
  }

  return matter.stringify((body || '').trim() + '\n', ordered)
}

export async function listLocalPosts(): Promise<BlogPostFile[]> {
  const dir = path.join(process.cwd(), BLOG_CONTENT_DIR)
  let entries: string[] = []
  try {
    entries = await fs.readdir(dir)
  } catch (err: any) {
    if (err?.code === 'ENOENT') return []
    throw err
  }

  const posts: BlogPostFile[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const slug = entry.replace(/\.md$/, '')
    if (!isValidSlug(slug)) continue
    const raw = await fs.readFile(path.join(dir, entry), 'utf8')
    posts.push(parseMarkdownFile(raw, slug))
  }

  posts.sort((a, b) => (b.frontmatter.date || '').localeCompare(a.frontmatter.date || ''))
  return posts
}

export async function readLocalPost(slug: string): Promise<BlogPostFile | null> {
  assertValidSlug(slug)
  try {
    const raw = await fs.readFile(absoluteFilePathForSlug(slug), 'utf8')
    return parseMarkdownFile(raw, slug)
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null
    throw err
  }
}

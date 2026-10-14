import { listPosts } from '../../../utils/blogSource'

export default defineEventHandler(async () => {
  const posts = await listPosts()
  return {
    success: true,
    posts: posts.map(({ slug, frontmatter }) => ({
      slug,
      title: frontmatter.title,
      description: frontmatter.description || '',
      excerpt: frontmatter.excerpt || '',
      date: frontmatter.date,
      image: frontmatter.image || '',
      category: frontmatter.category || '',
      author: frontmatter.author || '',
      draft: frontmatter.draft,
    })),
  }
})

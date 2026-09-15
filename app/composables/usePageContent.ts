/**
 * Editable page content, with the page's built-in content as the fallback.
 *
 * Usage keeps the hardcoded literal in the component:
 *
 *   const { slot } = await usePageContent('home')
 *   const heroSlides = computed(() => slot('hero', HERO_SLIDES_FALLBACK))
 *
 * That literal is not dead code — it is what renders before anything has been
 * edited, and what renders if the CMS is empty or unavailable. Deleting it
 * turns a database hiccup into a blank hero.
 */

export interface ContentBlock {
  image: string
  alt?: string
  eyebrow?: string
  title?: string
  description?: string
  caption?: string
  link?: string
}

interface ContentRow {
  image_url: string | null
  alt: string | null
  eyebrow: string | null
  title: string | null
  description: string | null
  caption: string | null
  link: string | null
}

function toBlock(row: ContentRow): ContentBlock | null {
  // A row with no image cannot render; skipping beats an empty <img>.
  if (!row.image_url) return null
  return {
    image: row.image_url,
    alt: row.alt ?? undefined,
    eyebrow: row.eyebrow ?? undefined,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    caption: row.caption ?? undefined,
    link: row.link ?? undefined,
  }
}

export async function usePageContent(page: string) {
  const { data } = await useAsyncData(
    `page-content:${page}`,
    () => $fetch<{ slots: Record<string, ContentRow[]> }>('/api/page-content', { query: { page } }),
    {
      // An unreachable endpoint must look the same as "nothing edited yet".
      default: () => ({ slots: {} as Record<string, ContentRow[]> }),
    },
  )

  function slot<T extends ContentBlock>(name: string, fallback: T[]): (T | ContentBlock)[] {
    const rows = data.value?.slots?.[name]
    if (!rows?.length) return fallback

    const blocks = rows.map(toBlock).filter((b): b is ContentBlock => b !== null)
    return blocks.length ? blocks : fallback
  }

  /** Single-image slots — a logo, one banner — where only the first row matters. */
  function one<T extends ContentBlock>(name: string, fallback: T): T | ContentBlock {
    return slot(name, [fallback])[0] ?? fallback
  }

  return { slot, one }
}

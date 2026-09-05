<template>
  <div class="min-h-screen bg-white font-sans selection:bg-[#002888]/10">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <NuxtLink to="/blog" class="inline-flex items-center text-[#002888] font-bold text-sm hover:underline group">
        <span class="material-symbols-outlined text-sm mr-2 transform group-hover:-translate-x-1 transition-all"
          >arrow_back</span
        >
        Back to Blog Hub
      </NuxtLink>
    </div>

    <article v-if="post" class="max-w-4xl mx-auto px-4 pb-24">
      <header class="text-center mb-14">
        <div class="flex items-center justify-center gap-3 mb-5">
          <span
            v-if="post.category"
            class="bg-blue-50 text-[#002888] text-xs font-black px-3 py-1 rounded-md uppercase tracking-widest"
            >{{ post.category }}</span
          >
          <span class="text-slate-300">•</span>
          <p class="text-sm text-slate-500 font-medium">{{ formatDate(post.date) }}</p>
        </div>

        <h1 class="text-4xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
          {{ post.title }}
        </h1>

        <div v-if="post.author" class="flex items-center justify-center gap-2 text-slate-600">
          <span class="material-symbols-outlined text-xl">edit_document</span>
          <span class="font-bold text-sm">Written by {{ post.author }}</span>
        </div>
      </header>

      <div
        class="aspect-video relative bg-slate-50 rounded-3xl overflow-hidden shadow-xl border border-slate-100 mb-14"
      >
        <FadeImage
          v-if="post.image"
          use-nuxt-img
          :src="post.image"
          width="1200"
          height="675"
          class="w-full h-full absolute inset-0"
          image-class="object-cover"
          :alt="post.title"
        />
        <FadeImage
          v-else
          use-nuxt-img
          src="/images/fallback-post.png"
          width="1200"
          height="675"
          class="w-full h-full absolute inset-0"
          image-class="object-cover"
          :alt="post.title"
        />
      </div>

      <div
        class="prose prose-slate lg:prose-xl max-w-none prose-headings:font-black prose-a:text-[#002888] prose-a:font-bold"
      >
        <ContentRenderer :value="post" />
      </div>
    </article>

    <div v-else class="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <h1 class="text-4xl md:text-5xl font-black text-slate-900 mb-4">Insight Not Found</h1>
      <p class="text-slate-500 mb-8">The article you are looking for does not exist.</p>
      <NuxtLink
        to="/blog"
        class="inline-flex items-center gap-2 bg-[#002888] text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-900 transition-all"
      >
        Back to Blog
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const runtimeConfig = useRuntimeConfig()

const siteBaseUrl = runtimeConfig.public.baseUrl?.replace(/\/$/, '') || 'https://novelsolar.com'
const fallbackOgImage = `${siteBaseUrl}/images/fallback-post.png`
const defaultDescription = 'Discover in-depth solar technology expertise.'

const slug = computed(() => {
  const raw = route.params.slug
  if (Array.isArray(raw)) return raw[0] || ''
  return raw || ''
})

const contentPath = computed(() => `/blog/${slug.value}`)

const { data: post } = await useAsyncData(
  () => `blog-post-${slug.value || 'loading'}`,
  async () => {
    if (!slug.value) return null
    const doc = await queryContent('blog')
      .where({ _path: contentPath.value, draft: { $ne: true } })
      .findOne()
    return doc || null
  },
  { watch: [slug] },
)

const toAbsoluteImage = (path) => {
  if (!path) return fallbackOgImage
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${siteBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

const formatDate = (dateString) => {
  if (!dateString) return 'Latest Release'
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString))
}

useSeoMeta({
  title: () => (post.value?.title ? `${post.value.title} | Novel Solar Insights` : 'Novel Solar Insights'),
  description: () => post.value?.description || defaultDescription,
  ogTitle: () => post.value?.title || 'Novel Solar Insights',
  ogDescription: () => post.value?.description || defaultDescription,
  ogImage: () => toAbsoluteImage(post.value?.image),
  ogUrl: () => `${siteBaseUrl}${route.path}`,
  twitterCard: 'summary_large_image',
})
</script>

<script setup lang="ts">
/**
 * The shared layout for partners created in the admin.
 *
 * The five original partners each have a hand-built component and do not use
 * this. `partners/[brand]/index.vue` prefers a custom component whenever one is
 * registered, so a page built here can later be replaced by a bespoke one on
 * the same URL — this is the stand-in, not a downgrade the site is stuck with.
 *
 * Every section below renders only when it has content, so a partner added with
 * a name and a logo looks deliberate rather than half-empty.
 */

const props = defineProps<{ slug: string }>()

interface Partner {
  slug: string
  name: string
  tagline: string | null
  description: string | null
  logo_url: string | null
  hero_url: string | null
  accent_color: string | null
  website_url: string | null
}

interface ContentRow {
  image_url: string | null
  alt: string | null
  title: string | null
  description: string | null
  link: string | null
}

const { data, error } = await useAsyncData(`partner:${props.slug}`, () =>
  $fetch<{ partner: Partner; slots: Record<string, ContentRow[]> }>(`/api/partner/${props.slug}`),
)

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Partner not found', fatal: true })
}

const partner = computed(() => data.value?.partner ?? null)
const gallery = computed(() => (data.value?.slots?.gallery ?? []).filter((r) => r.image_url))
const highlights = computed(() => (data.value?.slots?.highlights ?? []).filter((r) => r.title || r.image_url))

// Falls back to the house blue so a partner with no colour set still looks styled.
const accent = computed(() => partner.value?.accent_color || '#002888')

useHead(() => ({
  title: partner.value ? `${partner.value.name} | NovelSolar Partner` : 'Partner | NovelSolar',
  meta: [
    {
      name: 'description',
      content:
        partner.value?.tagline || `Official NovelSolar partner portal for ${partner.value?.name ?? 'our partners'}`,
    },
  ],
}))
</script>

<template>
  <div v-if="partner" class="bg-white">
    <section class="relative overflow-hidden">
      <img
        v-if="partner.hero_url"
        :src="partner.hero_url"
        :alt="`${partner.name} banner`"
        class="h-[38vh] min-h-[260px] w-full object-cover sm:h-[52vh]"
      >
      <div v-else class="h-40 w-full" :style="{ backgroundColor: accent }" />

      <div class="mx-auto max-w-6xl px-4">
        <div class="-mt-16 flex flex-wrap items-end gap-6 rounded-3xl bg-white p-6 shadow-xl sm:-mt-20 sm:p-8">
          <img
            v-if="partner.logo_url"
            :src="partner.logo_url"
            :alt="`${partner.name} logo`"
            class="h-20 w-auto max-w-[180px] object-contain"
          >
          <div class="min-w-[14rem] flex-1">
            <h1 class="text-2xl font-black uppercase tracking-tight sm:text-4xl" :style="{ color: accent }">
              {{ partner.name }}
            </h1>
            <p v-if="partner.tagline" class="mt-2 text-sm text-slate-600 sm:text-base">{{ partner.tagline }}</p>
          </div>
          <a
            v-if="partner.website_url"
            :href="partner.website_url"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider text-white"
            :style="{ backgroundColor: accent }"
          >
            Visit website
          </a>
        </div>
      </div>
    </section>

    <section v-if="partner.description" class="mx-auto max-w-4xl px-4 py-12">
      <p class="whitespace-pre-line text-base leading-relaxed text-slate-700">{{ partner.description }}</p>
    </section>

    <section v-if="highlights.length" class="mx-auto max-w-6xl px-4 pb-12">
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="(item, i) in highlights" :key="i" class="rounded-2xl border border-slate-200 p-5">
          <img v-if="item.image_url" :src="item.image_url" :alt="item.alt || ''" class="mb-4 h-40 w-full rounded-xl object-cover">
          <h3 v-if="item.title" class="text-base font-bold text-slate-900">{{ item.title }}</h3>
          <p v-if="item.description" class="mt-2 text-sm leading-relaxed text-slate-600">{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section v-if="gallery.length" class="mx-auto max-w-6xl px-4 pb-16">
      <h2 class="mb-5 text-lg font-black uppercase tracking-tight text-slate-900">Gallery</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <img
          v-for="(item, i) in gallery"
          :key="i"
          :src="item.image_url!"
          :alt="item.alt || `${partner.name} image ${i + 1}`"
          class="h-56 w-full rounded-2xl object-cover"
        >
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 pb-20">
      <NuxtLink
        to="/shop"
        class="inline-block rounded-xl px-6 py-3 text-xs font-black uppercase tracking-wider text-white"
        :style="{ backgroundColor: accent }"
      >
        Shop products
      </NuxtLink>
    </section>
  </div>
</template>

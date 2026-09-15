<template>
  <div>
    <!-- A hand-built component always wins. See the note in the script block. -->
    <component :is="activeComponent" v-if="activeComponent" />

    <!-- Otherwise a partner created in /admin/manage-partners, via the shared template. -->
    <PartnerTemplate v-else-if="hasTemplatePartner" :slug="slug" />

    <!-- Neither: the brand is not a partner we know about. -->
    <div v-else class="min-h-[70vh] flex flex-col items-center justify-center bg-gray-50 p-8 text-center pt-32 pb-32">
      <div
        class="w-24 h-24 bg-white rounded-full shadow-md flex items-center justify-center mb-8 border border-gray-100"
      >
        <svg class="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <h1 class="text-4xl font-black text-[#002888] mb-4 tracking-tight">
        Partner Gateway: <span class="uppercase text-gray-900">{{ formattedBrand }}</span>
      </h1>
      <p class="text-xl text-gray-500 max-w-2xl font-medium leading-relaxed mb-8 inline-block">
        We are actively preparing the dedicated official portal for
        <strong class="text-gray-900">{{ formattedBrand }}</strong
        >. Check back soon to explore their complete line of advanced energy solutions.
      </p>
      <div>
        <NuxtLink
          to="/partners"
          class="inline-flex items-center gap-2 bg-[#002888] text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-900 transition-colors shadow-lg active:scale-95"
        >
          &larr; Return to All Partners
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'nuxt/app'

const route = useRoute()

const formattedBrand = computed(() => {
  const b = route.params.brand as string
  return b ? b.charAt(0).toUpperCase() + b.slice(1) : ''
})

const componentMap: Record<string, any> = {
  itel: defineAsyncComponent(() => import('~/components/partners/PartnerItel.vue')),
  haisic: defineAsyncComponent(() => import('~/components/partners/PartnerHaisic.vue')),
  yinergy: defineAsyncComponent(() => import('~/components/partners/PartnerYinergy.vue')),
  livoltek: defineAsyncComponent(() => import('~/components/partners/PartnerLivoltek.vue')),
  hithium: defineAsyncComponent(() => import('~/components/partners/PartnerHithium.vue')),
}

const slug = computed(() => String(route.params.brand ?? '').toLowerCase())

/**
 * A registered component always wins over the database.
 *
 * That ordering is what lets a partner page built in the admin be remade by
 * hand later: write PartnerFoo.vue, add it to componentMap above, and it takes
 * over the same URL on the next deploy. Nothing needs migrating, no link
 * breaks, and the row can stay or be switched off afterwards.
 */
const activeComponent = computed(() => (slug.value ? componentMap[slug.value] || null : null))

// Only asked when no custom component exists, so the five hand-built partners
// cost no extra request.
const { data: templatePartner } = await useAsyncData(
  () => `partner-exists:${slug.value}`,
  async () => {
    if (!slug.value || componentMap[slug.value]) return null
    try {
      return await $fetch<{ partner: { slug: string } }>(`/api/partner/${slug.value}`)
    } catch {
      // 404 is the ordinary answer for a brand nobody has set up.
      return null
    }
  },
  { watch: [slug] },
)

const hasTemplatePartner = computed(() => Boolean(templatePartner.value?.partner))

useHead({
  title: `${formattedBrand.value} Portal | NovelSolar Partner`,
  meta: [{ name: 'description', content: `Official NovelSolar partner portal for ${formattedBrand.value}` }],
})
</script>

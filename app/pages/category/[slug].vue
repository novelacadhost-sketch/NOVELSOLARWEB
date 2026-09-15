<template>
  <div class="min-h-screen bg-slate-50 py-12 px-6 lg:px-12">
    <div class="max-w-7xl mx-auto">
      <nav class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <NuxtLink to="/" class="hover:text-[#002888] transition-colors">Home</NuxtLink>
        <span class="text-gray-300">/</span>
        <NuxtLink to="/products" class="hover:text-[#002888] transition-colors">Products</NuxtLink>
        <span class="text-gray-300">/</span>
        <span class="text-gray-900 capitalize">{{ categorySlug.replace(/-/g, ' ') }}</span>
      </nav>

      <h1 class="text-4xl font-black text-[#002888] capitalize mb-2 tracking-tight">
        {{ categorySlug.replace(/-/g, ' ') }} Inventory
      </h1>
      <p class="text-gray-500 font-medium mb-10">
        Browse our selection of {{ categorySlug.replace(/-/g, ' ') }} for your solar projects.
      </p>

      <div class="flex flex-wrap gap-3 mb-12">
        <!-- The sub-filters are the Bitrix sections now, so Lighting no longer
             needs its buttons disabled: keyword matching could not tell a
             floodlight from a bulb, the taxonomy can. -->
        <button
          v-for="filter in filterOptions"
          :key="filter"
          :class="[
            'px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border-2',
            activeFilter === filter
              ? 'bg-[#002888] text-white border-[#002888] shadow-md scale-105'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-[#002888] hover:scale-105',
          ]"
          @click="activeFilter = filter"
        >
          {{ filter }}
        </button>
      </div>

      <div v-if="pending" class="flex justify-center py-20 text-center">
        <div class="w-10 h-10 border-4 border-[#002888]/10 border-t-[#002888] rounded-full animate-spin" />
      </div>

      <div
        v-else-if="filteredProducts && filteredProducts.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <ProductCard v-for="product in filteredProducts" :key="product.ID" :product="product" />
      </div>

      <div v-if="!pending && filteredProducts.length > 0 && !reachedEnd" class="mt-10 flex justify-center">
        <button
          class="px-8 py-3 bg-white border-2 border-[#002888] text-[#002888] font-bold rounded-xl hover:bg-slate-50 transition-colors"
          @click="loadMore"
        >
          Load More Products
        </button>
      </div>

      <div
        v-else
        class="bg-white rounded-2xl border-2 border-dashed border-gray-100 p-20 text-center flex flex-col items-center"
      >
        <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <p class="text-gray-400 font-bold uppercase text-sm">
          No {{ activeFilter !== 'All' ? activeFilter : 'matching' }} units found in this category.
        </p>
        <button
          v-if="activeFilter !== 'All'"
          class="mt-6 text-[#002888] font-bold text-sm hover:underline"
          @click="activeFilter = 'All'"
        >
          Clear Filters &rarr;
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CATEGORY_GROUPS } from '~/utils/productCategories'
import { excludeServiceProducts } from '~/utils/productFilters'
const route = useRoute()
const categorySlug = computed(() => (route.params.slug || '').toString())

/**
 * The category's Bitrix sections. The page requests these from the server, so a
 * category returns all of its products rather than whatever landed in an
 * arbitrary first page of fifty — "Inverters" read 2 Results out of 192.
 */
const group = computed(() => CATEGORY_GROUPS.find((g) => g.id === categorySlug.value.toLowerCase()) ?? null)

const activeFilter = ref('All')

// The sub-filters ARE the Bitrix sections, so "Hybrid / Regular / Solar
// Generator" stops being a keyword guess and becomes the real subdivision.
const filterOptions = computed(() => ['All', ...(group.value?.sections ?? [])])

const sectionsParam = computed(() => {
  if (!group.value) return ''
  return activeFilter.value === 'All' ? group.value.sections.join(',') : activeFilter.value
})

const PAGE_SIZE = 50
const start = ref(0)
// Shaped for ProductCard, which requires these three; everything else on a
// Bitrix product passes through.
interface ShopProduct { ID: string | number; NAME: string; PRICE: string | number; [key: string]: unknown }
const loaded = ref<ShopProduct[]>([])
const pending = ref(true)
const reachedEnd = ref(false)

const toArray = (payload: unknown): ShopProduct[] => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload as ShopProduct[]
  const p = payload as { data?: unknown; result?: unknown }
  if (Array.isArray(p.data)) return p.data as ShopProduct[]
  if (Array.isArray(p.result)) return p.result as ShopProduct[]
  return []
}

async function loadPage(reset = false) {
  if (reset) {
    start.value = 0
    reachedEnd.value = false
  }
  pending.value = reset
  try {
    const payload = await $fetch('/api/inventory', {
      query: { sections: sectionsParam.value || undefined, start: start.value },
      // Forward the auth cookie so dealers get dealer pricing during SSR.
      headers: useRequestHeaders(['cookie']),
    })
    const page = excludeServiceProducts(toArray(payload))
    loaded.value = reset ? page : [...loaded.value, ...page]
    if (page.length < PAGE_SIZE) reachedEnd.value = true
  } catch {
    if (reset) loaded.value = []
    reachedEnd.value = true
  } finally {
    pending.value = false
  }
}

await loadPage(true)
watch([activeFilter, categorySlug], () => loadPage(true))

async function loadMore() {
  start.value += PAGE_SIZE
  await loadPage(false)
}

const filteredProducts = computed(() => loaded.value)

const titleName = computed(() => {
  const t = categorySlug.value.replace(/-/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
})

useHead({
  title: `${titleName.value} Inventory | NovelSolar Shop`,
  meta: [
    {
      name: 'description',
      content: `Browse our professional range of ${titleName.value} solar components and systems.`,
    },
  ],
})
</script>

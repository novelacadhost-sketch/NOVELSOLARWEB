<template>
  <div class="pb-20 bg-slate-50 min-h-screen">
    <header class="max-w-7xl mx-auto px-4 md:px-6 pt-8 mb-4">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">Inventory Hub</h1>
      <p class="text-slate-500 text-sm md:text-base">Ready for immediate dispatch.</p>
    </header>

    <div class="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row gap-8">
      <aside class="hidden md:block md:w-64 shrink-0 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
        <div class="space-y-8">
          <div>
            <h3 class="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">Search</h3>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search..."
              class="w-full rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-[#002888]/20 focus:border-[#002888] p-3 outline-none"
            />
          </div>

          <div>
            <h3 class="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">Categories</h3>
            <div class="space-y-3">
              <label class="flex items-center gap-3 cursor-pointer group">
                <input
                  v-model="selectedCategory"
                  type="radio"
                  value="all"
                  class="w-4 h-4 text-[#002888] border-slate-300 focus:ring-[#002888]"
                />
                <span class="text-slate-700 font-medium group-hover:text-[#002888]">All Products</span>
              </label>
              <label v-for="cat in categories" :key="cat.id" class="flex items-center gap-3 cursor-pointer group">
                <input
                  v-model="selectedCategory"
                  type="radio"
                  :value="cat.id"
                  class="w-4 h-4 text-[#002888] border-slate-300 focus:ring-[#002888]"
                />
                <span class="text-slate-700 font-medium group-hover:text-[#002888]">{{ cat.name }}</span>
              </label>
            </div>
          </div>

          <div>
            <h3 class="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider flex justify-between">
              Max Price <span class="text-[#002888]">&#8358;{{ Number(maxPrice).toLocaleString() }}</span>
            </h3>
            <input
              v-model="maxPrice"
              type="range"
              min="0"
              max="2000000"
              step="50000"
              class="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#002888]"
            />
          </div>

          <button
            v-if="isFilterActive"
            class="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors"
            @click="clearFilters"
          >
            Clear Filters
          </button>
        </div>
      </aside>

      <main class="flex-1 min-w-0">
        <div v-if="pending" class="text-center py-24 bg-white rounded-3xl border border-slate-100">
          <span class="material-symbols-outlined text-4xl text-[#002888] animate-pulse">package_2</span>
          <h3 class="font-bold mt-2">Loading inventory...</h3>
        </div>

        <template v-else>
          <div class="md:hidden space-y-10">
            <div v-for="category in categories" :key="category.id">
              <template v-if="getProductsForCategory(category.id).length > 0">
                <div
                  class="flex items-center justify-between mb-4 bg-[#002888] p-4 rounded-2xl shadow-sm border border-[#002888]"
                >
                  <h2 class="text-lg font-bold text-white">{{ category.name }}</h2>
                  <button
                    class="text-sm font-bold text-white flex items-center gap-1 hover:underline"
                    @click="selectCategoryAndScroll(category.id)"
                  >
                    See All <span class="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <ProductCard
                    v-for="product in getProductsForCategory(category.id)"
                    :key="product.ID"
                    :product="product"
                  />
                </div>
              </template>
            </div>
          </div>

          <div class="hidden md:block">
            <div
              class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-slate-200 gap-2"
            >
              <h2 class="text-xl font-bold text-slate-900">
                {{
                  selectedCategory === 'all' ? 'All Inventory' : categories.find((c) => c.id === selectedCategory)?.name
                }}
              </h2>
              <span class="bg-blue-100 text-[#002888] px-3 py-1 rounded-full text-xs font-black self-start sm:self-auto"
                >{{ matchingProducts.length }} Results</span
              >
            </div>

            <div
              v-if="matchingProducts.length === 0"
              class="text-center py-24 bg-white rounded-3xl border border-slate-100"
            >
              <span class="material-symbols-outlined text-6xl text-slate-300">inventory_2</span>
              <h3 class="font-bold mt-2">No products found</h3>
              <p class="text-slate-500 text-sm">Try adjusting your filters or price range.</p>
            </div>

            <template v-else-if="sectionRuns">
              <section v-for="run in sectionRuns" :key="run.name" class="mb-10">
                <h3 class="mb-4 flex items-center gap-3 text-sm font-black uppercase tracking-wider text-slate-500">
                  {{ run.name }}
                  <span class="text-xs font-bold text-slate-400">{{ run.products.length }}</span>
                  <span class="h-px flex-1 bg-slate-200" />
                </h3>
                <div class="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
                  <ProductCard v-for="product in run.products" :key="product.ID" :product="product" />
                </div>
              </section>
            </template>

            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
              <ProductCard v-for="product in displayedProducts" :key="product.ID" :product="product" />
            </div>

            <div v-if="!reachedEnd" class="mt-8 flex justify-center">
              <button
                class="px-8 py-3 bg-white border-2 border-[#002888] text-[#002888] font-bold rounded-xl hover:bg-slate-50 transition-colors"
                @click="loadMore"
              >
                Load More Products
              </button>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { excludeServiceProducts } from '~/utils/productFilters'
import { CATEGORY_GROUPS, groupIdForSection, isExcludedSection, orderSections } from '~/utils/productCategories'
import { watch, computed, ref } from 'vue'

// Index signature deliberate: the /api/inventory response is a union whose
// Bitrix-path member has no section fields, and a type with only optional
// properties would be rejected for having nothing in common with it.
type WithSection = { sectionName?: string | null; section_name?: string | null; [key: string]: unknown }
const sectionOf = (product: WithSection) => product.sectionName || product.section_name || null

/**
 * Categories come from the Bitrix taxonomy via ~/utils/productCategories, and
 * only appear once something is in them — an empty filter is worse than no
 * filter. The seven hardcoded ones here each carried SECTION_ID: null, left
 * over from when the portal's sections were deleted.
 */
// Declared before the loader below, which watches them.
const searchQuery = ref('')
const selectedCategory = ref('all')
const maxPrice = ref(2000000)

const { data: categoryData } = await useFetch('/api/categories')

/**
 * Category list comes from /api/categories — every section in the catalogue with
 * its count — NOT from the products currently loaded. Deriving it from the page
 * meant only sections that happened to fall in the first 50 products appeared,
 * so Charge Controllers, Solar Kits and Electric Mobility were simply missing.
 */
const categories = computed(() => {
  const counts = new Map<string, number>()
  for (const c of categoryData.value?.categories ?? []) {
    const groupId = groupIdForSection(c.name)
    if (!groupId) continue
    counts.set(groupId, (counts.get(groupId) ?? 0) + c.productCount)
  }
  if (counts.size === 0) return CATEGORY_GROUPS
  return CATEGORY_GROUPS.filter((g) => (counts.get(g.id) ?? 0) > 0).map((g) => ({
    ...g,
    count: counts.get(g.id) ?? 0,
  }))
})

const user = useSupabaseUser()

/**
 * Category and search are resolved by the SERVER, and pages accumulate here.
 *
 * This page used to fetch one page of 50 and filter it in memory, so a category
 * showed only the products that happened to land in that page — "Solar Panels"
 * read 1 Result out of 125 — and Load More sliced an array that never grew.
 */
const sectionsParam = computed(() => {
  if (selectedCategory.value === 'all') return ''
  return CATEGORY_GROUPS.find((g) => g.id === selectedCategory.value)?.sections.join(',') ?? ''
})

const start = ref(0)
const loaded = ref([])
const pending = ref(true)
const reachedEnd = ref(false)
const PAGE_SIZE = 50

const toArray = (payload) => {
  if (!payload) return []
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.result)) return payload.result
  if (Array.isArray(payload)) return payload
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
      query: { q: searchQuery.value || undefined, sections: sectionsParam.value || undefined, start: start.value },
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

// Debounced so typing does not fire a request per keystroke.
let searchTimer = null
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadPage(true), 300)
})
watch(selectedCategory, () => loadPage(true))

async function loadMore() {
  start.value += PAGE_SIZE
  await loadPage(false)
}

const getProductsArray = () => loaded.value

/**
 * Category match. The section wins whenever the product has one.
 *
 * The title-keyword branch below is the pre-2026-09-15 behaviour, kept ONLY for
 * products with no section — a brand new Bitrix product before the next sync,
 * or the portal losing its sections again as it already did once. It is wrong
 * by construction ("Solar Kit" matches nothing, "Inverter Generator" matches
 * two) and should not be extended; fix the section in Bitrix instead.
 */
const matchesCategory = (product, categoryId) => {
  if (categoryId === 'all') return true

  const section = sectionOf(product)
  if (section) {
    if (isExcludedSection(section)) return false
    return groupIdForSection(section) === categoryId
  }

  const title = (product.NAME || product.name || '').toLowerCase()
  const isBattery =
    title.includes('battery') || title.includes('lithium') || title.includes('tubular') || title.includes('dry cell')
  const isPanel = title.includes('panel') || title.includes('pv')
  const isInverter = title.includes('inverter') || title.includes('hybrid') || title.includes('generator')
  const isController = title.includes('charge controller') || title.includes('controller')
  const isLighting =
    (title.includes('flood light') ||
      title.includes('streetlight') ||
      title.includes('street light') ||
      title.includes('bulb') ||
      title.includes('light')) &&
    !title.includes('hanger') &&
    !title.includes('kits') &&
    !title.includes('arrestor')
  const isPowerBank = title.includes('power bank') || title.includes('power-bank') || title.includes('powerbank')

  if (categoryId === 'batteries') return isBattery
  if (categoryId === 'solar-panels') return isPanel
  if (categoryId === 'inverters') return isInverter
  if (categoryId === 'charge-controllers') return isController
  if (categoryId === 'lighting') return isLighting
  if (categoryId === 'power-banks') return isPowerBank
  if (categoryId === 'accessories')
    return !isBattery && !isPanel && !isInverter && !isController && !isLighting && !isPowerBank

  return false
}


// Determine if the user is actively using any filters
const isFilterActive = computed(() => {
  return searchQuery.value !== '' || selectedCategory.value !== 'all' || maxPrice.value < 2000000
})

const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = 'all'
  maxPrice.value = 2000000
}

// The "See All" button magic: Applies filter and scrolls top natively
const selectCategoryAndScroll = (catId) => {
  selectedCategory.value = catId
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const matchingProducts = computed(() => {
  // Category and search are already applied by the server. Only the price
  // slider is client-side, and it only narrows what has been loaded so far —
  // the API has no price parameter.
  return getProductsArray().filter((product) => Number(product.PRICE || product.price || 0) <= maxPrice.value)
})

const displayedProducts = computed(() => matchingProducts.value)

/**
 * Products split into their Bitrix sections, for subheadings inside a category.
 *
 * Null when browsing everything, or when a category has only one section —
 * a lone "Solar Panel" heading under "Solar Panels" is noise, so the template
 * falls back to a plain grid.
 */
const sectionRuns = computed(() => {
  if (selectedCategory.value === 'all') return null

  const bySection = new Map()
  for (const product of displayedProducts.value) {
    const name = sectionOf(product)
    if (!name) continue
    if (!bySection.has(name)) bySection.set(name, [])
    bySection.get(name).push(product)
  }
  if (bySection.size < 2) return null

  return orderSections(selectedCategory.value, [...bySection.keys()]).map((name) => ({
    name,
    products: bySection.get(name) ?? [],
  }))
})


const getProductsForCategory = (categoryId) => {
  const products = getProductsArray()
  return products.filter((product) => matchesCategory(product, categoryId)).slice(0, 4)
}

useHead({ title: 'Shop Inventory' })
</script>

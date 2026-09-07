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

            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
              <ProductCard v-for="product in displayedProducts" :key="product.ID" :product="product" />
            </div>

            <div v-if="matchingProducts.length > displayedProducts.length" class="mt-8 flex justify-center">
              <button
                class="px-8 py-3 bg-white border-2 border-[#002888] text-[#002888] font-bold rounded-xl hover:bg-slate-50 transition-colors"
                @click="displayLimit += 50"
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
import { watch, computed, ref } from 'vue'

const categories = [
  { id: 'solar-panels', name: 'Solar Panels', SECTION_ID: null },
  { id: 'inverters', name: 'Inverters', SECTION_ID: null },
  { id: 'batteries', name: 'Batteries', SECTION_ID: null },
  { id: 'charge-controllers', name: 'Charge Controllers', SECTION_ID: null },
  { id: 'lighting', name: 'Lighting', SECTION_ID: null },
  { id: 'power-banks', name: 'Power Banks', SECTION_ID: null },
  { id: 'accessories', name: 'Accessories', SECTION_ID: null },
]

const user = useSupabaseUser()
const { data: apiProducts, pending } = useFetch('/api/inventory', {
  key: `inventory-${user.value?.id || 'guest'}`,
  // Forward the auth cookie so dealers get dealer pricing during SSR.
  headers: useRequestHeaders(['cookie']),
})

const getProductsArray = () => {
  if (!apiProducts.value) return []
  if (Array.isArray(apiProducts.value.data)) return excludeServiceProducts(apiProducts.value.data)
  if (Array.isArray(apiProducts.value.result)) return excludeServiceProducts(apiProducts.value.result)
  if (Array.isArray(apiProducts.value)) return excludeServiceProducts(apiProducts.value)
  return []
}

const matchesCategory = (product, categoryId) => {
  if (categoryId === 'all') return true

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

const searchQuery = ref('')
const selectedCategory = ref('all')
const maxPrice = ref(2000000)
const displayLimit = ref(50)

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
  const products = getProductsArray()
  if (products.length === 0) return []
  return products.filter((product) => {
    const productName = product.NAME || product.name || ''
    const matchesSearch = productName.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategoryFilter = matchesCategory(product, selectedCategory.value)
    const rawPrice = product.PRICE || product.price || 0
    const matchesPrice = Number(rawPrice) <= maxPrice.value
    return matchesSearch && matchesCategoryFilter && matchesPrice
  })
})

const displayedProducts = computed(() => matchingProducts.value.slice(0, displayLimit.value))

watch([searchQuery, selectedCategory, maxPrice], () => {
  displayLimit.value = 50
})

const getProductsForCategory = (categoryId) => {
  const products = getProductsArray()
  return products.filter((product) => matchesCategory(product, categoryId)).slice(0, 4)
}

useHead({ title: 'Shop Inventory' })
</script>

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
        <button
          v-for="filter in filterOptions"
          :key="filter"
          :disabled="categorySlug === 'lighting' && filter !== 'All'"
          :class="[
            'px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border-2',
            activeFilter === filter
              ? 'bg-[#002888] text-white border-[#002888] shadow-md scale-105'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-[#002888] hover:scale-105',
            categorySlug === 'lighting' && filter !== 'All'
              ? 'opacity-40 cursor-not-allowed border-dashed grayscale'
              : '',
          ]"
          @click="categorySlug !== 'lighting' || filter === 'All' ? (activeFilter = filter) : null"
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
const route = useRoute()
const categorySlug = computed(() => (route.params.slug || '').toString())

// Fetch global inventory
const { data: products, pending } = await useFetch('/api/inventory', {
  // Forward the auth cookie so dealers get dealer pricing during SSR.
  headers: useRequestHeaders(['cookie']),
})

const activeFilter = ref('All')

// Dynamic filter options based on the category
const filterOptions = computed(() => {
  const slug = categorySlug.value.toLowerCase()
  if (slug === 'inverters') {
    return ['All', 'Hybrid', 'Regular', 'Solar Generator']
  }
  if (slug === 'batteries') {
    return ['All', 'Lithium', 'Tubular', 'Dry Cell']
  }
  if (slug === 'solar-panels') {
    return ['All', 'Regular', 'Half Cut', 'Bifacial']
  }
  if (slug === 'charge-controllers') {
    return ['All', 'MPPT', 'PWM']
  }
  if (slug === 'lighting') {
    return ['All', 'Flood Light', 'Street Light', 'Bulb']
  }
  if (slug === 'power-banks') {
    return ['All']
  }
  return ['All']
})

// In-Page filtering logic
const filteredProducts = computed(() => {
  if (!products.value) return []

  // Base category logic
  const slug = categorySlug.value.toLowerCase()
  const categoryItems = products.value.filter((p) => {
    const title = (p.NAME || '').toLowerCase()

    const isService =
      title.includes('audit') ||
      title.includes('installation') ||
      title.includes('repair') ||
      title.includes('maintenance')
    if (isService) return false

    const isInverter =
      title.includes('inverter') ||
      title.includes('generator') ||
      title.includes('livoltek') ||
      title.includes('hithium') ||
      title.includes('heroee')
    const isBattery =
      title.includes('battery') || title.includes('lithium') || title.includes('tubular') || title.includes('dry cell')
    const isPanel = title.includes('panel') || title.includes('pv')
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

    if (slug === 'inverters') return isInverter
    if (slug === 'batteries') return isBattery
    if (slug === 'solar-panels') return isPanel
    if (slug === 'charge-controllers') return isController
    if (slug === 'lighting') return isLighting
    if (slug === 'power-banks') return isPowerBank
    if (slug === 'accessories')
      return !isInverter && !isBattery && !isPanel && !isController && !isLighting && !isPowerBank

    return title.includes(slug) || title.includes(slug.replace(/s$/, ''))
  })

  // Apply Sub-filter
  if (activeFilter.value === 'All') return categoryItems

  return categoryItems.filter((p) => {
    const title = (p.NAME || '').toLowerCase()
    const filterTerm = activeFilter.value.toLowerCase()

    if (filterTerm === 'solar generator') {
      return title.includes('generator') || title.includes('hithium') || title.includes('heroee')
    }
    if (filterTerm === 'regular') {
      if (slug === 'solar-panels') {
        return (
          !title.includes('half cut') &&
          !title.includes('half-cut') &&
          !title.includes('halfcut') &&
          !title.includes('bifacial') &&
          !title.includes('bi-facial')
        )
      }
      return !title.includes('hybrid') && !title.includes('generator')
    }
    if (filterTerm === 'half cut') {
      return title.includes('half cut') || title.includes('half-cut') || title.includes('halfcut')
    }
    if (filterTerm === 'bifacial') {
      return title.includes('bifacial') || title.includes('bi-facial')
    }
    if (filterTerm === 'street light') {
      return title.includes('street light') || title.includes('streetlight')
    }
    if (filterTerm === 'pwm' && slug === 'charge-controllers') {
      return !title.includes('mppt')
    }

    return title.includes(filterTerm)
  })
})

// Update standard layout metadata
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

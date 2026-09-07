<script setup lang="ts">
const route = useRoute()
const brand = computed(() => (route.params.brand as string) || 'itel')
const { data: product, pending, error } = await useFetch(`/api/product/${route.params.id}`, {
  // Forward the auth cookie so dealers get dealer pricing during SSR.
  headers: useRequestHeaders(['cookie']),
})

useHead({
  title: `${product.value?.NAME || 'Product'} | ${brand.value.toUpperCase()} Solar Store`,
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 md:px-10">
    <!-- Loading State -->
    <div v-if="pending" class="max-w-7xl mx-auto flex justify-center items-center h-64">
      <div class="animate-pulse bg-white p-8 rounded-2xl shadow-sm w-full grid md:grid-cols-2 gap-12">
        <div class="aspect-square bg-gray-200 rounded-xl" />
        <div class="space-y-6">
          <div class="h-4 bg-gray-200 rounded w-1/4" />
          <div class="h-10 bg-gray-200 rounded w-3/4" />
          <div class="h-8 bg-gray-200 rounded w-1/2" />
          <div class="h-24 bg-gray-200 rounded w-full" />
          <div class="h-12 bg-gray-200 rounded w-full" />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error || !product" class="max-w-7xl mx-auto text-center py-20 bg-white rounded-2xl shadow-sm">
      <span class="material-symbols-outlined text-6xl text-red-400 mb-4">error</span>
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
      <p class="text-gray-600 mb-8">The product you are looking for does not exist or has been removed.</p>
      <NuxtLink
        :to="'/partners/' + brand + '/shop'"
        class="bg-[#002888] text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-900 transition-all"
      >
        Back to Shop
      </NuxtLink>
    </div>

    <!-- Product View -->
    <div v-else class="max-w-7xl mx-auto">
      <div class="grid md:grid-cols-2 gap-12 bg-white p-8 rounded-2xl shadow-sm">
        <!-- Left Column: Image -->
        <div class="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
          <span class="material-symbols-outlined text-6xl text-gray-300">solar_power</span>
        </div>

        <!-- Right Column: Details -->
        <div class="flex flex-col">
          <NuxtLink
            :to="'/partners/' + brand + '/shop'"
            class="text-sm text-gray-500 hover:text-[#002888] mb-4 inline-block"
          >
            &larr; Back to {{ brand.toUpperCase() }} Shop
          </NuxtLink>

          <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{{ product.NAME }}</h1>

          <div class="text-3xl font-black text-[#002888] mb-6">₦{{ Number(product.PRICE).toLocaleString() }}</div>

          <p class="text-slate-600 mb-8 leading-relaxed">
            High-efficiency solar equipment designed for uninterrupted 24/7 power. Includes intelligent battery
            management and seamless indoor integration.
          </p>

          <button
            class="w-full bg-[#002888] text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-900 transition-all shadow-lg flex items-center justify-center gap-2 mb-6"
          >
            <span class="material-symbols-outlined">shopping_cart</span>
            Add to Cart
          </button>

          <!-- Trust Badges -->
          <div class="flex flex-wrap gap-4 text-sm font-medium text-gray-600 border-t pt-6">
            <div class="flex items-center gap-1">
              <span class="material-symbols-outlined text-green-500 text-base">check_circle</span>
              5-Year Warranty
            </div>
            <div class="flex items-center gap-1">
              <span class="material-symbols-outlined text-green-500 text-base">check_circle</span>
              Professional Installation Available
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}
</style>

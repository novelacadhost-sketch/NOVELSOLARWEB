<template>
  <div class="min-h-screen bg-gray-50 p-8 lg:p-12">
    <div class="max-w-7xl mx-auto">
      <header class="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <NuxtLink
            :to="'/partners/' + brand"
            class="inline-flex items-center text-gray-500 hover:text-[#002888] transition-colors mb-4 group text-sm font-medium"
          >
            <span class="mr-2 transform group-hover:-translate-x-1 transition-transform">&larr;</span>
            Back to {{ brand.toUpperCase() }} Overview
          </NuxtLink>
          <h1 class="text-4xl font-extrabold text-[#002888] tracking-tight">
            {{ brand.toUpperCase() }} <span class="text-gray-400 font-light">Solar Shop</span>
          </h1>
          <p class="text-gray-500 mt-2 font-medium">Premium energy solutions curated for you.</p>
        </div>
        <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <img
            loading="lazy"
            :src="brandBanner"
            :alt="brand.toUpperCase() + ' Logo'"
            class="h-8 w-auto object-contain"
          />
          <div class="h-8 w-px bg-gray-200" />
          <span class="text-xs font-black text-gray-400 uppercase tracking-widest"
            >{{ brand.toUpperCase() }} Official Store</span
          >
        </div>
      </header>

      <!-- Loading State -->
      <div v-if="pending" class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-14 h-14 border-4 border-[#002888]/10 border-t-[#002888] rounded-full animate-spin mb-6" />
        <p class="text-xl text-slate-400 font-black tracking-tight italic uppercase">
          Loading {{ brand }} inventory...
        </p>
      </div>

      <!-- Product Grid -->
      <div
        v-else-if="filteredProducts && filteredProducts.length > 0"
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6"
      >
        <ProductCard v-for="product in filteredProducts" :key="product.ID" :product="product" />
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-100 min-h-[400px] flex flex-col items-center justify-center"
      >
        <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
          <svg class="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h3 class="text-2xl font-black text-slate-900 mb-3 uppercase tracking-tighter">Inventory Arriving Soon</h3>
        <p class="text-slate-500 max-w-sm mx-auto font-medium">
          We're currently updating our {{ brand }} shop collection. Check back shortly for the latest smart solar
          bundles.
        </p>
        <NuxtLink to="/products" class="mt-8 text-[#002888] font-bold text-sm hover:underline">
          Browse All Products &rarr;
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { addToast } = useToast()
const route = useRoute()
const brand = computed(() => (route.params.brand as string) || 'itel')

// We still use itel-products as the base, but we filter or adapt if needed
// For now, it stays pointed to itel-products unless we make the API generic
const user = useSupabaseUser()
const { data: partnerProducts, pending } = await useFetch('/api/itel-products', {
  query: { brand: brand.value },
  key: `brand-shop-${brand.value}-${user.value?.id || 'guest'}`,
  // Forward the auth cookie so dealers get dealer pricing during SSR.
  headers: useRequestHeaders(['cookie']),
})

// Dynamic banner logo based on landing page assets
const brandBanner = computed(() => {
  const b = brand.value.toLowerCase()
  if (b === 'itel') return '/images/logo-new-novel.-itel.png'
  if (b === 'livoltek') return '/images/livoltekpartner.png'
  if (b === 'hithium') return '/images/hithium_partner.png'
  if (['haisic', 'yinergy'].includes(b)) {
    // Assets are named like 'Haisic_partner.png'
    return `/images/${brand.value.charAt(0).toUpperCase() + brand.value.slice(1)}_partner.png`
  }
  return '/images/logo.png' // Default fallback
})

// Filter products based on the brand in the URL
const filteredProducts = computed(() => {
  if (!partnerProducts.value) return []
  const currentBrand = brand.value.toLowerCase()
  return partnerProducts.value.filter((p) => p.NAME.toLowerCase().includes(currentBrand))
})

const cart = useState<any[]>('cart', () => [])

const addToCart = (product: any) => {
  cart.value.push(product)
  addToast('Cart', `${product.NAME} added to cart!`, 'success')
}

// SEO
useHead({
  title: `${brand.value.toUpperCase()} Solar Shop | Official Home Energy Store`,
  meta: [
    {
      name: 'description',
      content: `Shop official ${brand.value} inverters, batteries, and smart home energy bundles.`,
    },
  ],
})
</script>

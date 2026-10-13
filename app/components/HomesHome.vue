<template>
  <div>
    <section class="max-w-7xl mx-auto px-4 sm:px-6 pt-6 md:pt-10">
      <div class="relative overflow-hidden rounded-3xl bg-[#1d4f91] text-white px-6 py-12 md:px-14 md:py-20">
        <div class="relative z-10 max-w-xl">
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Novel Homes, Oyo</p>
          <h1 class="mt-4 text-3xl md:text-5xl font-black leading-[1.1] tracking-tight">
            Everything your home runs on, in one place.
          </h1>
          <p class="mt-5 text-base md:text-lg text-white/80 leading-relaxed">
            Freezers, fridges, air conditioners, TVs, fans and voltage stabilizers. Collect from our Oyo or Ibadan store,
            or have it delivered.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink
              to="/shop"
              class="inline-flex items-center gap-2 bg-amber-400 text-[#13294b] font-bold px-6 py-3 rounded-full hover:bg-amber-300"
            >
              Shop all products
              <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
            </NuxtLink>
            <NuxtLink
              to="/category/appliances"
              class="inline-flex items-center gap-2 border border-white/30 font-semibold px-6 py-3 rounded-full hover:bg-white/10"
            >
              Browse appliances
            </NuxtLink>
          </div>
        </div>
        <!-- Decorative only. -->
        <div aria-hidden="true" class="absolute -right-24 -bottom-24 w-[420px] h-[420px] rounded-full bg-white/5" />
        <div aria-hidden="true" class="absolute right-16 top-10 w-40 h-40 rounded-full bg-amber-400/20 hidden md:block" />
        <span
          aria-hidden="true"
          class="material-symbols-outlined absolute right-10 md:right-24 bottom-6 md:bottom-12 text-[140px] md:text-[220px] text-white/10 leading-none"
          >kitchen</span
        >
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 mt-10 md:mt-14" aria-labelledby="categories-heading">
      <h2 id="categories-heading" class="text-xl md:text-2xl font-black text-stone-900">Shop by category</h2>
      <div class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NuxtLink
          v-for="tile in tiles"
          :key="tile.id"
          :to="`/category/${tile.id}`"
          class="group flex items-center gap-4 rounded-2xl bg-white border border-stone-200 p-5 hover:border-[#1d4f91] hover:shadow-lg transition"
        >
          <span class="w-14 h-14 shrink-0 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <span class="material-symbols-outlined text-[30px]">{{ tile.icon }}</span>
          </span>
          <span class="min-w-0">
            <span class="block font-bold text-stone-900 group-hover:text-[#1d4f91]">{{ tile.name }}</span>
            <span class="block text-sm text-stone-500">{{ tile.blurb }}</span>
          </span>
        </NuxtLink>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 mt-12 md:mt-16" aria-labelledby="featured-heading">
      <div class="flex items-end justify-between gap-4">
        <h2 id="featured-heading" class="text-xl md:text-2xl font-black text-stone-900">Popular right now</h2>
        <NuxtLink to="/shop" class="text-sm font-bold text-[#1d4f91] hover:underline shrink-0">See all</NuxtLink>
      </div>
      <div v-if="featured.length" class="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
        <ProductCard v-for="product in featured" :key="product.ID" :product="product" />
      </div>
      <p v-else class="mt-5 rounded-2xl bg-white border border-stone-200 p-8 text-center text-stone-500">
        Our catalogue is loading. <NuxtLink to="/shop" class="font-bold text-[#1d4f91]">Open the shop</NuxtLink>
      </p>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 mt-12 md:mt-16">
      <ul class="grid gap-4 sm:grid-cols-3">
        <li v-for="point in promises" :key="point.title" class="rounded-2xl bg-white border border-stone-200 p-6">
          <span class="material-symbols-outlined text-[#1d4f91] text-[28px]">{{ point.icon }}</span>
          <p class="mt-3 font-bold text-stone-900">{{ point.title }}</p>
          <p class="mt-1 text-sm text-stone-500 leading-relaxed">{{ point.body }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { BitrixProduct } from '~/types'

const tiles = [
  { id: 'appliances', name: 'Home Appliances', blurb: 'Freezers, fridges, ACs, TVs', icon: 'kitchen' },
  { id: 'fans', name: 'Fans', blurb: 'Standing, ceiling and rechargeable', icon: 'mode_fan' },
  { id: 'voltage-stabilizers', name: 'Voltage Stabilizers', blurb: 'Protect what you plug in', icon: 'bolt' },
]

const promises = [
  { icon: 'storefront', title: 'Pick up in store', body: 'Collect from Novel Homes Oyo or our Akinjide electronics store in Ibadan.' },
  { icon: 'local_shipping', title: 'Or have it delivered', body: 'An agent calls you to confirm delivery and its cost.' },
  { icon: 'lock', title: 'Pay securely', body: 'Card or transfer through Paystack, or pay when you collect.' },
]

// Pictured products first: a grid of placeholders sells nothing. The server
// limits this site to its own sections, so no filter is needed here.
const requestHeaders = useRequestHeaders(['cookie'])
const { data } = await useAsyncData('homes-featured', () =>
  $fetch<BitrixProduct[]>('/api/inventory', { headers: requestHeaders }).catch(() => [] as BitrixProduct[]),
)

const featured = computed(() => {
  const products = Array.isArray(data.value) ? data.value : []
  const pictured = products.filter((p) => p.imageUrl)
  return [...pictured, ...products.filter((p) => !p.imageUrl)].slice(0, 8)
})

</script>

<template>
  <div class="bg-white font-sans text-slate-900 border-t-4 border-[#0068B7]">
    <!-- Partnership banner -->
    <div class="w-full bg-white py-6 md:py-10 border-b border-slate-100 flex items-center justify-center overflow-hidden">
      <img
        :src="image('/images/powerchina_partner.jpg')"
        alt="Novel Solar x PowerChina Partnership"
        class="h-16 md:h-28 w-auto max-w-full object-contain px-4"
      />
    </div>

    <!-- Hero -->
    <section class="relative bg-[#00244f] text-white overflow-hidden py-20 lg:py-28">
      <div class="absolute inset-0 opacity-20 pointer-events-none">
        <div class="absolute -top-24 -left-24 w-96 h-96 bg-[#C8235A] rounded-full blur-3xl" />
        <div class="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] bg-[#0068B7] rounded-full blur-3xl" />
      </div>

      <div class="relative max-w-7xl mx-auto px-6 lg:px-8 text-center flex flex-col items-center z-10">
        <span class="text-xs md:text-sm font-black uppercase tracking-[0.25em] text-[#7cc4ff] mb-6">
          Lithium storage &amp; hybrid inverters
        </span>
        <h1 class="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
          Reliable Solar Power <br />
          <span class="text-[#7cc4ff]">from PowerChina.</span>
        </h1>
        <p class="text-lg md:text-xl text-slate-200 max-w-3xl mx-auto font-medium mb-10 leading-relaxed">
          48V LiFePO4 lithium batteries and a parallel-capable hybrid inverter, sold, installed and supported by Novel
          Solar across Nigeria.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <a
            href="#powerchina-range"
            class="bg-white text-[#00244f] px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-2xl flex items-center justify-center gap-2"
          >
            See the range
            <span class="material-symbols-outlined">expand_more</span>
          </a>
          <NuxtLink
            to="/quote"
            class="border-2 border-white/70 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            Get a quote
            <span class="material-symbols-outlined">request_quote</span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- What's in the range -->
    <section class="py-16 md:py-20 bg-slate-50 border-b border-slate-100">
      <div class="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div v-for="point in HIGHLIGHTS" :key="point.title" class="bg-white rounded-3xl border border-slate-100 p-8">
          <span class="material-symbols-outlined text-4xl text-[#0068B7] mb-4 block">{{ point.icon }}</span>
          <h3 class="text-xl font-black text-slate-900 mb-2">{{ point.title }}</h3>
          <p class="text-slate-600 font-medium leading-relaxed">{{ point.text }}</p>
        </div>
      </div>
    </section>

    <!-- Live products: names, prices and stock come from the catalogue -->
    <section id="powerchina-range" class="py-20 md:py-24 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <span class="text-sm font-black text-[#C8235A] uppercase tracking-[0.2em] mb-3 block">Shop PowerChina</span>
            <h2 class="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">The PowerChina range</h2>
          </div>
          <NuxtLink
            to="/partners/powerchina/shop"
            class="inline-flex items-center gap-2 text-[#0068B7] font-black uppercase tracking-widest text-sm hover:underline"
          >
            View all
            <span class="material-symbols-outlined text-base">arrow_forward</span>
          </NuxtLink>
        </div>

        <div v-if="pending" class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div v-for="n in 4" :key="n" class="h-72 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
        <div v-else-if="products.length" class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <ProductCard v-for="product in products" :key="product.ID" :product="product" />
        </div>
        <p v-else class="text-slate-500 font-medium">
          PowerChina products are being restocked. Call us or request a quote and we will find you the right setup.
        </p>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="py-16 md:py-20 bg-slate-50 border-t border-slate-200">
      <div class="max-w-4xl mx-auto px-6 text-center">
        <p class="text-base md:text-lg text-slate-500 font-medium mb-8 leading-relaxed uppercase tracking-widest">
          Not sure which battery or inverter size you need?
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <NuxtLink
            to="/calculator"
            class="inline-flex items-center justify-center gap-3 bg-[#0068B7] text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-[#00244f] transition-all shadow-xl"
          >
            Size my system
            <span class="material-symbols-outlined">calculate</span>
          </NuxtLink>
          <NuxtLink
            to="/contact"
            class="inline-flex items-center justify-center gap-3 bg-white border-2 border-slate-900 text-slate-900 px-10 py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-xl"
          >
            Talk to an expert
            <span class="material-symbols-outlined">call</span>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { BitrixProduct } from '~/types'

const HIGHLIGHTS = [
  {
    icon: 'battery_charging_full',
    title: 'LiFePO4 lithium batteries',
    text: '5kWh, 10kWh and 16kWh at 48V, each with a built-in battery management system for deep-cycle home and business backup.',
  },
  {
    icon: 'electrical_services',
    title: '5kW hybrid inverter',
    text: 'Pure sine wave output with a built-in MPPT solar charge controller, and it can run in parallel as your load grows.',
  },
  {
    icon: 'support_agent',
    title: 'Backed by Novel Solar',
    text: 'Buy online or from any of our branches, with installation and after-sales support from our own engineers.',
  },
]

// Images on this page can be replaced from /admin/manage-pages.
const { image } = await usePageContent('partners/powerchina')

const requestHeaders = useRequestHeaders(['cookie'])
const { data, pending } = await useFetch<BitrixProduct[]>('/api/inventory', {
  key: 'partner-powerchina-products',
  query: { q: 'powerchina' },
  headers: requestHeaders,
})
// Pictured products first, so the row does not open on a placeholder.
const { getProductImage } = useProductImage()
const hasImage = (p: BitrixProduct) => getProductImage(p) !== '/images/placeholder.png'
const products = computed(() => {
  const list = data.value ?? []
  return [...list.filter(hasImage), ...list.filter((p) => !hasImage(p))].slice(0, 8)
})

useHead({
  title: 'PowerChina Lithium Batteries & Hybrid Inverters | NovelSolar Partner',
  meta: [
    {
      name: 'description',
      content:
        'Buy PowerChina 48V LiFePO4 lithium batteries (5kWh, 10kWh, 16kWh) and the 5kW parallel hybrid inverter from Novel Solar, with installation across Nigeria.',
    },
  ],
})
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 1,
    'wght' 700,
    'GRAD' 0,
    'opsz' 48;
}
</style>

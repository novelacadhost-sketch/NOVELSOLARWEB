<template>
  <div class="bg-white font-sans text-slate-900 border-t-4 border-[#0068B7]">
    <!-- Partnership banner -->
    <div class="w-full bg-white py-6 md:py-10 border-b border-slate-100 flex items-center justify-center overflow-hidden">
      <img
        :src="image('/images/powerchina_partner.jpg')"
        alt="Novel Solar x PowerChina Partnership"
        class="h-16 md:h-28 w-auto max-w-full object-contain px-4"
      >
    </div>

    <!-- Hero -->
    <section class="relative bg-[#00244f] text-white overflow-hidden py-20 lg:py-28">
      <div class="absolute inset-0 opacity-20 pointer-events-none">
        <div class="absolute -top-24 -left-24 w-96 h-96 bg-[#C8235A] rounded-full blur-3xl" />
        <div class="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] bg-[#0068B7] rounded-full blur-3xl" />
      </div>

      <div class="relative max-w-7xl mx-auto px-6 lg:px-8 text-center flex flex-col items-center z-10">
        <span class="text-xs md:text-sm font-black uppercase tracking-[0.25em] text-[#7cc4ff] mb-6">
          Official Partnership
        </span>
        <h1 class="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
          PowerChina Solar System <br >
          <span class="text-[#7cc4ff]">One System. Complete Energy Solution.</span>
        </h1>
        <p class="text-lg md:text-xl text-slate-200 max-w-3xl mx-auto font-medium mb-8 leading-relaxed">
          Combine PowerChina inverters with PowerChina lithium batteries for a unified, intelligent solar system that
          captures excess day energy and provides uninterrupted power during grid outages.
        </p>
        <div class="max-w-2xl mx-auto mb-10 rounded-2xl bg-white/10 border border-white/20 px-6 py-5">
          <p class="text-lg md:text-xl font-black mb-1">Sun dey shine, make your power dey work! ☀️</p>
          <p class="text-slate-200 font-medium">
            With PowerChina Inverter + Lithium Battery + Solar Panels, you fit reduce your dependence on NEPA and
            generator.
          </p>
          <p class="text-[#7cc4ff] font-bold mt-2">Use solar. Store power. Enjoy better backup.</p>
        </div>
        <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <a
            href="#powerchina-range"
            class="bg-white text-[#00244f] px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-2xl flex items-center justify-center gap-2"
          >
            Shop PowerChina
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

    <!-- The partnership -->
    <section class="py-20 md:py-24 bg-white">
      <div class="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <figure>
          <img
            loading="lazy"
            :src="image('/images/powerchina_mou_signing.jpg')"
            alt="Sammi Zhou of PowerChina I²-ESS and Dahunsi Adewale of Novel Solar signing the partnership agreement"
            class="w-full h-auto rounded-3xl shadow-xl"
          >
          <figcaption class="text-sm text-slate-500 font-medium mt-3">
            Signing at the Nigeria Energy Exhibition and Conference, Lagos.
          </figcaption>
        </figure>
        <div>
          <span class="text-sm font-black text-[#C8235A] uppercase tracking-[0.2em] mb-3 block">
            An Official Partnership
          </span>
          <h2 class="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">
            Representing PowerChina in Nigeria
          </h2>
          <p class="text-lg text-slate-600 font-medium leading-relaxed mb-6">
            The partnership was signed by <strong class="text-slate-900">Sammi Zhou</strong>, Global Director of
            PowerChina I²-ESS, and <strong class="text-slate-900">Dahunsi Adewale</strong>, CEO of Novel Solar, at the
            Nigeria Energy Exhibition and Conference in Lagos.
          </p>
          <a
            href="https://punchng.com/powerchina-partners-nigerian-firm-on-affordable-solar-solutions/"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 text-[#0068B7] font-black uppercase tracking-widest text-sm hover:underline mb-10"
          >
            Read the article in Punch
            <span class="material-symbols-outlined text-base">open_in_new</span>
          </a>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div v-for="point in PARTNERSHIP" :key="point.title" class="bg-slate-50 rounded-2xl border border-slate-100 p-5">
              <span class="material-symbols-outlined text-3xl text-[#0068B7] mb-2 block">{{ point.icon }}</span>
              <h3 class="font-black text-slate-900 mb-1">{{ point.title }}</h3>
              <p class="text-sm text-slate-600 font-medium leading-relaxed">{{ point.text }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CEO quote -->
    <section class="py-16 md:py-20 bg-[#00244f] text-white">
      <blockquote class="max-w-4xl mx-auto px-6 text-center">
        <p class="text-2xl md:text-4xl font-black leading-snug tracking-tight">
          &ldquo;We want Nigerians to have access to reliable solar equipment, products that are durable and
          cost-efficient.&rdquo;
        </p>
        <footer class="mt-6 text-[#7cc4ff] font-bold uppercase tracking-widest text-sm">
          Dahunsi Adewale &mdash; Chief Executive Officer, Novel Solar
        </footer>
      </blockquote>
    </section>

    <!-- Inverter and battery -->
    <section class="py-20 md:py-24 bg-slate-50 border-b border-slate-100">
      <div class="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div v-for="line in PRODUCT_LINES" :key="line.title" class="bg-white rounded-3xl border border-slate-100 p-8 md:p-10">
          <span class="material-symbols-outlined text-4xl text-[#0068B7] mb-4 block">{{ line.icon }}</span>
          <h3 class="text-2xl md:text-3xl font-black text-slate-900 mb-1">{{ line.title }}</h3>
          <p class="text-[#C8235A] font-black uppercase tracking-widest text-sm mb-4">{{ line.tagline }}</p>
          <p class="text-slate-600 font-medium leading-relaxed">{{ line.text }}</p>
        </div>
      </div>
    </section>

    <!-- Storage sizes -->
    <section class="py-20 md:py-24 bg-white">
      <div class="max-w-7xl mx-auto px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-3">Choose Your Storage Capacity</h2>
          <p class="text-lg text-slate-500 font-medium">Scale the system to match your home or business load.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <NuxtLink
            v-for="size in STORAGE_SIZES"
            :key="size.productId"
            :to="`/shop/${size.productId}`"
            class="group bg-slate-50 rounded-3xl border border-slate-100 p-8 flex flex-col sm:flex-row items-center gap-8 hover:shadow-2xl hover:border-[#0068B7]/30 transition-all"
          >
            <img
              loading="lazy"
              :src="image(size.image)"
              :alt="size.title"
              class="w-40 h-auto object-contain group-hover:scale-105 transition-transform duration-500"
            >
            <div class="text-center sm:text-left">
              <span class="text-4xl font-black text-[#0068B7]">{{ size.capacity }}</span>
              <h3 class="text-xl font-black text-slate-900 mt-1 mb-2">{{ size.title }}</h3>
              <p class="text-slate-600 font-medium leading-relaxed mb-4">{{ size.text }}</p>
              <span class="inline-flex items-center gap-2 text-[#0068B7] font-black uppercase tracking-widest text-sm">
                View product
                <span class="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform"
                  >arrow_forward</span
                >
              </span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Live products: names, prices and stock come from the catalogue -->
    <section id="powerchina-range" class="py-20 md:py-24 bg-slate-50 border-t border-slate-100">
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
    <section class="py-16 md:py-20 bg-white border-t border-slate-200">
      <div class="max-w-4xl mx-auto px-6 text-center">
        <h2 class="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">
          Powering a Smarter, More Reliable Energy Future
        </h2>
        <p class="text-lg text-slate-500 font-medium mb-10 leading-relaxed">
          Hybrid inverters, lithium batteries and complete solar systems. Not sure what size you need? Let us help.
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

const PARTNERSHIP = [
  {
    icon: 'handshake',
    title: 'Official distributor',
    text: 'Under a signed Memorandum of Understanding, Novel Solar distributes PowerChina I²-ESS products to end users nationwide.',
  },
  {
    icon: 'factory',
    title: 'EPC & OEM manufacturing',
    text: 'PowerChina I²-ESS is a government-backed engineering, procurement and construction group and original equipment manufacturer.',
  },
  {
    icon: 'domain',
    title: 'Homes to industrial scale',
    text: 'Beyond residential: commercial and industrial systems, mini-grids and other large-scale installations.',
  },
]

const PRODUCT_LINES = [
  {
    icon: 'electrical_services',
    title: 'PowerChina Hybrid Inverter',
    tagline: 'Reliable Power. Smarter Energy.',
    text: 'Seamless, high-efficiency power management across homes, offices and commercial spaces, built to integrate solar, battery storage and grid inputs for dependable energy on demand.',
  },
  {
    icon: 'battery_charging_full',
    title: 'PowerChina Lithium Battery',
    tagline: 'Store More. Power Longer.',
    text: 'Engineered with intelligent battery management, PowerChina lithium batteries offer high-efficiency storage with extended cycle life for solar and backup use.',
  },
]

// Product ids are the Bitrix catalogue ids; prices are not repeated here so
// they can never disagree with the shop.
const STORAGE_SIZES = [
  {
    productId: '19874',
    capacity: '10 kWh',
    title: 'PowerChina 10kWh Lithium Battery',
    text: 'Wall-mounted LiFePO4 storage sized for homes and small offices that need dependable overnight backup.',
    image: '/images/powerchina_10kwh.webp',
  },
  {
    productId: '19892',
    capacity: '16 kWh',
    title: 'PowerChina 16kWh Lithium Battery',
    text: 'Floor-standing, mobile storage for larger homes and commercial loads that run longer and draw harder.',
    image: '/images/powerchina_16kwh.webp',
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
  title: 'PowerChina Solar Systems | Official NovelSolar Partner',
  meta: [
    {
      name: 'description',
      content:
        'Novel Solar is the official distributor of PowerChina I²-ESS products in Nigeria. Buy PowerChina hybrid inverters and 48V lithium batteries with installation nationwide.',
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

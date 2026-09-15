<script setup lang="ts">
import { ref } from 'vue'

// Images on this page can be replaced from /admin/manage-pages. The paths
// below are the originals and stay as the fallback if nothing is set.
const { image } = await usePageContent('partners/livoltek')

const products = [
  {
    id: 'hybrid',
    name: 'Complete Hybrid Systems',
    desc: 'The ultimate solar kit featuring Livoltek hybrid inverters, tier-1 panels, and smart monitoring. Perfect for achieving total energy independence while staying grid-connected.',
    image: image('/images/livoltek1.png'),
    features: ['Dual MPPT Tracking', 'Seamless Grid Switching', 'IP65 Rated Protection'],
    specsUrl: 'https://ng.livoltek.com/product/hybrid-inverter-single-phase-3-6kw/',
  },
  {
    id: 'storage',
    name: 'All-In-One Storage',
    desc: 'Sleek, stackable lithium battery systems designed for modern homes. Maximum safety meets minimalist design.',
    image: image('/images/livoltek2.jpg'),
    features: ['Safe LiFePO4 Chemistry', 'Plug & Play Expansion', 'Space-Saving Vertical Design'],
    specsUrl: 'https://www.livoltek.com/product/hyrid-all-in-one-ess-3-6kw/',
  },
  {
    id: 'offgrid',
    name: 'Off-Grid Inverters',
    desc: 'Robust 3.5kW to 6.2kW off-grid solutions built specifically to withstand heavy loads and unstable local grids.',
    image: image('/images/livoltek3.png'),
    features: ['High Surge Capacity', 'Generator Compatible', 'Built-in MPPT Charge Controller'],
    specsUrl: 'https://ng.livoltek.com/product/off-grid-inverter-3-5-6-2kw/',
  },
]

const activeProduct = ref(products[0])
</script>

<template>
  <div class="bg-white font-sans text-slate-900 border-t-4 border-[#00164d]">
    <!-- Header Banner -->
    <div
      class="w-full bg-white py-8 md:py-12 border-b border-slate-100 flex items-center justify-center overflow-hidden"
    >
      <img
        loading="lazy"
        :src="image('/images/livoltekpartner.png')"
        alt="Novel Solar x Livoltek Partnership"
        class="h-12 md:h-20 object-contain px-4"
      />
    </div>

    <!-- Hero Section -->
    <section class="relative bg-[#00164d] text-white overflow-hidden py-20 lg:py-28">
      <div
        class="absolute inset-0 opacity-10"
        style="background-image: radial-gradient(#ffffff 1px, transparent 1px); background-size: 32px 32px"
      />

      <div class="relative max-w-7xl mx-auto px-6 lg:px-8 text-center flex flex-col items-center z-10">
        <h1 class="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight">
          Global Engineering. <br />
          <span class="text-[#00AEEF]">Nigerian Reliability.</span>
        </h1>

        <p class="mt-4 text-xl text-slate-300 max-w-2xl mx-auto font-medium mb-12 leading-relaxed">
          We deliver the full spectrum of Livoltek's residential and commercial power solutions—engineered for extreme
          efficiency and backed by local, on-the-ground Novel Solar support.
        </p>

        <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <NuxtLink
            to="/quote"
            class="bg-[#00AEEF] hover:bg-cyan-400 text-[#00164d] px-8 py-4 rounded-sm font-black uppercase tracking-widest transition-all duration-300 transform hover:-translate-y-1 shadow-[0_0_20px_rgba(0,174,239,0.3)] inline-flex items-center justify-center"
          >
            Request a Quote
          </NuxtLink>
          <NuxtLink
            to="/partners/livoltek/shop"
            class="bg-transparent border-2 border-slate-500 hover:border-white text-white px-8 py-4 rounded-sm font-bold uppercase tracking-widest transition-all duration-300 inline-flex items-center justify-center"
          >
            Explore Catalog
          </NuxtLink>
        </div>
      </div>

      <div class="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50 to-transparent z-0" />
    </section>

    <!-- Bento Grid Section -->
    <section class="py-24 bg-slate-50">
      <div class="max-w-7xl mx-auto px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl md:text-4xl font-black text-[#002888] uppercase tracking-tight mb-4">
            Built for Uncompromising Performance
          </h2>
          <p class="text-slate-500 max-w-2xl mx-auto text-lg">
            Livoltek hardware is designed to thrive in challenging grid environments, ensuring your power never drops.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]">
          <div
            class="md:col-span-2 bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-center relative overflow-hidden group"
          >
            <div class="relative z-10 max-w-[65%]">
              <h3 class="text-2xl font-black text-slate-900 mb-3">Smart App Monitoring</h3>
              <p class="text-slate-500 font-medium leading-relaxed">
                Track your solar yield, battery health, and load consumption in real-time from anywhere in the world
                using the Livoltek smart platform.
              </p>
            </div>
            <div
              class="absolute -right-8 -bottom-12 w-72 h-80 bg-slate-100 rounded-3xl border-8 border-white shadow-2xl transform rotate-12 group-hover:rotate-6 transition-transform duration-700 flex items-start justify-center pt-8"
            >
              <div class="w-1/2 h-4 bg-slate-200 rounded-full" />
            </div>
          </div>

          <div
            class="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group hover:border-[#00AEEF]"
          >
            <div
              class="w-14 h-14 bg-cyan-50 text-[#00AEEF] rounded-xl flex items-center justify-center mb-4 transition-colors group-hover:bg-[#00AEEF] group-hover:text-white"
            >
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-black text-slate-900 mb-2">10-Year Warranty</h3>
              <p class="text-sm text-slate-500 font-medium leading-relaxed">
                Factory-backed protection managed directly through Novel Solar's local support team.
              </p>
            </div>
          </div>

          <div
            class="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group hover:border-[#00AEEF]"
          >
            <div
              class="w-14 h-14 bg-cyan-50 text-[#00AEEF] rounded-xl flex items-center justify-center mb-4 transition-colors group-hover:bg-[#00AEEF] group-hover:text-white"
            >
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-black text-slate-900 mb-2">UPS-Level Switching</h3>
              <p class="text-sm text-slate-500 font-medium leading-relaxed">
                Ultra-fast 10ms switchover time. Your sensitive electronics won't even notice the grid failed.
              </p>
            </div>
          </div>

          <div
            class="md:col-span-2 bg-[#00164d] rounded-2xl p-8 border border-[#002888] shadow-sm flex flex-col justify-center relative overflow-hidden group hover:shadow-xl transition-all duration-300"
          >
            <div class="relative z-10">
              <h3 class="text-3xl font-black text-white mb-3">Extreme Temperature Tolerance</h3>
              <p class="text-[#00AEEF] font-bold text-lg">Flawless, derate-free operation up to 60°C ambient.</p>
            </div>
            <div
              class="absolute right-0 top-0 bottom-0 w-2/3 bg-gradient-to-l from-[#002888] to-transparent flex items-center justify-end pr-12 opacity-50 group-hover:opacity-100 transition-opacity duration-500"
            >
              <div class="w-32 h-32 rounded-full border-8 border-[#00AEEF] border-t-transparent animate-spin-slow" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive Product Showcase -->
    <section class="py-24 bg-white border-t border-slate-100">
      <div class="max-w-7xl mx-auto px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div class="lg:col-span-4 flex flex-col space-y-4">
            <h2 class="text-sm font-black text-[#00AEEF] uppercase tracking-widest mb-4">Official Product Lines</h2>

            <button
              v-for="product in products"
              :key="product.id"
              :class="[
                'text-left px-6 py-5 rounded-xl font-black text-xl md:text-2xl transition-all duration-300 border-2',
                activeProduct.id === product.id
                  ? 'bg-[#00164d] text-white border-[#00164d] shadow-lg translate-x-2'
                  : 'bg-white text-slate-400 border-transparent hover:border-slate-200 hover:text-slate-900',
              ]"
              @click="activeProduct = product"
            >
              {{ product.name }}
            </button>
          </div>

          <div
            class="lg:col-span-8 bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200 min-h-[500px] flex flex-col md:row items-center gap-8 relative overflow-hidden transition-all duration-500"
          >
            <div class="w-full md:w-1/2 z-10 text-center md:text-left">
              <h3 class="text-3xl font-black text-slate-900 mb-4">{{ activeProduct.name }}</h3>
              <p class="text-slate-600 font-medium mb-8 leading-relaxed">{{ activeProduct.desc }}</p>

              <ul class="space-y-3 mb-8">
                <li
                  v-for="feature in activeProduct.features"
                  :key="feature"
                  class="flex items-center gap-3 text-sm font-bold text-slate-700"
                >
                  <div
                    class="w-6 h-6 rounded-full bg-cyan-100 text-[#00AEEF] flex items-center justify-center shrink-0"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  {{ feature }}
                </li>
              </ul>

              <a
                :href="activeProduct.specsUrl"
                target="_blank"
                class="text-[#002888] font-black uppercase tracking-widest text-sm hover:text-[#00AEEF] transition-colors flex items-center gap-2"
              >
                View Technical Specs <span class="text-lg">&rarr;</span>
              </a>
            </div>

            <div class="w-full md:w-1/2 flex justify-center z-10">
              <img
                :key="activeProduct.id"
                loading="lazy"
                :src="activeProduct.image"
                :alt="activeProduct.name"
                class="max-h-[350px] object-contain drop-shadow-2xl transition-all duration-500 hover:scale-105"
              />
            </div>

            <div
              class="absolute -bottom-24 -right-24 w-96 h-96 bg-white rounded-full opacity-50 blur-3xl pointer-events-none"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Check Livoltek Inventory CTA -->
    <section class="py-16 bg-slate-50 border-y border-slate-200">
      <div class="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h2 class="text-3xl font-black text-slate-900 mb-2">Ready to Upgrade?</h2>
          <p class="text-slate-600 font-medium tracking-tight">
            Browse our current real-time inventory for Livoltek solutions.
          </p>
        </div>
        <NuxtLink
          to="/partners/livoltek/shop"
          class="bg-[#002888] text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-blue-900 transition-all shadow-2xl active:scale-95 uppercase tracking-tight inline-flex items-center gap-3 group"
        >
          Check Livoltek Inventory
          <span class="text-xl group-hover:translate-x-2 transition-transform">&rarr;</span>
        </NuxtLink>
      </div>
    </section>

    <!-- Lifestyle CTA -->
    <section class="relative py-32 overflow-hidden">
      <div class="absolute inset-0 z-0">
        <img
          loading="lazy"
          :src="image('/images/livoltek_family.png')"
          alt="Nigerian Family with Solar"
          class="w-full h-full object-cover object-center"
        />
        <div class="absolute inset-0 bg-[#00164d]/90 mix-blend-multiply" />
      </div>

      <div class="relative z-10 max-w-4xl mx-auto px-6 text-center text-white">
        <h2 class="text-4xl md:text-5xl font-black tracking-tight mb-6">Power Your Home. Protect Your Peace.</h2>
        <p class="text-xl text-slate-300 font-medium mb-10 leading-relaxed max-w-2xl mx-auto">
          Don't let grid instability dictate your day. As an authorized partner, Novel Solar provides guaranteed genuine
          Livoltek hardware, expert installation, and immediate local warranty support.
        </p>

        <div class="flex flex-col sm:flex-row justify-center gap-4">
          <NuxtLink
            to="/quote"
            class="bg-[#00AEEF] hover:bg-cyan-400 text-[#00164d] px-10 py-5 rounded-sm font-black uppercase tracking-widest transition-all duration-300 transform hover:-translate-y-1 inline-flex items-center justify-center"
          >
            Get a Custom Quote
          </NuxtLink>
          <NuxtLink
            to="/contact"
            class="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white px-10 py-5 rounded-sm font-bold uppercase tracking-widest transition-all duration-300 inline-flex items-center justify-center"
          >
            Contact Support
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.animate-spin-slow {
  animation: spin 8s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

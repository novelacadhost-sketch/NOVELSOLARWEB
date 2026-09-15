<template>
  <div class="bg-white font-sans text-slate-900 border-t-4 border-[#00AEEF]">
    <!-- Top Banner -->
    <div
      class="w-full bg-white py-8 md:py-12 border-b border-slate-100 flex items-center justify-center overflow-hidden"
    >
      <img
        loading="lazy"
        :src="image('/images/hithium_partner.png')"
        alt="Novel Solar x Hithium Partnership"
        class="h-12 md:h-20 object-contain px-4"
      />
    </div>

    <!-- Hero Section -->
    <section class="relative bg-slate-900 text-white overflow-hidden py-24 lg:py-32">
      <!-- Decorative Background -->
      <div class="absolute inset-0 z-0 scale-110 blur-sm opacity-40">
        <img
          loading="lazy"
          :src="image('/images/hithium_hero.png')"
          alt="Hithium Energy Storage Facility"
          class="w-full h-full object-cover"
        />
      </div>
      <div class="absolute inset-0 bg-gradient-to-br from-[#00AEEF]/20 to-slate-900/90 z-1" />

      <div class="relative max-w-7xl mx-auto px-6 lg:px-8 text-center flex flex-col items-center z-10">
        <h1 class="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight animate-fadeIn">
          Portable Solar Freedom <br />
          <span class="text-[#00AEEF]">Powered by Hithium.</span>
        </h1>

        <p class="mt-4 text-xl md:text-2xl text-slate-200 max-w-3xl mx-auto font-medium mb-12 leading-relaxed">
          The ultimate portable energy solutions for Nigerian homes and professionals. Robust, fast-charging, and built
          for a decade of reliability.
        </p>

        <div class="flex flex-col sm:flex-row gap-6 w-full sm:w-auto">
          <a
            href="#featured-products"
            class="bg-[#00AEEF] hover:bg-cyan-400 text-slate-900 px-10 py-5 rounded-2xl font-black uppercase tracking-widest transition-all duration-300 transform hover:-translate-y-1 shadow-2xl flex items-center justify-center gap-2"
          >
            View Featured Generators
            <span class="material-symbols-outlined font-black">expand_more</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Detailed Product Showcase -->
    <section id="featured-products" class="py-24 bg-white overflow-hidden">
      <div class="max-w-7xl mx-auto px-6 lg:px-8">
        <!-- Product 1: 1kWh Generator -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32 group">
          <div class="order-2 lg:order-1">
            <span class="text-sm font-black text-[#00AEEF] uppercase tracking-[0.2em] mb-4 block"
              >Ultra-Portable Power</span
            >
            <h2
              class="text-4xl md:text-5xl font-black text-slate-900 mb-6 leading-tight uppercase tracking-tighter italic"
            >
              Hithium 1kWh Solar Generator
            </h2>
            <p class="text-lg text-slate-600 font-medium leading-relaxed mb-8">
              Compact, lightweight, and incredibly powerful. Perfect for apartment balconies, camping, and powering
              workstations during grid outages.
            </p>
            <ul class="space-y-4 mb-10">
              <li class="flex items-center gap-3 text-slate-800 font-bold">
                <span class="material-symbols-outlined text-[#00AEEF]">bolt</span>
                1kWh Capacity with 1000W Output
              </li>
              <li class="flex items-center gap-3 text-slate-800 font-bold">
                <span class="material-symbols-outlined text-[#00AEEF]">timer</span>
                Ultra-Fast AC Charging (0-80% in 1 Hour)
              </li>
              <li class="flex items-center gap-3 text-slate-800 font-bold">
                <span class="material-symbols-outlined text-[#00AEEF]">battery_vert_4</span>
                EV-Grade LFP Cells (10,000+ Cycle Life)
              </li>
            </ul>
            <NuxtLink
              to="/partners/hithium/shop"
              class="inline-flex items-center gap-3 bg-[#00164d] text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-[#002888] hover:shadow-2xl hover:-translate-y-1 transition-all shadow-xl"
            >
              Buy It Now
              <span class="material-symbols-outlined">shopping_cart</span>
            </NuxtLink>
          </div>
          <div class="order-1 lg:order-2 p-8 relative">
            <div
              class="absolute inset-0 bg-slate-50 rounded-[50px] scale-95 group-hover:bg-cyan-50 transition-colors"
            />
            <img
              loading="lazy"
              :src="image('/images/Hithium3.png')"
              alt="Hithium 1kWh Solar Generator"
              class="relative w-full h-auto object-contain z-10 group-hover:scale-105 transition-transform duration-700 drop-shadow-2xl"
            />
          </div>
        </div>

        <!-- Product 2: Heroee 2 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center group">
          <div class="p-8 relative">
            <div
              class="absolute inset-0 bg-slate-50 rounded-[50px] scale-95 group-hover:bg-blue-50 transition-colors"
            />
            <img
              loading="lazy"
              :src="image('/images/Hithium1.jpg')"
              alt="Hithium Heroee 2 Solar Generator"
              class="relative w-full h-auto object-contain z-10 group-hover:scale-105 transition-transform duration-700 drop-shadow-2xl"
            />
          </div>
          <div>
            <span class="text-sm font-black text-blue-600 uppercase tracking-[0.2em] mb-4 block"
              >High-Capacity Workhorse</span
            >
            <h2
              class="text-4xl md:text-5xl font-black text-slate-900 mb-6 leading-tight uppercase tracking-tighter italic"
            >
              Hithium Heroee 2 Solar Generator
            </h2>
            <p class="text-lg text-slate-600 font-medium leading-relaxed mb-8">
              Our flagship portable powerhouse. Built for high-load appliances, multiple workstations, and true energy
              independence during prolonged blackouts.
            </p>
            <ul class="space-y-4 mb-10">
              <li class="flex items-center gap-3 text-slate-800 font-bold">
                <span class="material-symbols-outlined text-blue-600">electric_moped</span>
                Expanded Capacity for Heavy-Duty Usage
              </li>
              <li class="flex items-center gap-3 text-slate-800 font-bold">
                <span class="material-symbols-outlined text-blue-600">shield</span>
                Multi-Layer Fireproof Protection Structure
              </li>
              <li class="flex items-center gap-3 text-slate-800 font-bold">
                <span class="material-symbols-outlined text-blue-600">router</span>
                Uninterruptible Power Supply (UPS) Functionality
              </li>
            </ul>
            <NuxtLink
              to="/partners/hithium/shop"
              class="inline-flex items-center gap-3 bg-[#00AEEF] text-[#00164d] px-10 py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-cyan-400 hover:shadow-2xl hover:-translate-y-1 transition-all shadow-xl"
            >
              Buy It Now
              <span class="material-symbols-outlined font-black">shopping_cart</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Engineering Excellence Section -->
    <section class="py-24 bg-slate-900 text-white">
      <div class="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col items-center">
        <h2 class="text-3xl md:text-4xl font-black mb-12 uppercase tracking-[0.1em] text-center">
          Engineered for a Decade of Power
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-12 w-full">
          <div class="text-center">
            <div class="text-5xl font-black text-[#00AEEF] mb-4">10,000+</div>
            <p class="text-slate-400 font-bold uppercase tracking-widest">Charge Cycles</p>
          </div>
          <div class="text-center">
            <div class="text-5xl font-black text-[#00AEEF] mb-4">10 Min</div>
            <p class="text-slate-400 font-bold uppercase tracking-widest">Setup Time</p>
          </div>
          <div class="text-center">
            <div class="text-5xl font-black text-[#00AEEF] mb-4">5 Year</div>
            <p class="text-slate-400 font-bold uppercase tracking-widest">Extended Warranty</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="py-20 bg-slate-50 border-t border-slate-200">
      <div class="max-w-4xl mx-auto px-6 text-center">
        <p class="text-lg text-slate-500 font-medium mb-10 leading-relaxed uppercase tracking-widest px-4">
          Novel Solar is the authorized regional partner for Hithium portable energy systems.
        </p>
        <NuxtLink
          to="/quote"
          class="inline-flex items-center gap-4 bg-white border-2 border-slate-900 text-slate-900 px-12 py-6 rounded-3xl font-black text-xl hover:bg-slate-900 hover:text-white transition-all shadow-xl uppercase tracking-widest"
        >
          Talk to an expert
          <span class="material-symbols-outlined text-2xl font-black">call</span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">

// Images on this page can be replaced from /admin/manage-pages. The paths
// below are the originals and stay as the fallback if nothing is set.
const { image } = await usePageContent('partners/hithium')
useHead({
  title: 'Hithium Portable Solar Generators | NovelSolar Partner',
  meta: [
    {
      name: 'description',
      content:
        'Explore Hithium portable solar freedom. Buy the 1kWh and Heroee 2 portable power stations directly from Novel Solar.',
    },
  ],
})
</script>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 1s ease-out forwards;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 1,
    'wght' 700,
    'GRAD' 0,
    'opsz' 48;
}
</style>

<template>
  <div class="min-h-screen bg-white font-sans selection:bg-blue-500/30">
    <!-- 1. Top Partner Banner -->
    <div class="bg-white w-full py-6 flex justify-center items-center border-b border-gray-100">
      <img
        loading="lazy"
        :src="image('/images/Haisic_partner.png')"
        alt="Novel Solar x Haisic Partnership"
        class="h-12 md:h-16 w-auto object-contain mx-auto"
      />
    </div>

    <!-- 2. Hero Section -->
    <section class="relative bg-slate-950 py-24 md:py-32 overflow-hidden">
      <!-- Background Glow -->
      <div class="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] -mr-64 -mt-64" />
      <div
        class="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] -ml-64 -mb-64"
      />

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div class="grid lg:grid-cols-2 gap-16 items-center text-left">
          <div>
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8"
            >
              <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              New Partnership
            </div>
            <h1 class="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight leading-[1.1]">
              Power That Never Quits.<br />
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 italic"
                >Welcome to the Haisic Era.</span
              >
            </h1>
            <p class="text-xl text-slate-400 max-w-xl mb-12 leading-relaxed font-medium">
              Novel Solar is proud to partner with Haisic to bring you enterprise-grade LiFePO4 energy storage and smart
              hybrid inverters.
            </p>
            <NuxtLink
              to="/partners/haisic/shop"
              class="inline-flex items-center gap-2 bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-blue-500 transition-all shadow-2xl shadow-blue-500/20 active:scale-95 group"
            >
              Shop the Haisic Collection
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </NuxtLink>
          </div>
          <div class="relative hidden lg:block">
            <div class="absolute inset-0 bg-blue-600/20 rounded-full blur-[100px] -z-10 animate-pulse" />
            <img
              loading="lazy"
              :src="image('/images/haisic_aa_4.png')"
              alt="Haisic Enterprise Solution"
              class="w-full h-auto drop-shadow-[0_20px_50px_rgba(37,99,235,0.3)] hover:scale-105 transition-transform duration-700"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- 3. The 'Why Haisic?' Section (Tech Specs) -->
    <section class="py-24 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
        <h2 class="text-4xl font-black text-slate-900 tracking-tight uppercase italic mb-4">Why Choose Haisic?</h2>
        <div class="w-20 h-1.5 bg-blue-600 mx-auto rounded-full" />
      </div>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-3 gap-12">
          <!-- Spec 1 -->
          <div
            class="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors group"
          >
            <div
              class="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-8 w-8 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-4">6000+ Life Cycles</h3>
            <p class="text-slate-500 font-medium leading-relaxed italic">
              Engineered to last 10-15 years with daily deep discharging, outperforming standard lithium solutions.
            </p>
          </div>

          <!-- Spec 2 -->
          <div
            class="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors group"
          >
            <div
              class="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-8 w-8 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-4">Smart BMS Protection</h3>
            <p class="text-slate-500 font-medium leading-relaxed italic">
              Military-grade safety against overcharging, overheating, and short circuits for peace of mind.
            </p>
          </div>

          <!-- Spec 3 -->
          <div
            class="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors group"
          >
            <div
              class="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-8 w-8 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-4">Seamless Integration</h3>
            <p class="text-slate-500 font-medium leading-relaxed italic">
              Hybrid inverters that switch from solar to battery in under 10ms. Your electronics won't even blink.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. Feature Showcase (Alternating Layout) -->
    <section class="py-24 space-y-32">
      <!-- Row 1 -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-2 gap-16 items-center">
          <div class="order-2 md:order-1">
            <div
              class="inline-block px-3 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-6 italic"
            >
              Performance Core
            </div>
            <h2 class="text-4xl font-black text-slate-900 mb-6 leading-tight">
              Built for the <br /><span class="text-blue-600">Toughest Conditions.</span>
            </h2>
            <p class="text-lg text-slate-600 font-medium leading-relaxed mb-8">
              Engineered with IP55 protection and advanced heat tolerance, Haisic systems are purpose-built for the
              Nigerian climate, ensuring peak performance even in extreme temperatures.
            </p>
            <div class="flex items-center gap-6">
              <div class="text-center">
                <div class="text-3xl font-black text-blue-600">IP55</div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter">Protection</div>
              </div>
              <div class="w-px h-10 bg-slate-200" />
              <div class="text-center">
                <div class="text-3xl font-black text-blue-600">50°C</div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter">Operation</div>
              </div>
            </div>
          </div>
          <div class="order-1 md:order-2">
            <div class="relative">
              <div class="absolute inset-0 bg-blue-600/5 translate-x-4 translate-y-4 rounded-3xl" />
              <img
                loading="lazy"
                :src="image('/images/haisic_aa_1.png')"
                alt="Haisic Heavy Duty Inverter"
                class="rounded-3xl shadow-xl w-full object-cover relative z-10 hover:-translate-y-2 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2 -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-2 gap-16 items-center md:flex-row-reverse">
          <div class="md:order-1">
            <div class="relative">
              <div class="absolute inset-0 bg-blue-600/5 -translate-x-4 translate-y-4 rounded-3xl" />
              <img
                loading="lazy"
                :src="image('/images/haisic_aa_2.png')"
                alt="Haisic Stackable Battery System"
                class="rounded-3xl shadow-xl w-full object-cover relative z-10 hover:-translate-y-2 transition-transform duration-500"
              />
            </div>
          </div>
          <div class="md:order-2">
            <div
              class="inline-block px-3 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-6 italic"
            >
              Sustainability
            </div>
            <h2 class="text-4xl font-black text-slate-900 mb-6 leading-tight">
              All-in-One <br /><span class="text-blue-600">Solar Generators.</span>
            </h2>
            <p class="text-lg text-slate-600 font-medium leading-relaxed mb-8">
              Future-proof your energy with modular designs. Haisic allows for effortless scaling, with stackable
              capacities ranging from 4kWh to 15kWh to grow with your family.
            </p>
            <div class="flex items-center gap-6 mb-10">
              <div class="text-center">
                <div class="text-3xl font-black text-blue-600">4-15</div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter">kWh Range</div>
              </div>
              <div class="w-px h-10 bg-slate-200" />
              <div class="text-center">
                <div class="text-3xl font-black text-blue-600">LiFePO4</div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter">Chemistry</div>
              </div>
            </div>
            <NuxtLink
              to="/partners/haisic/shop"
              class="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-blue-500 transition-all shadow-lg active:scale-95 group"
            >
              Shop Haisic Smart Generators
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. Technical Precision Gallery -->
    <section class="py-24 bg-slate-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16">
        <h2 class="text-3xl font-black text-slate-900 tracking-tight uppercase italic mb-4">Technical Precision</h2>
        <p class="text-slate-500 font-medium italic">
          Inside the Haisic ecosystem: Engineered for performance and longevity.
        </p>
      </div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-3 gap-8">
          <div class="group cursor-pointer">
            <div class="overflow-hidden rounded-2xl aspect-square bg-white border border-slate-200">
              <img
                loading="lazy"
                :src="image('/images/haisic_aa_3.png')"
                alt="Haisic Core Components"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>
          <div class="group cursor-pointer">
            <div class="overflow-hidden rounded-2xl aspect-square bg-white border border-slate-200">
              <img
                loading="lazy"
                :src="image('/images/haisic_aa_5.png')"
                alt="Haisic Smart BMS Interface"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>
          <div class="group cursor-pointer">
            <div class="overflow-hidden rounded-2xl aspect-square bg-white border border-slate-200">
              <img
                loading="lazy"
                :src="image('/images/haisic_aa_6.png')"
                alt="Haisic Modular Scaling"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 6. Bottom CTA -->
    <section class="py-24 bg-blue-600 relative overflow-hidden">
      <!-- Decor -->
      <div class="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl" />
      <div class="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full -ml-48 -mb-48 blur-3xl" />

      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 class="text-4xl md:text-6xl font-black text-white mb-8 tracking-tighter uppercase italic">
          Ready to upgrade your power?
        </h2>
        <p class="text-xl text-blue-100 mb-12 font-medium opacity-80">
          Professional installation and a 5-year replacement warranty come standard with every Haisic system.
        </p>
        <NuxtLink
          to="/partners/haisic/shop"
          class="inline-block bg-white text-blue-600 px-12 py-5 rounded-2xl font-black text-xl hover:bg-slate-50 transition-all shadow-2xl active:scale-95 uppercase tracking-tight"
        >
          Browse Haisic Inventory
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">

// Images on this page can be replaced from /admin/manage-pages. The paths
// below are the originals and stay as the fallback if nothing is set.
const { image } = await usePageContent('partners/haisic')
useHead({
  title: 'Haisic High-Performance Solar | NovelSolar Partner',
  meta: [
    {
      name: 'description',
      content: 'Explore Haisic industrial and residential solar solutions. Built for power, designed for durability.',
    },
  ],
})
</script>

<style scoped>
.font-primary {
  font-family: 'Inter', sans-serif;
}
</style>

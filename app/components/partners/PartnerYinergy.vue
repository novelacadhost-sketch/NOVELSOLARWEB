<template>
  <div class="min-h-screen bg-white font-sans">
    <!-- 1. Top Partner Banner -->
    <div class="bg-white w-full py-6 flex justify-center items-center border-b border-gray-100">
      <img
        loading="lazy"
        :src="image('/images/yinergy_partner.png')"
        alt="Novel Solar x Yinergy Partnership"
        class="h-12 md:h-16 w-auto object-contain mx-auto"
      />
    </div>

    <!-- 2. Hero Section -->
    <section
      class="relative py-24 md:py-32 overflow-hidden text-white"
      style="background: linear-gradient(to right, #062414 0%, #2ca84a 100%)"
    >
      <!-- Background Decor -->
      <div
        class="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px] -mr-64 -mt-64"
      />

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div class="grid lg:grid-cols-2 gap-16 items-center text-left">
          <div>
            <!-- Badge -->
            <div
              class="inline-flex items-center gap-3 px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mb-10"
            >
              <span>Global Partnership</span>
              <span class="w-px h-3 bg-white/20" />
              <span>Innovation Leader</span>
            </div>

            <h1 class="text-6xl md:text-8xl font-black text-white mb-8 tracking-tight leading-[0.95]">
              Novel Solar <span class="text-[#2CA84A]">x</span><br />
              <span class="text-white">Yinergy</span>
            </h1>

            <h2 class="text-xl md:text-2xl font-bold text-white mb-6 leading-tight max-w-xl">
              Intelligent Energy Solutions for Residential, Commercial, and Industrial Needs
            </h2>

            <p class="text-base text-white/70 max-w-xl mb-12 leading-relaxed font-medium">
              Delivering advanced energy storage and hybrid inverter systems for sustainable, high-performance energy
              infrastructure across the globe.
            </p>

            <div class="flex flex-wrap items-center gap-4">
              <NuxtLink
                to="/partners/yinergy/shop"
                class="inline-flex items-center gap-2 text-white px-8 py-4 rounded-lg font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-red-900/20 active:scale-95 group"
                style="background-color: #be121e"
              >
                Explore Products
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

              <NuxtLink
                to="/contact"
                class="inline-flex items-center justify-center px-8 py-4 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-sm transition-all"
              >
                Contact Us
              </NuxtLink>

              <a
                :href="whatsappUrl"
                target="_blank"
                class="inline-flex items-center gap-2 text-white px-6 py-4 rounded-lg font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-green-900/10 active:scale-95"
                style="background-color: #25d366"
              >
                <span class="material-symbols-outlined text-lg">chat</span>
                WhatsApp
              </a>
            </div>
          </div>

          <div class="relative">
            <!-- Product Card -->
            <div class="relative group">
              <div class="absolute inset-0 bg-emerald-500/20 rounded-[40px] blur-3xl -z-10 animate-pulse" />
              <div
                class="bg-white/95 backdrop-blur-sm p-4 rounded-[40px] shadow-2xl transform rotate-2 group-hover:rotate-0 transition-transform duration-700 overflow-hidden"
              >
                <img
                  loading="lazy"
                  :src="image('/images/yinergy4.png')"
                  alt="Yinergy Industrial Solution"
                  class="w-full h-auto object-contain rounded-[30px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- 3. The 'Why Yinergy?' Section (Tech Specs) -->
    <section class="py-24 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
        <h2 class="text-4xl font-black text-slate-900 tracking-tight uppercase italic mb-4">Why Choose Yinergy?</h2>
        <div class="w-20 h-1.5 bg-[#2CA84A] mx-auto rounded-full" />
      </div>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-3 gap-12">
          <!-- Spec 1 -->
          <div
            class="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors group"
          >
            <div
              class="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"
            >
              <span class="material-symbols-outlined text-3xl text-[#2CA84A]">settings_input_component</span>
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-4">Hybrid Technology</h3>
            <p class="text-slate-500 font-medium leading-relaxed italic">
              Advanced power conversion systems that seamlessly manage solar, grid, and battery storage for maximum
              reliability.
            </p>
          </div>

          <!-- Spec 2 -->
          <div
            class="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors group"
          >
            <div
              class="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"
            >
              <span class="material-symbols-outlined text-3xl text-[#2CA84A]">cloud_sync</span>
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-4">YiCloud Management</h3>
            <p class="text-slate-500 font-medium leading-relaxed italic">
              Real-time monitoring and smart optimization via the YiCloud platform, giving you full control over your
              energy ecosystem.
            </p>
          </div>

          <!-- Spec 3 -->
          <div
            class="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors group"
          >
            <div
              class="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"
            >
              <span class="material-symbols-outlined text-3xl text-[#2CA84A]">factory</span>
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-4">C&I Scalability</h3>
            <p class="text-slate-500 font-medium leading-relaxed italic">
              Tailored for Commercial & Industrial demand, offering modular expansion to meet the growing needs of your
              enterprise.
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
              class="inline-block px-3 py-1 rounded bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-6 italic"
            >
              Yi-Hybrid Series
            </div>
            <h2 class="text-4xl font-black text-slate-900 mb-6 leading-tight">
              Intelligent <br /><span class="text-[#2CA84A]">Power Conversion.</span>
            </h2>
            <p class="text-lg text-slate-600 font-medium leading-relaxed mb-8">
              Experience industry-leading efficiency and smart routing technology designed to optimize every watt of
              energy your system generates.
            </p>
            <div class="flex items-center gap-6">
              <div class="text-center">
                <div class="text-3xl font-black text-[#2CA84A]">98.4%</div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter">Efficiency</div>
              </div>
              <div class="w-px h-10 bg-slate-200" />
              <div class="text-center">
                <div class="text-3xl font-black text-[#2CA84A]">Smart</div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter">Routing</div>
              </div>
            </div>
          </div>
          <div class="order-1 md:order-2">
            <div class="relative">
              <div class="absolute inset-0 bg-emerald-600/5 translate-x-4 translate-y-4 rounded-3xl" />
              <img
                loading="lazy"
                :src="image('/images/Yinergy2.png')"
                alt="Yinergy Hybrid Inverter"
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
              <div class="absolute inset-0 bg-emerald-600/5 -translate-x-4 translate-y-4 rounded-3xl" />
              <img
                loading="lazy"
                :src="image('/images/yinergy3.png')"
                alt="Yinergy Energy Storage"
                class="rounded-3xl shadow-xl w-full object-cover relative z-10 hover:-translate-y-2 transition-transform duration-500"
              />
            </div>
          </div>
          <div class="md:order-2">
            <div
              class="inline-block px-3 py-1 rounded bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-6 italic"
            >
              Yi-Storage Pro
            </div>
            <h2 class="text-4xl font-black text-slate-900 mb-6 leading-tight">
              High-Density <br /><span class="text-[#2CA84A]">Energy Storage.</span>
            </h2>
            <p class="text-lg text-slate-600 font-medium leading-relaxed mb-8">
              Future-proof your energy with Yinergy's high-cycle LFP technology, offering unmatched durability and
              safety for large-scale energy requirements.
            </p>
            <div class="flex items-center gap-6 mb-10">
              <div class="text-center">
                <div class="text-3xl font-black text-[#2CA84A]">10k+</div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter">Life Cycles</div>
              </div>
              <div class="w-px h-10 bg-slate-200" />
              <div class="text-center">
                <div class="text-3xl font-black text-[#2CA84A]">LFP</div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter">Chemistry</div>
              </div>
            </div>
            <NuxtLink
              to="/partners/yinergy/shop"
              class="inline-flex items-center gap-2 bg-[#2CA84A] text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-emerald-500 transition-all shadow-lg active:scale-95 group"
            >
              Shop Yinergy Smart Systems
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
          Inside the Yinergy ecosystem: Engineered for performance and longevity.
        </p>
      </div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-3 gap-8">
          <div class="group cursor-pointer">
            <div class="overflow-hidden rounded-2xl aspect-square bg-white border border-slate-200">
              <img
                loading="lazy"
                :src="image('/images/yinergy1.png')"
                alt="Yinergy Core Technology"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>
          <div class="group cursor-pointer">
            <div class="overflow-hidden rounded-2xl aspect-square bg-white border border-slate-200">
              <img
                loading="lazy"
                :src="image('/images/yinergy5.png')"
                alt="Yinergy Smart Interface"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>
          <div class="group cursor-pointer">
            <div class="overflow-hidden rounded-2xl aspect-square bg-white border border-slate-200">
              <img
                loading="lazy"
                :src="image('/images/yinergy1.png')"
                alt="Yinergy Industrial Scale"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 6. Bottom CTA -->
    <section class="py-24 relative overflow-hidden text-white" style="background-color: #2ca84a">
      <!-- Decor -->
      <div class="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl" />
      <div class="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full -ml-48 -mb-48 blur-3xl" />

      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 class="text-4xl md:text-6xl font-black text-white mb-8 tracking-tighter uppercase italic">
          Ready to upgrade your power?
        </h2>
        <p class="text-xl text-emerald-100 mb-12 font-medium opacity-80">
          Professional installation and a 5-year replacement warranty come standard with every Yinergy system.
        </p>
        <NuxtLink
          to="/partners/yinergy/shop"
          class="inline-block bg-white px-12 py-5 rounded-2xl font-black text-xl hover:bg-slate-50 transition-all shadow-2xl active:scale-95 uppercase tracking-tight"
          style="color: #2ca84a !important"
        >
          Browse Yinergy Inventory
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">

// Images on this page can be replaced from /admin/manage-pages. The paths
// below are the originals and stay as the fallback if nothing is set.
const { image } = await usePageContent('partners/yinergy')
const {
  public: { whatsappNumber },
} = useRuntimeConfig()
const whatsappUrl = computed(() => `https://wa.me/${whatsappNumber}`)

useHead({
  title: 'Yinergy Intelligent Energy Solutions | NovelSolar Partner',
  meta: [
    {
      name: 'description',
      content:
        'Explore Yinergy intelligent energy storage and hybrid inverter systems. Engineered for performance and scalability.',
    },
  ],
})
</script>

<style scoped>
.font-primary {
  font-family: 'Inter', sans-serif;
}
</style>

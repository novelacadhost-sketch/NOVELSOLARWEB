<template>
  <div class="min-h-screen bg-white">
    <!-- Hero Section -->
    <section class="bg-slate-50 py-20 md:py-32 border-b border-slate-100">
      <div class="max-w-7xl mx-auto px-4 text-center">
        <h1 class="text-4xl md:text-6xl font-black text-[#002888] mb-6 tracking-tight">Our Global Partners</h1>
        <p class="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
          Collaborating with industry-leading manufacturers to deliver high-performance, sustainable energy solutions
          across the globe.
        </p>
      </div>
    </section>

    <!-- Partners Grid -->
    <section class="py-24 max-w-7xl mx-auto px-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
        <NuxtLink
          v-for="partner in partners"
          :key="partner.slug"
          :to="'/partners/' + partner.slug"
          class="group bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center"
        >
          <div
            class="w-full aspect-[3/2] bg-slate-50 rounded-2xl mb-8 flex items-center justify-center border-2 border-slate-100 group-hover:bg-blue-50/50 group-hover:border-[#002888]/20 transition-all overflow-hidden p-6 relative"
          >
            <template v-if="partner.logo">
              <img
                loading="lazy"
                :src="partner.logo"
                :alt="partner.name + ' Logo'"
                class="w-full h-full object-contain filter group-hover:scale-105 transition-transform duration-500 ease-out z-10 relative"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-slate-100/50 block z-0" />
            </template>
            <template v-else>
              <div
                class="text-[#002888] font-black text-2xl opacity-20 group-hover:opacity-40 tracking-widest uppercase"
              >
                {{ partner.name }}
              </div>
            </template>
          </div>

          <h3 class="text-2xl font-black text-slate-900 mb-3 group-hover:text-[#002888] transition-colors">
            {{ partner.name }}
          </h3>
          <p class="text-slate-500 font-medium leading-relaxed mb-8">
            {{ partner.desc }}
          </p>

          <div class="mt-auto flex items-center gap-2 text-[#002888] font-bold text-sm uppercase tracking-widest">
            View Partner Detail
            <span class="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform"
              >arrow_forward</span
            >
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Bottom CTA Section -->
    <section class="bg-[#002888] py-24 relative overflow-hidden">
      <!-- Decorative background pattern -->
      <div class="absolute inset-0 opacity-10 pointer-events-none">
        <div class="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div
          class="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"
        />
      </div>

      <div class="max-w-4xl mx-auto px-4 text-center relative z-10">
        <h2 class="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight">Join the Novel Solar Ecosystem</h2>
        <p class="text-lg text-blue-100 mb-12 max-w-xl mx-auto font-medium opacity-90">
          Partner with us to expand your reach and power a more sustainable future with cutting-edge energy technology.
        </p>
        <NuxtLink
          to="/partners/become-a-partner"
          class="inline-flex items-center gap-3 bg-white text-[#002888] px-10 py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-50 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-xl"
        >
          Become a Partner
          <span class="material-symbols-outlined">rocket_launch</span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const partners = [
  {
    name: 'Itel',
    slug: 'itel',
    desc: 'Premium solar panels and energy solutions designed for reliability.',
    logo: '/images/itel_logo.png',
  },
  {
    name: 'Haisic',
    slug: 'haisic',
    desc: 'High-efficiency inverters and battery systems for smart energy management.',
    logo: '/images/haisic_logo.png',
  },
  {
    name: 'Yinergy',
    slug: 'yinergy',
    desc: 'Advanced renewable energy storage solutions for residential and commercial use.',
    logo: '/images/jinergy_logo.png',
  },
  {
    name: 'Hithium',
    slug: 'hithium',
    desc: 'Next-generation lithium battery technology powering long-lasting energy storage.',
    logo: '/images/Hithium_logo.png',
  },
  {
    name: 'Livoltek',
    slug: 'livoltek',
    desc: 'Smart solar solutions and EV chargers integrating seamlessly into modern homes.',
    logo: '/images/livoltek_logo.png',
  },
  {
    name: 'PowerChina',
    slug: 'powerchina',
    desc: 'LiFePO4 lithium batteries and hybrid inverters for dependable home and business backup.',
    logo: '/images/powerchina.png',
  },
]

useHead({
  title: 'Our Global Partners | Novel Solar',
  meta: [
    {
      name: 'description',
      content: 'Discover our premium manufacturing partners and explore our collaborative energy solutions.',
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
    'opsz' 24;
}
</style>

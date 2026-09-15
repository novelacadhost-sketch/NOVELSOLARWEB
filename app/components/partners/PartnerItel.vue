<template>
  <div class="min-h-screen bg-[#FDFDFD]">
    <!-- Section 1: The Top Logo Banner -->
    <div class="w-full bg-white border-b border-gray-100 py-4 px-8 flex justify-center">
      <img
        loading="lazy"
        :src="image('/images/logo-new-novel.-itel.png')"
        alt="NovelSolar x itel"
        class="h-12 md:h-16 w-auto object-contain"
      />
    </div>

    <!-- Section 2: The Hero Section -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div class="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 class="text-5xl font-extrabold text-[#002888] mb-6 leading-tight">
            24/7 Uninterrupted Power for Your Home
          </h1>
          <p class="text-xl text-gray-700 max-w-2xl mb-12 leading-relaxed">
            Say goodbye to grid blackouts and noisy generators. The itel solar ecosystem keeps your appliances running
            silently and safely.
          </p>
          <NuxtLink
            to="/partners/itel/shop"
            class="inline-block bg-[#002888] text-white px-8 py-4 rounded-full font-semibold hover:bg-blue-900 transition-all shadow-lg hover:shadow-[#002888]/20"
          >
            Shop the itel Collection &rarr;
          </NuxtLink>
        </div>
        <div class="relative">
          <img
            loading="lazy"
            :src="image('/images/itel_3.png')"
            alt="itel Home Solar"
            class="rounded-3xl shadow-2xl w-full object-cover aspect-[4/3]"
          />
          <div class="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl hidden lg:block">
            <div class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Energy Independence</div>
            <div class="text-3xl font-black text-[#002888]">100%</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 3: The Introduction -->
    <section class="bg-white py-32">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <img loading="lazy" :src="image('/images/itel.jpg')" alt="itel Reliable Power" class="rounded-2xl shadow-lg w-full" />
          </div>
          <div>
            <h2 class="text-4xl font-bold text-gray-900 mb-6">Silent, Safe, and Smart Home Energy</h2>
            <p class="text-lg text-gray-600 mb-6 leading-relaxed">
              Experience true comfort without the stress of fuel costs or maintenance of old generators. Our itel
              systems are built to keep your AC, deep freezer, and essential electronics running smoothly through any
              outage.
            </p>
            <div class="space-y-4">
              <div
                v-for="(item, i) in ['Silent Operation', 'Family Safety Design', '24/7 Remote Monitoring']"
                :key="i"
                class="flex items-center gap-3"
              >
                <div class="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg class="w-4 h-4 text-[#002888]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="font-semibold text-gray-800">{{ item }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 4: itel Product Spotlight -->
    <section class="bg-gray-50 py-32">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-3 gap-12 items-center">
          <div class="md:col-span-2">
            <img
              loading="lazy"
              :src="image('/images/itel-5-600x600.webp')"
              alt="itel Home Inverter"
              class="max-w-md mx-auto drop-shadow-2xl hover:scale-105 transition-transform duration-700"
            />
          </div>
          <div>
            <h3 class="text-3xl font-bold text-gray-900 mb-6 font-primary">itel Home Inverter Series</h3>
            <ul class="space-y-4 mb-8">
              <li class="flex flex-col">
                <span class="text-sm font-bold text-gray-400 uppercase tracking-tighter">Perfect for Home</span>
                <span class="text-lg font-medium text-gray-800">Powers ACs, Fridges & Electronics</span>
              </li>
              <li class="flex flex-col">
                <span class="text-sm font-bold text-gray-400 uppercase tracking-tighter">Smart Charging</span>
                <span class="text-lg font-medium text-gray-800">Optimizes Battery Life Automatically</span>
              </li>
              <li class="flex flex-col">
                <span class="text-sm font-bold text-gray-400 uppercase tracking-tighter">Safety First</span>
                <span class="text-lg font-medium text-gray-800">Built-in Overload Protection</span>
              </li>
            </ul>
            <NuxtLink
              to="/partners/itel/shop"
              class="inline-block border border-[#002888] text-[#002888] px-8 py-3 rounded-full font-bold hover:bg-blue-50 transition-colors"
            >
              Buy itel Products Now
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 5: Key Technical Benefits -->
    <section class="py-32">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-2 gap-16">
          <!-- Benefit 1 -->
          <div class="flex flex-col gap-8">
            <div class="h-[400px] overflow-hidden rounded-3xl">
              <img loading="lazy" :src="image('/images/itel_2.jpg')" alt="Home Integration" class="w-full h-full object-cover" />
            </div>
            <div>
              <h4 class="text-2xl font-bold text-gray-900 mb-4">Seamless Home Integration</h4>
              <p class="text-gray-600 leading-relaxed">
                Designed for modern aesthetics. itel systems fit perfectly into your home environment, providing silent
                and clean energy without the noise of traditional generators.
              </p>
            </div>
          </div>
          <!-- Benefit 2 -->
          <div class="flex flex-col gap-8">
            <div class="h-[400px] overflow-hidden rounded-3xl">
              <img loading="lazy" :src="image('/images/itel_1.jpg')" alt="Reliability" class="w-full h-full object-cover" />
            </div>
            <div>
              <h4 class="text-2xl font-bold text-gray-900 mb-4">Long-Term Family Security</h4>
              <p class="text-gray-600 leading-relaxed">
                Backed by a comprehensive 5-year replacement warranty, ensuring your family stays powered up through
                every season with zero stress.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 6: The Final High-Conversion CTA -->
    <section class="bg-[#002888] text-white py-24 text-center mt-32 px-4 relative overflow-hidden">
      <!-- Decor -->
      <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
      <div class="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-32 -mb-32" />

      <div class="relative z-10 max-w-3xl mx-auto">
        <h2 class="text-4xl md:text-5xl font-extrabold mb-8">Ready to upgrade your home's power?</h2>
        <p class="text-lg mb-12 opacity-90 max-w-xl mx-auto leading-relaxed">
          Browse our collection of reliable itel inverters and batteries.
        </p>
        <NuxtLink
          to="/partners/itel/shop"
          class="inline-block bg-white text-[#002888] px-12 py-5 rounded-full text-xl font-bold hover:bg-gray-100 transition-all shadow-2xl active:scale-95"
        >
          Browse itel Products &rarr;
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">

// Images on this page can be replaced from /admin/manage-pages. The paths
// below are the originals and stay as the fallback if nothing is set.
const { image } = await usePageContent('partners/itel')
useHead({
  title: 'itel Home Solar Solutions | 24/7 Energy Independence',
  meta: [
    {
      name: 'description',
      content:
        'Explore itel smart solar collections for your home. Reliable inverters and batteries designed for Nigerian households.',
    },
  ],
})
</script>

<style scoped>
.font-primary {
  font-family: 'Inter', sans-serif;
}
</style>

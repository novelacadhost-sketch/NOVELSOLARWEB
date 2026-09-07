<template>
  <div>
    <!-- Hero Section -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div
        class="relative aspect-video sm:aspect-auto sm:min-h-[560px] rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/10"
      >
        <div
          v-for="(slide, index) in heroSlides"
          :key="slide.image"
          class="absolute inset-0 transition-opacity duration-700"
          :class="index === activeHeroSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'"
        >
          <NuxtLink to="/shop" class="absolute inset-0 z-10" :aria-label="`Shop products from ${slide.title}`" />
          <FadeImage
            use-nuxt-img
            :src="slide.image"
            :alt="slide.title"
            :preload="index === 0"
            :fetchpriority="index === 0 ? 'high' : 'auto'"
            :loading="index === 0 ? 'eager' : 'lazy'"
            class="absolute inset-0 h-full w-full"
            image-class="object-cover"
          />
        </div>

        <div
          class="absolute bottom-5 left-5 right-5 z-20 flex items-center justify-between gap-4 sm:bottom-8 sm:left-12 sm:right-12"
        >
          <div class="flex items-center gap-2">
            <button
              v-for="(slide, index) in heroSlides"
              :key="`${slide.image}-dot`"
              type="button"
              class="h-2.5 rounded-full transition-all"
              :class="index === activeHeroSlide ? 'w-10 bg-white' : 'w-2.5 bg-white/45 hover:bg-white/70'"
              :aria-label="`Go to hero slide ${index + 1}`"
              @click="activeHeroSlide = index"
            />
          </div>

          <div
            class="hidden sm:flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-2 text-white backdrop-blur-md"
          >
            <button
              type="button"
              class="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              @click="goToPreviousHeroSlide"
            >
              <span class="material-symbols-outlined text-lg">west</span>
            </button>
            <button
              type="button"
              class="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              @click="goToNextHeroSlide"
            >
              <span class="material-symbols-outlined text-lg">east</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Our Ecosystem Selection -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-16">
      <div
        class="flex flex-col h-[280px] overflow-y-auto snap-y snap-mandatory md:h-auto md:overflow-visible md:grid md:grid-cols-2 gap-4 md:gap-8 rounded-xl no-scrollbar"
      >
        <!-- Card 1 - Novel Academy -->
        <a
          href="https://novel-academy.com"
          target="_blank"
          rel="noopener noreferrer"
          class="group relative block overflow-hidden rounded-xl bg-[#2C75D8] p-8 text-white shadow-md transition-transform hover:-translate-y-1 min-h-[280px] flex flex-col justify-end shrink-0 h-full w-full snap-center"
        >
          <!-- Background Image -->
          <FadeImage
            use-nuxt-img
            src="/images/Website BannersNovel Academy.jpg.jpeg"
            alt="Novel Academy"
            class="absolute inset-0 w-full h-full"
            image-class="object-cover transition-transform duration-500 group-hover:scale-110"
          />

          <!-- Content -->
          <div class="relative z-10">
            <span
              class="inline-flex items-center gap-2 rounded-full border border-white/70 bg-[#2C75D8]/15 px-5 py-3 text-sm font-semibold text-white backdrop-blur-[2px] transition-all group-hover:bg-[#2C75D8]/30 group-hover:font-black group-hover:shadow-lg"
            >
              Explore Courses
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </div>
        </a>

        <!-- Card 2 - Solar Product Exchange -->
        <a
          href="https://solarproductexchange.com"
          target="_blank"
          rel="noopener noreferrer"
          class="group relative block overflow-hidden rounded-xl bg-white border border-gray-200 p-8 shadow-md transition-transform hover:-translate-y-1 min-h-[280px] flex flex-col justify-end shrink-0 h-full w-full snap-center"
        >
          <!-- Background Image -->
          <FadeImage
            use-nuxt-img
            src="/images/Website BannersTokunbo shop.jpg.jpeg"
            alt="Solar Product Exchange"
            class="absolute inset-0 w-full h-full"
            image-class="object-cover transition-transform duration-500 group-hover:scale-110"
          />

          <!-- Content -->
          <div class="relative z-10">
            <span
              class="inline-flex items-center gap-2 rounded-full border border-white/70 bg-[#ea580c]/15 px-5 py-3 text-sm font-semibold text-white backdrop-blur-[2px] transition-all group-hover:bg-[#ea580c]/30 group-hover:font-black group-hover:shadow-lg"
            >
              Shop Used Inventory
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </div>
        </a>
      </div>
    </section>

    <!-- All Inventory Product Grid -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="mb-6 md:mb-8">
        <div class="flex items-end justify-between mb-2 gap-4">
          <h2 class="text-2xl md:text-3xl font-bold text-slate-900 leading-none">Featured Products</h2>

          <NuxtLink
            to="/shop"
            class="text-sm font-bold text-[#002888] flex items-center gap-1 hover:text-blue-700 transition-colors whitespace-nowrap pb-1"
          >
            See All <span class="material-symbols-outlined text-sm md:text-base">chevron_right</span>
          </NuxtLink>
        </div>

        <p class="text-slate-500 text-sm md:text-base">Ready for immediate dispatch from our regional hubs.</p>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
        <div v-for="i in 4" :key="i" class="bg-white rounded-2xl border border-gray-100 p-4 space-y-4 animate-pulse">
          <div class="aspect-square bg-gray-100 rounded-xl" />
          <div class="h-4 bg-gray-100 rounded w-3/4" />
          <div class="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      </div>

      <!-- Product Grid -->
      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
        <ProductCard v-for="product in featuredProducts" :key="product.ID" :product="product" />
      </div>

      <!-- View All Button -->
      <div class="mt-12 text-center">
        <NuxtLink
          to="/shop"
          class="inline-flex items-center gap-2 bg-[#002888] text-white px-10 py-4 rounded-xl font-bold hover:bg-blue-900 transition-all shadow-lg hover:shadow-blue-900/20 active:scale-95"
        >
          View All Products
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </NuxtLink>
      </div>
    </section>

    <!-- Services / Business Arms Section -->
    <section class="bg-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <span class="text-xs font-black uppercase tracking-[0.25em] text-[#002888]">What We Do</span>
          <h2 class="text-3xl md:text-4xl font-black text-slate-900 mt-3 tracking-tight">Our Services</h2>
          <p class="text-slate-500 mt-4 max-w-2xl mx-auto leading-relaxed">
            Three connected arms of the Novel group — powering homes, training the next generation of engineers, and
            shipping software the world relies on.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <article
            v-for="service in services"
            :key="service.title"
            class="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
          >
            <div class="aspect-[4/3] bg-slate-100 overflow-hidden relative">
              <FadeImage
                use-nuxt-img
                :src="service.image"
                :alt="service.title"
                class="absolute inset-0 w-full h-full"
                image-class="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div
                class="absolute top-4 left-4 w-11 h-11 rounded-2xl flex items-center justify-center bg-white/90 backdrop-blur-md shadow-sm"
              >
                <span class="material-symbols-outlined text-xl text-[#002888]">{{ service.icon }}</span>
              </div>
            </div>
            <div class="p-6 flex flex-col flex-grow">
              <h3 class="text-base font-black text-slate-900 mb-3 tracking-tight leading-tight">{{ service.title }}</h3>
              <p class="text-sm text-slate-500 leading-relaxed font-medium mb-6">{{ service.description }}</p>

              <NuxtLink
                :to="service.link"
                class="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#002888] hover:underline"
              >
                Learn More
                <span class="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform"
                  >arrow_forward</span
                >
              </NuxtLink>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Industry Insights Section -->
    <section v-if="recentInsights && recentInsights.length > 0" class="bg-gray-50 py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-gray-900">Industry Insights</h2>
          <p class="text-gray-500 mt-4 max-w-2xl mx-auto">
            Latest updates from the solar sector, logistics reports, and technology breakthroughs.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <article
            v-for="post in recentInsights || []"
            :key="post._path"
            class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
          >
            <div class="aspect-video relative overflow-hidden">
              <FadeImage
                v-if="post.image"
                use-nuxt-img
                :src="post.image"
                :alt="post.title"
                class="absolute inset-0 w-full h-full"
                image-class="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <FadeImage
                v-else
                use-nuxt-img
                src="/images/fallback-post.png"
                :alt="post.title"
                class="absolute inset-0 w-full h-full"
                image-class="object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </div>
            <div class="p-8">
              <div class="flex items-center gap-2 mb-4 text-xs font-medium text-gray-400">
                <span>{{ post.category || 'Industry Insight' }}</span>
                <span v-if="post.date" class="w-1 h-1 rounded-full bg-gray-300" />
                <span>{{ formatPublishedAt(post.date) }}</span>
              </div>
              <h3 class="text-xl font-bold text-gray-900 mb-4 leading-snug group-hover:text-primary transition-colors">
                {{ post.title }}
              </h3>
              <p class="text-gray-500 text-sm line-clamp-2 mb-6">
                {{ post.description || post.excerpt || 'Read the latest update from Novel Solar insights.' }}
              </p>
              <NuxtLink
                :to="`/blog/${post._path.replace('/blog/', '')}`"
                class="text-primary font-bold text-sm inline-flex items-center gap-2"
              >
                Read Article
                <svg
                  class="w-4 h-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </NuxtLink>
            </div>
          </article>
        </div>

        <div class="mt-12 flex justify-center">
          <NuxtLink
            to="/blog"
            class="inline-flex items-center gap-2 border-2 border-[#002888] text-[#002888] hover:bg-[#002888] hover:text-white px-7 py-3 rounded-md text-sm font-bold transition-colors"
          >
            View More Insights
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { excludeServiceProducts } from '~/utils/productFilters'
import { useHead } from '#imports'

useHead({
  title: 'Novel Solar: Leading Solar Energy Company in Nigeria - novelsolar',
})

const heroSlides = [
  {
    image: '/images/Website BannersItel 500W SG.jpg.jpeg',
    eyebrow: 'Fast-Moving Solar Stock',
    title: 'Power Projects With Ready-to-Dispatch Solar Inventory.',
    description:
      'Browse trusted modules, batteries, charge controllers, and inverters sourced for installers, EPCs, and growing energy businesses.',
    caption: 'Install-ready products',
  },
  {
    image: '/images/Website BannersHithium SG.jpg.jpeg',
    eyebrow: 'Battery Storage',
    title: 'Scale Faster With Premium Lithium Storage Solutions.',
    description:
      'Source dependable storage systems built for residential backup, commercial resilience, and modern energy independence.',
    caption: 'High-capacity energy backup',
  },
  {
    image: '/images/Website Banners17.5kWh Lithium Battery.jpg.jpeg',
    eyebrow: 'Commercial Performance',
    title: 'Deliver Bigger Energy Systems Without Procurement Delays.',
    description:
      'Keep timelines moving with stocked solar essentials, reliable fulfillment, and quick access to the products your team needs most.',
    caption: 'Project-ready logistics',
  },
  {
    image: '/images/Website Banners1100VA Hybrid Inveretr.jpg.jpeg',
    eyebrow: 'Hybrid Inverters',
    title: 'Match Smarter Inverter Options To Every Customer Need.',
    description:
      'From compact backup setups to robust hybrid systems, find efficient inverter options that help you quote and close faster.',
    caption: 'Built for daily demand',
  },
  {
    image: '/images/Website Banners230ah Tubular Battery.jpg.jpeg',
    eyebrow: 'Reliable Backup',
    title: 'Keep Homes and Businesses Running Through Grid Downtime.',
    description:
      'Stock proven backup components that support dependable power delivery and long-term performance in the field.',
    caption: 'Reliable field performance',
  },
  {
    image: '/images/Website Banners200A MMPT CC.jpg.jpeg',
    eyebrow: 'System Components',
    title: 'Complete Your Solar Builds With High-Performance Accessories.',
    description:
      'Source the charge controllers and balance-of-system essentials that keep every installation efficient, safe, and scalable.',
    caption: 'Everything your build needs',
  },
  {
    image: '/images/Website Banners100A MMPT CC copy.jpg.jpeg',
    eyebrow: 'Installer Essentials',
    title: 'Stay Ready for Daily Sales With Popular Solar Bestsellers.',
    description:
      'Move quickly with the products customers ask for most, supported by dependable fulfillment and instant access to stock.',
    caption: 'Always ready to ship',
  },
  {
    image: '/images/Website Banners1250 SG.jpg.jpeg',
    eyebrow: 'Residential Solar',
    title: 'Build Efficient Home Power Packages That Customers Trust.',
    description:
      'Curate clean, practical solar packages for everyday users with dependable components and strong value at every tier.',
    caption: 'Home-ready energy kits',
  },
  {
    image: '/images/Website Banners1260 SG copy.jpg.jpeg',
    eyebrow: 'Energy Growth',
    title: 'Support Growing Demand With Better Stock Visibility.',
    description:
      'From first inquiry to final delivery, keep your solar pipeline moving with a shop built for quick product discovery.',
    caption: 'Designed for fast quoting',
  },
]

const activeHeroSlide = ref(0)
let heroCarouselInterval: ReturnType<typeof setInterval> | null = null

const goToNextHeroSlide = () => {
  activeHeroSlide.value = (activeHeroSlide.value + 1) % heroSlides.length
}

const goToPreviousHeroSlide = () => {
  activeHeroSlide.value = (activeHeroSlide.value - 1 + heroSlides.length) % heroSlides.length
}

onMounted(() => {
  heroCarouselInterval = setInterval(() => {
    goToNextHeroSlide()
  }, 4500)
})

onUnmounted(() => {
  if (heroCarouselInterval) {
    clearInterval(heroCarouselInterval)
  }
})

const ALLOWED_BRANDS = ['novelsolar', 'novel solar', 'novel']
const FEATURED_PER_WEEK = 4

const { data: featuredProducts, pending } = await useAsyncData('home-featured-novelsolar', async () => {
  const all = await $fetch<any[]>('/api/inventory', { headers: useRequestHeaders(['cookie']) })

  const novelSolarPool = excludeServiceProducts(all || [])
    .filter((p) => {
      if (typeof p?.NAME !== 'string') return false
      const lowerName = p.NAME.toLowerCase()
      return ALLOWED_BRANDS.some((brand) => lowerName.includes(brand))
    })
    // Sort by ID desc as a proxy for created_at desc — Bitrix IDs are monotonically increasing,
    // so the newest products land at the top of the rotation pool.
    .sort((a, b) => Number(b.ID) - Number(a.ID))

  // Fewer than a full page → show everything, no rotation needed.
  if (novelSolarPool.length <= FEATURED_PER_WEEK) {
    return novelSolarPool
  }

  // Deterministic weekly rotation — same week → same slice for every visitor (SSR-safe).
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)

  const totalPages = Math.ceil(novelSolarPool.length / FEATURED_PER_WEEK)
  const startIndex = (weekNumber % totalPages) * FEATURED_PER_WEEK
  return novelSolarPool.slice(startIndex, startIndex + FEATURED_PER_WEEK)
})

const { data: recentInsights } = await useAsyncData('home-insights', () => {
  return queryContent('blog')
    .where({ draft: { $ne: true } })
    .sort({ date: -1 })
    .limit(3)
    .find()
})

const services = [
  {
    title: 'Power & Load Audit Service',
    description:
      'Site walkthrough, appliance-by-appliance load profiling and a sized recommendation report — so you buy the right inverter and battery the first time.',
    image: '/images/PowerAuditEngineer.png',
    icon: 'monitoring',
    link: '/services/audit',
  },
  {
    title: 'Inverter, Solar Panel & Battery Installation',
    description:
      'Turnkey installation by our certified engineers: mounting, wiring, commissioning and live-system handover for residential and commercial sites.',
    image: '/images/installation.png',
    icon: 'construction',
    link: '/services/installation',
  },
  {
    title: 'Inverter Repair (Solar Panel, Battery etc Repairs)',
    description:
      'Diagnostics and component-level repair for inverters, panels and batteries — including non-Novel Solar units. Fast turnaround at our regional service hubs.',
    image: '/images/InverterRepairEngineer.png',
    icon: 'build',
    link: '/services/repair',
  },
  {
    title: 'Solar Panel, Tubular Battery & Inverter Maintenance',
    description:
      'Scheduled cleaning, electrolyte top-ups, terminal servicing and firmware checks to keep your system running at peak output for years.',
    image: '/images/PanelMaintenance.png',
    icon: 'cleaning_services',
    link: '/services/maintenance',
  },
]

const { addToCart } = useCart()

const buyNow = (product) => {
  addToCart(product)
  navigateTo('/checkout')
}

const formatPublishedAt = (dateString) => {
  if (!dateString) return 'Latest release'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString))
}
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

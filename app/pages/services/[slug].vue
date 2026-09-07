<template>
  <div class="min-h-screen bg-slate-50 py-12 px-6 lg:px-12">
    <div class="max-w-7xl mx-auto">
      <nav class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
        <NuxtLink to="/" class="hover:text-[#002888] transition-colors">Home</NuxtLink>
        <span class="text-gray-300">/</span>
        <span class="text-gray-500">Services</span>
        <span class="text-gray-300">/</span>
        <span class="text-gray-900 capitalize">{{ formattedSlug }}</span>
      </nav>

      <div v-if="pending" class="flex justify-center py-32 text-center">
        <div class="w-12 h-12 border-4 border-[#002888]/20 border-t-[#002888] rounded-full animate-spin" />
      </div>

      <div v-else-if="service" class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mt-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div
            class="p-12 lg:p-16 flex items-center justify-center bg-gray-50 border-r border-gray-100 relative overflow-hidden group"
          >
            <!-- Decorative background vector -->
            <div
              class="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none"
            />

            <div
              class="w-full max-w-sm aspect-square bg-white rounded-[40px] shadow-lg flex items-center justify-center p-8 relative z-10 transition-transform duration-500 group-hover:scale-105"
            >
              <!-- Fallback Icon if no specific image is provided for the service -->
              <img
                v-if="localServiceImage"
                loading="lazy"
                :src="localServiceImage"
                :alt="service.NAME"
                class="w-full h-full object-contain drop-shadow-xl"
              />
              <span
                v-else
                class="material-symbols-outlined text-[100px] text-[#002888]/20 group-hover:text-[#002888] transition-colors duration-500"
              >
                home_repair_service
              </span>
            </div>
          </div>

          <div class="p-10 lg:p-16 flex flex-col justify-center">
            <span
              class="text-[#00AEEF] font-black uppercase tracking-widest text-sm mb-4 block flex items-center gap-2"
            >
              <span class="material-symbols-outlined text-sm">verified</span>
              Professional Service
            </span>

            <h1 class="text-4xl xl:text-5xl font-black text-[#002888] mb-6 leading-[1.1] tracking-tight">
              {{ service.NAME || formattedSlug + ' Service' }}
            </h1>

            <p class="text-lg text-gray-500 mb-8 leading-relaxed font-medium">
              Ensure your solar infrastructure operates at peak efficiency with our specialized
              {{ formattedSlug }} services. Our certified technicians are ready to assess, optimize, and maintain your
              energy systems for long-lasting reliability.
            </p>

            <div class="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-10 inline-block w-full max-w-sm">
              <span class="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Estimated Cost</span>
              <div class="text-3xl font-black text-slate-900 flex items-end gap-2">
                {{ formatPrice(service.PRICE) }} <span class="text-sm text-gray-500 mb-1">NGN</span>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-4">
              <button
                class="bg-[#002888] text-white px-8 py-4 rounded-xl font-bold uppercase tracking-wider hover:bg-blue-900 transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-3 w-full sm:w-auto"
                @click="openModal"
              >
                Book Service
                <span class="material-symbols-outlined text-xl">calendar_month</span>
              </button>
              <NuxtLink
                to="/quote"
                class="bg-white border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold uppercase tracking-wider hover:border-[#002888] hover:text-[#002888] hover:bg-gray-50 transition-colors active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                Speak to Expert
                <span class="material-symbols-outlined text-xl">support_agent</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-32 bg-white rounded-3xl border border-dashed border-gray-200 mt-8">
        <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 class="text-2xl font-black text-slate-900 mb-2">Service Not Found</h2>
        <p class="text-gray-500 font-medium">
          We couldn't locate specific details for the {{ formattedSlug }} service at this time.
        </p>
        <NuxtLink to="/contact" class="inline-block mt-6 text-[#002888] font-bold hover:underline">
          Contact Support &rarr;
        </NuxtLink>
      </div>
    </div>

    <!-- Service Booking Modal -->
    <LazyBookingModal :is-open="isModalOpen" :service-name="currentServiceName" @close="isModalOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// State for the booking modal
const isModalOpen = ref(false)
const currentServiceName = ref('')

const openModal = () => {
  currentServiceName.value = service.value?.NAME || `${formattedSlug.value} Service`
  isModalOpen.value = true
}

const route = useRoute()
const slug = computed(() => (route.params.slug || '').toString().toLowerCase())
const formattedSlug = computed(() => slug.value.replace(/-/g, ' '))

const { data: products, pending } = useFetch('/api/inventory', {
  // Forward the auth cookie so dealers get dealer pricing during SSR.
  headers: useRequestHeaders(['cookie']),
})

const service = computed(() => {
  if (!products.value) return null

  // Find the exact service using the slug keyword directly inside the name
  return products.value.find((p) => {
    const title = (p.NAME || '').toLowerCase()
    return title.includes(slug.value)
  })
})

const localServiceImage = computed(() => {
  if (slug.value.includes('audit')) return '/images/PowerAuditEngineer.png'
  if (slug.value.includes('installation')) return '/images/installation.png'
  if (slug.value.includes('repair')) return '/images/InverterRepairEngineer.png'
  if (slug.value.includes('maintenance')) return '/images/PanelMaintenance.png'
  return null
})

const formatPrice = (price) => {
  if (!price) return '0'
  return Number(price).toLocaleString()
}

// SEO Meta
const titleName = computed(() => {
  const t = formattedSlug.value
  return t.charAt(0).toUpperCase() + t.slice(1)
})

useHead({
  title: `${titleName.value} Service | NovelSolar`,
  meta: [{ name: 'description', content: `Book professional ${titleName.value} services locally with Novel Solar.` }],
})
</script>

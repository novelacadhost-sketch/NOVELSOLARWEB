<template>
  <div class="min-h-screen bg-gray-50 pb-20">
    <ClientOnly>
      <div class="relative h-[40vh] w-full bg-gray-200 overflow-hidden shadow-inner z-[10]">
        <div id="branch-map" class="h-full w-full" />

        <!-- Overlay Badge -->
        <div
          class="absolute bottom-6 left-6 z-[40] bg-white border border-gray-200 p-4 rounded-2xl shadow-xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700"
        >
          <div class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[#002888]">
            <span class="material-symbols-outlined">explore</span>
          </div>
          <div>
            <h1 class="text-xl font-black text-gray-900 uppercase tracking-tighter leading-none mb-1">
              Interactive Map
            </h1>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-widest">
              {{ branches.length }} Outlets Nationwide
            </p>
          </div>
        </div>
      </div>
      <template #fallback>
        <div
          class="h-[40vh] w-full bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 font-bold"
        >
          Loading Interactive Map...
        </div>
      </template>
    </ClientOnly>

    <!-- Content Grid (Ported Stitch UI) -->
    <div class="max-w-[1400px] mx-auto py-12 px-4 md:px-10">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <!-- Left: Locations List -->
        <div class="lg:col-span-12 xl:col-span-7 space-y-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 class="text-3xl font-black text-gray-900 tracking-tight">Explore Our Locations</h2>
              <p class="text-gray-500 font-medium">Find a NovelSolar expert in your city</p>
            </div>

            <div class="relative w-full md:w-80">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                >search</span
              >
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by city or branch name..."
                class="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-white focus:ring-4 focus:ring-[#002888]/10 focus:border-[#002888] outline-none transition-all text-sm font-medium shadow-sm"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[1000px] overflow-y-auto pr-2 custom-scrollbar pb-4">
            <button
              v-for="branch in filteredBranches"
              :key="branch.name"
              class="group p-5 border-2 rounded-2xl transition-all duration-300 flex items-center gap-4 text-left"
              :class="
                selectedBranch.name === branch.name
                  ? 'border-[#002888] bg-[#002888]/5 shadow-xl shadow-[#002888]/10 ring-1 ring-[#002888]'
                  : 'border-gray-100 bg-white hover:bg-white hover:border-gray-200 hover:shadow-md'
              "
              @click="selectBranch(branch)"
            >
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 shadow-sm"
                :class="
                  selectedBranch.name === branch.name
                    ? 'bg-[#002888] text-white'
                    : 'bg-gray-100 text-gray-400 group-hover:bg-[#002888]/10 group-hover:text-[#002888]'
                "
              >
                <span class="material-symbols-outlined">location_on</span>
              </div>
              <div class="flex-1 min-w-0">
                <h3
                  class="font-bold text-gray-900 truncate"
                  :class="selectedBranch.name === branch.name ? 'text-[#002888]' : ''"
                >
                  {{ branch.name }}
                </h3>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">{{ branch.city }}</p>
              </div>
              <div v-if="selectedBranch.name === branch.name" class="text-[#002888]">
                <span class="material-symbols-outlined">verified</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Right: Branch Details Sidebar -->
        <div class="lg:col-span-12 xl:col-span-5 relative">
          <div class="sticky top-24 space-y-6">
            <div
              v-if="selectedBranch"
              class="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 flex flex-col"
            >
              <!-- Card Header / Mini-hero -->
              <div class="h-48 relative bg-gray-900 overflow-hidden">
                <img
                  loading="lazy"
                  src="https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?auto=format&fit=crop&q=80&w=800"
                  alt="Solar Branch"
                  class="w-full h-full object-cover opacity-60 mix-blend-overlay scale-110 group-hover:scale-100 transition-transform duration-1000"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
                <div class="absolute bottom-6 left-8">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span class="text-white text-[10px] font-black uppercase tracking-widest opacity-80"
                      >Outlet Live</span
                    >
                  </div>
                  <h4 class="text-white text-2xl font-black uppercase tracking-tighter leading-tight">
                    {{ selectedBranch.name }}
                  </h4>
                </div>
              </div>

              <!-- Card Content -->
              <div class="p-8 space-y-8">
                <div class="grid gap-6">
                  <!-- Address -->
                  <div class="flex gap-5">
                    <div
                      class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#002888] shrink-0"
                    >
                      <span class="material-symbols-outlined">home_pin</span>
                    </div>
                    <div>
                      <h5 class="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1 text-xs">
                        Address
                      </h5>
                      <p class="text-gray-900 font-bold text-sm leading-relaxed">{{ selectedBranch.address }}</p>
                    </div>
                  </div>

                  <!-- Telephone -->
                  <div class="flex gap-5 border-t border-gray-50 pt-6">
                    <div
                      class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#002888] shrink-0"
                    >
                      <span class="material-symbols-outlined">call</span>
                    </div>
                    <div>
                      <h5 class="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1 text-xs">
                        Telephone
                      </h5>
                      <p class="text-gray-900 font-bold text-sm">{{ selectedBranch.phone }}</p>
                    </div>
                  </div>

                  <!-- Email -->
                  <div class="flex gap-5 border-t border-gray-50 pt-6">
                    <div
                      class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#002888] shrink-0"
                    >
                      <span class="material-symbols-outlined">mail</span>
                    </div>
                    <div>
                      <h5 class="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1 text-xs">Email</h5>
                      <p class="text-gray-900 font-bold text-sm">
                        {{ selectedBranch.email1 }}
                        <span v-if="selectedBranch.email2">and {{ selectedBranch.email2 }}</span>
                      </p>
                    </div>
                  </div>

                  <!-- Business Hours -->
                  <div class="flex gap-5 border-t border-gray-50 pt-6">
                    <div
                      class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#002888] shrink-0"
                    >
                      <span class="material-symbols-outlined">schedule</span>
                    </div>
                    <div>
                      <h5 class="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1 text-xs">
                        Business Hours
                      </h5>
                      <div class="text-sm">
                        <p class="text-gray-900 font-bold">
                          Mon - Fri:
                          <span class="font-medium text-gray-600 ml-2">{{
                            selectedBranch.hoursWeekdays || '08:00 AM - 05:00 PM'
                          }}</span>
                        </p>
                        <p class="text-gray-900 font-bold">
                          Saturday:
                          <span class="font-medium text-gray-600 ml-2">{{
                            selectedBranch.hoursSaturday || '09:00 AM - 02:00 PM'
                          }}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Navigation Action -->
                <div class="pt-6 border-t border-gray-50 flex gap-4">
                  <a
                    :href="
                      'https://www.google.com/maps/dir/?api=1&destination=' +
                      selectedBranch.coords[0] +
                      ',' +
                      selectedBranch.coords[1]
                    "
                    target="_blank"
                    class="flex-1 bg-[#002888] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-900 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                  >
                    <span class="material-symbols-outlined text-lg">directions</span>
                    Start Navigation
                  </a>
                  <button
                    class="w-16 h-16 border-2 border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <span class="material-symbols-outlined">share</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const searchQuery = ref('')

// Initialize locations logic
const branches_list = [...branches]
const headOffice = branches_list.shift()
const [hqLat, hqLon] = headOffice.coordinates

branches_list.sort((a, b) => {
  const distA = getDistance(hqLat, hqLon, a.coordinates[0], a.coordinates[1])
  const distB = getDistance(hqLat, hqLon, b.coordinates[0], b.coordinates[1])
  return distA - distB
})

branches_list.unshift(headOffice)

const selectedBranch = ref(branches_list[0])
const currentMapFocus = ref(branches_list[0].coordinates)

const filteredBranches = computed(() => {
  if (!searchQuery.value) return branches_list
  const q = searchQuery.value.toLowerCase()
  return branches_list.filter(
    (b) => b.name.toLowerCase().includes(q) || b.city.toLowerCase().includes(q) || b.state.toLowerCase().includes(q),
  )
})

// Leaflet is pulled from a CDN <script> at runtime, not bundled, so there is no
// package to take types from. Upgrade path is devDependency @types/leaflet plus
// `typeof import('leaflet')` here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const L: any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let map: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let marker: any = null

const selectBranch = (branch) => {
  selectedBranch.value = branch
  currentMapFocus.value = branch.coords
  if (map) {
    map.flyTo(branch.coords, 14)
    updateMarker(branch)
  }
}

const updateMarker = (branch) => {
  if (typeof L === 'undefined' || !map) return

  if (marker) {
    marker.setLatLng(branch.coords)
  } else {
    marker = L.marker(branch.coords).addTo(map)
  }

  // The directions link routes by address text, not by `coords`. Thirteen
  // branches have coordinates geocoded from their address that resolved only to
  // locality or city centre, so navigating to the pin would send a customer to
  // the wrong part of town; Google resolves the address string far better.
  marker
    .bindPopup(
      `
    <div style="font-family: inherit; padding: 12px; min-width: 180px;">
      <h4 style="margin: 0 0 4px; color: #002888; font-weight: 900; font-size: 14px; text-transform: uppercase;">${branch.name}</h4>
      <p style="margin: 0 0 12px; font-size: 11px; color: #64748b; font-weight: 600;">${branch.city}, ${branch.state}</p>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(branch.address)}"
         target="_blank" 
         style="display: block; background: #002888; color: white; padding: 10px; border-radius: 12px; text-decoration: none; font-size: 10px; font-weight: 900; text-align: center; letter-spacing: 0.1em; text-transform: uppercase;">
         Navigate via Google Maps
      </a>
    </div>
  `,
      { closeButton: false },
    )
    .openPopup()
}

onMounted(() => {
  // Load Leaflet dynamically
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(link)

  const script = document.createElement('script')
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
  script.onload = () => {
    initMap()
  }
  document.head.appendChild(script)
})

const initMap = () => {
  if (typeof L === 'undefined') return

  map = L.map('branch-map', {
    zoomControl: false,
    scrollWheelZoom: false,
  }).setView(selectedBranch.value.coords, 12)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  L.control
    .zoom({
      position: 'bottomright',
    })
    .addTo(map)

  updateMarker(selectedBranch.value)
}

useHead({
  title: 'Our Branches | NovelSolar Network',
  meta: [
    {
      name: 'description',
      content:
        'Explore 28 NovelSolar branch outlets across Nigeria. Get expert solar consultations and premium equipment in your city.',
    },
  ],
})
</script>

<style>
.leaflet-container {
  font-family: inherit;
  filter: grayscale(0.2);
}
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>

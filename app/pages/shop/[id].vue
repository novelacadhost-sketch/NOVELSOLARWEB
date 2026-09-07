<script setup lang="ts">
import type { BitrixProduct } from '~/types'
const route = useRoute()
const { addToCart } = useCart()
const { getProductImage } = useProductImage()
const {
  public: { whatsappNumber },
} = useRuntimeConfig()
const whatsappUrl = computed(() => `https://wa.me/${whatsappNumber}`)
const user = useSupabaseUser()

const {
  data: product,
  pending,
  error,
} = await useFetch<BitrixProduct>(`/api/product/${route.params.id}`, {
  key: `product-${route.params.id}-${user.value?.id || 'guest'}`,
  // Forward the auth cookie so dealers get dealer pricing during SSR.
  headers: useRequestHeaders(['cookie']),
})
const quantity = ref(1)
const activeTab = ref('description')
const selectedImage = ref<string | null>(null)

const parsedSpecs = computed(() => {
  try {
    // 1. Extract the raw string from different possible Bitrix structures
    const rawData = product.value?.PROPERTY_104 as any
    let rawString = ''

    if (!rawData) return []

    if (typeof rawData === 'object') {
      rawString = rawData.value?.TEXT || rawData.value || ''
    } else {
      rawString = String(rawData)
    }

    if (!rawString) return []

    // 2. Decode HTML entities (Bitrix often returns &quot; for quotes in text fields)
    const decodedString = rawString
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')

    // 3. Parse JSON
    return JSON.parse(decodedString)
  } catch (e) {
    console.warn('Failed to parse product specifications:', e)
    return []
  }
})

const galleryImages = computed(() => {
  try {
    const rawData = product.value?.PROPERTY_112 as any
    let rawString = ''

    if (!rawData) return []

    if (typeof rawData === 'object') {
      rawString = rawData.value?.TEXT || rawData.value || ''
    } else {
      rawString = String(rawData)
    }

    if (!rawString) return []

    // Decode HTML entities
    const decodedString = rawString
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')

    const parsed = JSON.parse(decodedString)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn('Failed to parse gallery images:', e)
    return []
  }
})

useHead({
  title: product.value ? `${product.value.NAME} | NovelSolar` : 'Loading Product...',
  meta: [
    {
      name: 'description',
      content: product.value ? `Get the best price on ${product.value.NAME}. Reliable solar inventory on-demand.` : '',
    },
  ],
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mb-20">
    <div v-if="pending" class="py-20 text-center text-slate-500 flex flex-col items-center gap-4">
      <div class="w-12 h-12 border-4 border-blue-100 border-t-[#002888] rounded-full animate-spin" />
      <p class="font-bold text-lg">Loading amazing products...</p>
    </div>

    <div
      v-else-if="error || !product"
      class="py-20 text-center flex flex-col items-center gap-6 bg-white rounded-3xl border border-slate-100 shadow-sm"
    >
      <span class="material-symbols-outlined text-7xl text-red-200">sentiment_very_dissatisfied</span>
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-2">Product Not Found</h2>
        <p class="text-slate-500">The product you are looking for might have been relocated or removed.</p>
      </div>
      <button
        class="bg-[#002888] text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-900 transition-all"
        @click="$router.back()"
      >
        Back to Shop
      </button>
    </div>

    <div v-else>
      <!-- Breadcrumb / Back -->
      <nav class="flex text-sm text-slate-500 mb-8 items-center gap-2">
        <button
          class="hover:text-[#002888] flex items-center gap-1 font-medium transition-colors group"
          @click="$router.back()"
        >
          <span class="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-1"
            >arrow_back</span
          >
          Back to Shop
        </button>
      </nav>

      <!-- Main Product Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        <!-- Left: Image Gallery -->
        <div class="space-y-4">
          <div
            class="aspect-square bg-white rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center shadow-sm relative group"
          >
            <FadeImage
              :src="selectedImage || getProductImage(product)"
              :alt="product.NAME"
              class="w-full h-full absolute inset-0"
              image-class="object-contain p-4 transition-all duration-500 animate-fadeIn"
            />
            <div class="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full shadow-sm text-[#002888]">
              <span class="material-symbols-outlined">zoom_in</span>
            </div>
          </div>
          <!-- Dynamic Gallery Thumbnails -->
          <div v-if="galleryImages.length > 0" class="grid grid-cols-4 gap-4">
            <!-- First thumbnail is the main image -->
            <div
              class="aspect-square rounded-xl bg-white border-2 flex items-center justify-center cursor-pointer overflow-hidden transition-all"
              :class="
                !selectedImage || selectedImage === getProductImage(product)
                  ? 'border-[#002888] shadow-md'
                  : 'border-slate-200 opacity-60 hover:opacity-100'
              "
              @click="selectedImage = getProductImage(product)"
            >
              <FadeImage
                :src="getProductImage(product)"
                class="w-full h-full absolute inset-0"
                image-class="object-cover"
              />
            </div>

            <!-- Loop through extra gallery images -->
            <div
              v-for="(img, index) in galleryImages"
              :key="index"
              class="aspect-square rounded-xl bg-white border-2 flex items-center justify-center cursor-pointer overflow-hidden transition-all"
              :class="
                selectedImage === img ? 'border-[#002888] shadow-md' : 'border-slate-200 opacity-60 hover:opacity-100'
              "
              @click="selectedImage = img"
            >
              <FadeImage :src="img" class="w-full h-full absolute inset-0" image-class="object-cover" />
            </div>
          </div>
        </div>

        <!-- Right: Content -->
        <div class="flex flex-col">
          <div class="mb-6">
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-green-50 text-green-700 mb-3 border border-green-100"
              >In Stock</span
            >
            <h1 class="text-3xl md:text-5xl font-bold text-slate-900 mb-3 leading-tight tracking-tight">
              {{ product?.NAME || 'Loading...' }}
            </h1>

            <div class="flex items-center gap-3 mb-6">
              <div class="flex text-yellow-500 bg-yellow-50 px-2 py-1 rounded-lg">
                <span v-for="i in 5" :key="i" class="material-symbols-outlined text-lg fill-current">star</span>
              </div>
              <span class="text-sm text-slate-400 font-bold border-l pl-3 border-slate-200">124 REVIEWS</span>
            </div>

            <p class="text-4xl md:text-5xl font-black text-[#002888] tracking-tighter">
              ₦ {{ Number(product?.PRICE || 0).toLocaleString() }}
            </p>
          </div>

          <!-- Purchase Controls -->
          <div class="space-y-6">
            <div class="flex flex-col sm:flex-row gap-4">
              <!-- Quantity Selector -->
              <div class="flex items-center border-2 border-slate-100 rounded-2xl overflow-hidden bg-slate-50 h-16">
                <button
                  class="px-6 h-full hover:bg-white hover:text-[#002888] transition-colors font-black text-xl"
                  @click="quantity > 1 ? quantity-- : null"
                >
                  -
                </button>
                <input
                  v-model="quantity"
                  type="number"
                  class="w-14 text-center border-none bg-transparent focus:ring-0 font-black text-lg text-slate-900"
                  readonly
                />
                <button
                  class="px-6 h-full hover:bg-white hover:text-[#002888] transition-colors font-black text-xl"
                  @click="quantity++"
                >
                  +
                </button>
              </div>

              <!-- CTA Button -->
              <button
                class="flex-1 bg-[#002888] text-white h-16 rounded-2xl font-black text-lg shadow-xl shadow-blue-900/20 hover:bg-blue-900 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 active:scale-95"
                @click="addToCart(product, quantity)"
              >
                <span class="material-symbols-outlined">shopping_cart</span>
                ADD TO CART
              </button>
            </div>

            <!-- WhatsApp Direct -->
            <a
              :href="whatsappUrl"
              target="_blank"
              class="group bg-[#25D366]/5 border-2 border-[#25D366]/10 p-5 rounded-2xl flex items-center gap-5 hover:bg-[#25D366]/10 hover:border-[#25D366]/30 transition-all"
            >
              <div
                class="w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center text-white shrink-0 shadow-lg shadow-green-500/20 transition-transform group-hover:scale-110"
              >
                <span class="material-symbols-outlined text-2xl">chat</span>
              </div>
              <div>
                <p class="text-[10px] font-black text-[#25D366] uppercase tracking-widest mb-0.5">Instant Assistance</p>
                <p class="text-xl md:text-2xl font-black text-slate-800">WhatsApp to Order</p>
              </div>
              <span
                class="material-symbols-outlined ml-auto text-[#25D366] opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1"
                >arrow_forward</span
              >
            </a>
          </div>

          <!-- Product Details Tabs -->
          <div class="mt-12 border-t border-slate-100 pt-8">
            <div class="flex gap-8 mb-6 border-b border-slate-50">
              <button
                class="pb-4 text-sm font-black uppercase transition-all duration-200"
                :class="
                  activeTab === 'description'
                    ? 'border-b-2 border-[#002888] text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                "
                @click="activeTab = 'description'"
              >
                Description
              </button>
              <button
                class="pb-4 text-sm font-black uppercase transition-all duration-200"
                :class="
                  activeTab === 'specs'
                    ? 'border-b-2 border-[#002888] text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                "
                @click="activeTab = 'specs'"
              >
                Specifications
              </button>
              <button
                class="pb-4 text-sm font-black uppercase transition-all duration-200"
                :class="
                  activeTab === 'downloads'
                    ? 'border-b-2 border-[#002888] text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                "
                @click="activeTab = 'downloads'"
              >
                Downloads
              </button>
            </div>

            <!-- Description Tab -->
            <div v-if="activeTab === 'description'" class="animate-fadeIn">
              <div
                class="prose max-w-none text-slate-600 text-sm md:text-base leading-relaxed mb-8"
                v-html="product?.DESCRIPTION || product?.DETAIL_TEXT || 'Full product description coming soon.'"
              />
            </div>

            <!-- Specifications Tab -->
            <div v-if="activeTab === 'specs'" class="animate-fadeIn">
              <div v-if="parsedSpecs && parsedSpecs.length > 0">
                <h3 class="text-lg font-bold text-slate-900 mb-4">Technical Specifications</h3>
                <div class="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table class="w-full text-left border-collapse">
                    <tbody>
                      <tr
                        v-for="(spec, index) in parsedSpecs"
                        :key="index"
                        :class="index !== parsedSpecs.length - 1 ? 'border-b border-slate-200' : ''"
                      >
                        <th
                          class="w-1/3 py-4 px-5 bg-slate-50 font-bold text-sm text-slate-700 border-r border-slate-200"
                        >
                          {{ spec.label }}
                        </th>
                        <td class="py-4 px-5 text-sm text-slate-600 bg-white">{{ spec.value }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div v-else class="py-12 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-200">
                <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">list_alt</span>
                <p class="text-slate-500 font-medium">No technical specifications available for this product.</p>
              </div>
            </div>

            <!-- Downloads Tab -->
            <div v-if="activeTab === 'downloads'" class="animate-fadeIn">
              <div class="py-12 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-200">
                <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">download</span>
                <p class="text-slate-500 font-medium">Manuals and data sheets will be available soon.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Customer Reviews Section -->
      <section class="mb-16 pt-16 border-t border-slate-100">
        <div class="flex items-center justify-between mb-10">
          <div>
            <h2 class="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Customer Reviews</h2>
            <p class="text-slate-500 text-sm font-medium">Real feedback from verified solar users.</p>
          </div>
          <button
            class="hidden sm:block px-8 py-3 rounded-xl border-2 border-slate-100 font-black text-slate-700 hover:bg-slate-50 hover:border-slate-200 transition-all text-sm uppercase tracking-wider"
          >
            Write a Review
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <!-- Summary Card -->
          <div
            class="bg-gradient-to-br from-[#002888] to-blue-900 p-10 rounded-3xl text-center flex flex-col justify-center text-white shadow-xl shadow-blue-900/10"
          >
            <p class="text-7xl font-black mb-2 tracking-tighter">4.8</p>
            <div class="flex justify-center text-blue-200 mb-3">
              <span v-for="i in 5" :key="i" class="material-symbols-outlined text-2xl fill-current">star</span>
            </div>
            <p class="text-blue-100 font-bold uppercase tracking-widest text-xs">Based on 124 ratings</p>
          </div>

          <!-- Reviews List -->
          <div class="md:col-span-2 space-y-6">
            <div
              v-for="i in 2"
              :key="i"
              class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm transition-transform hover:scale-[1.01] duration-300"
            >
              <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400"
                  >
                    V
                  </div>
                  <div>
                    <h4 class="font-black text-slate-900 uppercase text-xs tracking-wider">Verified Buyer</h4>
                    <div class="flex text-yellow-500 text-xs">
                      <span v-for="s in 5" :key="s" class="material-symbols-outlined text-sm fill-current">star</span>
                    </div>
                  </div>
                </div>
                <span class="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Recent Purchase</span>
              </div>
              <p class="text-slate-600 text-sm md:text-base leading-relaxed italic">
                "Excellent product quality and fast delivery. Highly recommend for residential use in regions with
                unstable grid power."
              </p>
            </div>

            <button
              class="w-full py-4 text-[#002888] font-black uppercase text-xs tracking-widest hover:bg-blue-50 rounded-2xl transition-all"
            >
              See All 124 Reviews &rarr;
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 600,
    'GRAD' 0,
    'opsz' 24;
}
.material-symbols-outlined.fill-current {
  font-variation-settings:
    'FILL' 1,
    'wght' 600,
    'GRAD' 0,
    'opsz' 24;
}

/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

/* Firefox */
input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fadeIn {
  animation: fadeIn 0.3s ease-out forwards;
}
</style>

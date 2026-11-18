<script setup lang="ts">
import type { BitrixProduct } from '~/types'
import { categoryGroupsFor, groupIdForSection } from '#shared/productCategories'

interface CompareProduct {
  id: string
  name: string
  price: number
  dealerPrice: number | null
  lowStock: boolean
  imageUrl: string | null
  [key: string]: unknown
}
interface CompareResult {
  group: { id: string; name: string; sections: string[] }
  products: CompareProduct[]
  rows: { label: string; values: (string | null)[] }[]
}

const props = defineProps<{
  open: boolean
  productId: string
  productName: string
  sectionName: string | null | undefined
}>()
const emit = defineEmits<{ close: [] }>()

const MAX_OTHERS = 2
const PAGE = 50

const site = useSite()
const { getProductImage } = useProductImage()

const group = computed(() => {
  const id = groupIdForSection(props.sectionName, site.id)
  return categoryGroupsFor(site.id).find((g) => g.id === id) ?? null
})

const step = ref<'pick' | 'compare'>('pick')
const selected = ref<string[]>([])
const search = ref('')
const candidates = ref<BitrixProduct[]>([])
const candidatesLoading = ref(false)
const candidatesError = ref('')
const hasMore = ref(false)
const result = ref<CompareResult | null>(null)
const compareLoading = ref(false)
const compareError = ref('')
const differencesOnly = ref(false)

// Names of picked products, kept even when a search hides them from the list.
const pickedNames = ref<Record<string, string>>({})

let requestId = 0
async function loadCandidates(reset: boolean) {
  if (!group.value) return
  const id = ++requestId
  candidatesLoading.value = true
  candidatesError.value = ''
  try {
    const start = reset ? 0 : candidates.value.length
    const page = await $fetch<BitrixProduct[]>('/api/inventory', {
      query: { sections: group.value.sections.join(','), q: search.value.trim() || undefined, start },
    })
    if (id !== requestId) return
    const list = (page ?? []).filter((p) => String(p.ID) !== props.productId)
    candidates.value = reset ? list : [...candidates.value, ...list]
    hasMore.value = (page ?? []).length === PAGE
  } catch {
    if (id === requestId) candidatesError.value = 'Could not load products. Please try again.'
  } finally {
    if (id === requestId) candidatesLoading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadCandidates(true), 300)
})

function toggle(p: BitrixProduct) {
  const id = String(p.ID)
  if (selected.value.includes(id)) {
    selected.value = selected.value.filter((s) => s !== id)
  } else if (selected.value.length < MAX_OTHERS) {
    selected.value = [...selected.value, id]
    pickedNames.value[id] = p.NAME
  }
}

async function runCompare() {
  step.value = 'compare'
  compareLoading.value = true
  compareError.value = ''
  try {
    result.value = await $fetch<CompareResult>('/api/compare', {
      query: { ids: [props.productId, ...selected.value].join(',') },
    })
  } catch {
    compareError.value = 'Could not load the comparison. Please try again.'
  } finally {
    compareLoading.value = false
  }
}

function removeFromCompare(id: string) {
  selected.value = selected.value.filter((s) => s !== id)
  if (!selected.value.length) {
    step.value = 'pick'
    return
  }
  runCompare()
}

const visibleRows = computed(() => {
  const rows = result.value?.rows ?? []
  if (!differencesOnly.value) return rows
  const norm = (v: string | null) => (v ?? '').trim().toLowerCase()
  return rows.filter((row) => new Set(row.values.map(norm)).size > 1)
})

const formatNaira = (n: number) => `₦${n.toLocaleString()}`

function close() {
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) close()
}

watch(
  () => props.open,
  (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open && !candidates.value.length && !candidatesLoading.value) loadCandidates(true)
  },
)

// The page component is reused when moving between products.
watch(
  () => props.productId,
  () => {
    step.value = 'pick'
    selected.value = []
    search.value = ''
    candidates.value = []
    result.value = null
  },
)

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  clearTimeout(searchTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm"
      @click.self="close"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-heading"
        class="bg-white w-full sm:max-w-5xl h-[92vh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <!-- Header -->
        <div class="flex items-start gap-3 px-4 sm:px-6 py-4 border-b border-slate-100">
          <button
            v-if="step === 'compare'"
            class="shrink-0 p-2 -ml-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Change products"
            @click="step = 'pick'"
          >
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="min-w-0 flex-1">
            <h2 id="compare-heading" class="text-lg sm:text-xl font-black text-slate-900">
              {{ step === 'pick' ? 'Compare with' : 'Comparison' }}
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 truncate">
              <template v-if="step === 'pick'">
                Pick up to {{ MAX_OTHERS }} {{ group ? group.name.toLowerCase() : 'products' }} to compare with
                {{ productName }}
              </template>
              <template v-else-if="result">{{ result.group.name }}</template>
            </p>
          </div>
          <button
            class="shrink-0 p-2 -mr-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close comparison"
            @click="close"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Step 1: pick products -->
        <template v-if="step === 'pick'">
          <div v-if="!group" class="p-8 text-center text-slate-500">
            This product cannot be compared with others.
          </div>
          <template v-else>
            <div class="px-4 sm:px-6 pt-4">
              <label class="relative block">
                <span class="sr-only">Search {{ group.name }}</span>
                <span
                  class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl"
                  >search</span
                >
                <input
                  v-model="search"
                  type="search"
                  :placeholder="`Search ${group.name.toLowerCase()}`"
                  class="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-[#002888] focus:ring-0"
                >
              </label>
              <div v-if="selected.length" class="flex flex-wrap gap-2 mt-3">
                <button
                  v-for="id in selected"
                  :key="id"
                  class="inline-flex items-center gap-1 max-w-full rounded-full bg-blue-50 text-[#002888] text-xs font-bold pl-3 pr-2 py-1"
                  @click="selected = selected.filter((s) => s !== id)"
                >
                  <span class="truncate">{{ pickedNames[id] }}</span>
                  <span class="material-symbols-outlined text-base" aria-label="Remove">close</span>
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-3">
              <p v-if="candidatesError" class="py-8 text-center text-sm text-red-600">{{ candidatesError }}</p>
              <p
                v-else-if="!candidatesLoading && !candidates.length"
                class="py-8 text-center text-sm text-slate-500"
              >
                No other {{ group.name.toLowerCase() }} found{{ search ? ` for “${search}”` : '' }}.
              </p>
              <ul class="divide-y divide-slate-100">
                <li v-for="p in candidates" :key="p.ID">
                  <button
                    class="w-full flex items-center gap-3 py-3 text-left disabled:opacity-40"
                    :disabled="!selected.includes(String(p.ID)) && selected.length >= MAX_OTHERS"
                    :aria-pressed="selected.includes(String(p.ID))"
                    @click="toggle(p)"
                  >
                    <span
                      class="shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center"
                      :class="
                        selected.includes(String(p.ID)) ? 'bg-[#002888] border-[#002888] text-white' : 'border-slate-300'
                      "
                    >
                      <span v-if="selected.includes(String(p.ID))" class="material-symbols-outlined text-base"
                        >check</span
                      >
                    </span>
                    <img
                      :src="getProductImage(p)"
                      alt=""
                      loading="lazy"
                      class="shrink-0 w-12 h-12 object-contain rounded-lg border border-slate-100 bg-white"
                    >
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold text-slate-900 line-clamp-2">{{ p.NAME }}</span>
                      <span v-if="p.dealerPrice" class="block text-sm font-black text-green-600">
                        {{ formatNaira(Number(p.dealerPrice)) }}
                        <span class="text-xs font-semibold text-slate-400 line-through ml-1">{{
                          formatNaira(Number(p.PRICE || 0))
                        }}</span>
                      </span>
                      <span v-else-if="Number(p.PRICE) > 0" class="block text-sm font-black text-slate-700">{{
                        formatNaira(Number(p.PRICE))
                      }}</span>
                    </span>
                  </button>
                </li>
              </ul>
              <div v-if="candidatesLoading" class="py-6 flex justify-center">
                <div class="w-8 h-8 border-4 border-blue-100 border-t-[#002888] rounded-full animate-spin" />
              </div>
              <button
                v-else-if="hasMore"
                class="w-full my-3 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                @click="loadCandidates(false)"
              >
                Load more
              </button>
            </div>

            <div class="px-4 sm:px-6 py-4 border-t border-slate-100">
              <button
                class="w-full h-12 rounded-xl bg-[#002888] text-white font-black disabled:bg-slate-200 disabled:text-slate-400"
                :disabled="!selected.length"
                @click="runCompare"
              >
                Compare {{ selected.length + 1 }} products
              </button>
            </div>
          </template>
        </template>

        <!-- Step 2: comparison -->
        <div v-else class="flex-1 overflow-y-auto">
          <div v-if="compareLoading" class="py-20 flex justify-center">
            <div class="w-10 h-10 border-4 border-blue-100 border-t-[#002888] rounded-full animate-spin" />
          </div>
          <div v-else-if="compareError" class="py-12 px-6 text-center">
            <p class="text-sm text-red-600 mb-4">{{ compareError }}</p>
            <button class="px-6 py-3 rounded-xl bg-[#002888] text-white font-bold" @click="runCompare">
              Try again
            </button>
          </div>
          <div v-else-if="result" class="px-3 sm:px-6 pb-6">
            <!-- Products -->
            <div
              class="cmp-grid sticky top-0 z-10 bg-white pt-4 pb-3 border-b border-slate-100 gap-2 sm:gap-4"
              :style="{ '--n': result.products.length }"
            >
              <div class="hidden md:flex items-end">
                <label class="inline-flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                  <input v-model="differencesOnly" type="checkbox" class="rounded text-[#002888]">
                  Differences only
                </label>
              </div>
              <div v-for="p in result.products" :key="p.id" class="relative flex flex-col min-w-0">
                <button
                  v-if="p.id !== productId"
                  class="absolute top-0 right-0 z-10 w-7 h-7 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center"
                  :aria-label="`Remove ${p.name}`"
                  @click="removeFromCompare(p.id)"
                >
                  <span class="material-symbols-outlined text-base">close</span>
                </button>
                <div class="h-20 md:h-32 rounded-xl border border-slate-100 bg-white overflow-hidden mb-2">
                  <img :src="getProductImage(p)" :alt="p.name" class="w-full h-full object-contain p-1.5">
                </div>
                <span
                  v-if="p.id === productId"
                  class="self-start mb-1 text-[10px] font-black uppercase tracking-wider text-[#002888] bg-blue-50 rounded px-1.5 py-0.5"
                  >This product</span
                >
                <NuxtLink
                  :to="`/shop/${p.id}`"
                  class="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-3 hover:text-[#002888] break-words"
                  @click="close"
                >
                  {{ p.name }}
                </NuxtLink>
                <div class="mt-1">
                  <template v-if="p.dealerPrice">
                    <span class="block text-sm sm:text-base font-black text-green-600">{{
                      formatNaira(p.dealerPrice)
                    }}</span>
                    <span class="block text-[11px] sm:text-xs font-semibold text-slate-400 line-through">{{
                      formatNaira(p.price)
                    }}</span>
                  </template>
                  <span v-else-if="p.price > 0" class="block text-sm sm:text-base font-black text-slate-900">{{
                    formatNaira(p.price)
                  }}</span>
                  <span v-else class="block text-xs text-slate-500">Ask for price</span>
                </div>
              </div>
            </div>

            <label class="md:hidden flex items-center gap-2 text-sm font-bold text-slate-600 py-3 cursor-pointer">
              <input v-model="differencesOnly" type="checkbox" class="rounded text-[#002888]">
              Differences only
            </label>

            <!-- Specs -->
            <p v-if="!result.rows.length" class="py-8 text-center text-sm text-slate-500">
              No specifications are listed for these products yet.
            </p>
            <p v-else-if="!visibleRows.length" class="py-8 text-center text-sm text-slate-500">
              These products list the same specifications.
            </p>
            <div
              v-for="(row, index) in visibleRows"
              :key="row.label"
              class="cmp-grid gap-x-2 sm:gap-x-4 py-2.5 border-b border-slate-100 text-xs sm:text-sm"
              :class="index % 2 ? '' : 'md:bg-slate-50/60'"
              :style="{ '--n': row.values.length }"
            >
              <div class="cmp-label font-bold text-slate-500 md:text-slate-700 md:pl-2 mb-1 md:mb-0">
                {{ row.label }}
              </div>
              <div v-for="(value, i) in row.values" :key="i" class="min-w-0 break-words text-slate-800">
                <span v-if="value">{{ value }}</span>
                <span v-else class="text-slate-300" aria-label="Not listed">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 600,
    'GRAD' 0,
    'opsz' 24;
}
.cmp-grid {
  display: grid;
  grid-template-columns: repeat(var(--n), minmax(0, 1fr));
}
.cmp-label {
  grid-column: 1 / -1;
}
@media (min-width: 768px) {
  .cmp-grid {
    grid-template-columns: 11rem repeat(var(--n), minmax(0, 1fr));
  }
  .cmp-label {
    grid-column: auto;
  }
}
</style>

<script setup lang="ts">
import type { PromotionScope, PromotionTarget } from '#shared/promotionTarget'

/**
 * "Applies to" for a promotion: every product, some Bitrix sections, or
 * hand-picked products. Used by the staff-code discount and each promo code.
 */
const props = defineProps<{
  modelValue: PromotionTarget
  /** Every section name a promotion can target. */
  sections: string[]
  /** Names for product ids already selected, from the page's load. */
  productNames: Record<string, string>
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: PromotionTarget] }>()

const names = reactive<Record<string, string>>({ ...props.productNames })
watch(
  () => props.productNames,
  (next) => Object.assign(names, next),
)

function update(patch: Partial<PromotionTarget>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function setScope(appliesTo: PromotionScope) {
  update({ appliesTo })
}

function toggleSection(name: string) {
  const current = props.modelValue.sections
  update({ sections: current.includes(name) ? current.filter((s) => s !== name) : [...current, name] })
}

const sectionFilter = ref('')
const visibleSections = computed(() => {
  const term = sectionFilter.value.trim().toLowerCase()
  return term ? props.sections.filter((s) => s.toLowerCase().includes(term)) : props.sections
})

// Product search, through the same endpoint the product editor uses.
const query = ref('')
const results = ref<{ id: string; name: string }[]>([])
const searching = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
watch(query, (q) => {
  if (timer) clearTimeout(timer)
  if (q.trim().length < 2) {
    results.value = []
    return
  }
  timer = setTimeout(() => search(q.trim()), 300)
})

async function search(q: string) {
  searching.value = true
  try {
    const res = await useNuxtApp().$apiFetch<{ products: { id: string | number; name: string }[] }>(
      '/api/admin/search-products',
      { method: 'POST', body: { query: q } },
    )
    // Answers can arrive out of order; keep only the one for what is typed now.
    if (q !== query.value.trim()) return
    results.value = (res.products ?? []).map((p) => ({ id: String(p.id), name: p.name }))
  } catch {
    results.value = []
  } finally {
    searching.value = false
  }
}

function addProduct(p: { id: string; name: string }) {
  names[p.id] = p.name
  if (!props.modelValue.productIds.includes(p.id)) update({ productIds: [...props.modelValue.productIds, p.id] })
}

function removeProduct(id: string) {
  update({ productIds: props.modelValue.productIds.filter((p) => p !== id) })
}

const scopes: { value: PromotionScope; label: string }[] = [
  { value: 'all', label: 'All products' },
  { value: 'sections', label: 'Selected sections' },
  { value: 'products', label: 'Selected products' },
]
</script>

<template>
  <fieldset :disabled="disabled" class="rounded-xl border border-slate-200 p-4">
    <legend class="px-1 text-xs font-bold uppercase text-slate-500">Applies to</legend>

    <div class="flex flex-wrap gap-4">
      <label v-for="s in scopes" :key="s.value" class="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="radio"
          :checked="modelValue.appliesTo === s.value"
          class="h-4 w-4"
          @change="setScope(s.value)"
        >
        {{ s.label }}
      </label>
    </div>

    <!-- Sections -->
    <div v-if="modelValue.appliesTo === 'sections'" class="mt-4">
      <p v-if="!sections.length" class="text-xs text-amber-700">
        The section list could not be loaded from Bitrix. Reload the page to try again.
      </p>
      <template v-else>
        <input
          v-model="sectionFilter"
          type="search"
          placeholder="Filter sections"
          class="mb-3 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
        <div class="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          <label
            v-for="name in visibleSections"
            :key="name"
            class="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              :checked="modelValue.sections.includes(name)"
              class="h-4 w-4"
              @change="toggleSection(name)"
            >
            {{ name }}
          </label>
        </div>
        <p class="mt-2 text-xs text-slate-500">{{ modelValue.sections.length }} selected.</p>
      </template>
    </div>

    <!-- Products -->
    <div v-if="modelValue.appliesTo === 'products'" class="mt-4">
      <div v-if="modelValue.productIds.length" class="mb-3 flex flex-wrap gap-2">
        <span
          v-for="id in modelValue.productIds"
          :key="id"
          class="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs font-medium text-slate-700"
        >
          {{ names[id] || `Product #${id}` }}
          <button
            type="button"
            class="rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            :aria-label="`Remove ${names[id] || id}`"
            @click="removeProduct(id)"
          >
            ✕
          </button>
        </span>
      </div>
      <input
        v-model="query"
        type="search"
        placeholder="Search products by name to add"
        class="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
      <p v-if="searching" class="mt-2 text-xs text-slate-500">Searching…</p>
      <ul v-else-if="results.length" class="mt-2 max-h-56 max-w-md overflow-y-auto rounded-lg border border-slate-200">
        <li v-for="p in results" :key="p.id" class="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-0">
          <span class="text-sm text-slate-700">{{ p.name }}</span>
          <button
            type="button"
            class="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
            :disabled="modelValue.productIds.includes(p.id)"
            @click="addProduct(p)"
          >
            {{ modelValue.productIds.includes(p.id) ? 'Added' : 'Add' }}
          </button>
        </li>
      </ul>
      <p v-else-if="query.trim().length >= 2" class="mt-2 text-xs text-slate-500">No products match.</p>
    </div>

    <p v-if="modelValue.appliesTo !== 'all'" class="mt-3 text-xs text-slate-500">
      Only these products are discounted. The minimum order and maximum discount count only these products too.
    </p>
  </fieldset>
</template>

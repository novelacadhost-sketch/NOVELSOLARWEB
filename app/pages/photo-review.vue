<script setup lang="ts">
import { photoReviewHostAllowed } from '#shared/photoReviewHosts'
// Supplier-facing tool for identifying the bulk photo dump. Staging only --
// the endpoints 404 on any other host, see server/utils/photoReview.ts.
interface Product {
  id: string
  name: string
  section: string | null
  hasImage: boolean
}
interface ManifestEntry {
  file: string
  thumb: string
  base: string
  folder: string
  group: string
  sizeKb: number
}
interface Choice {
  productIds: string[]
  role: 'main' | 'gallery' | 'unknown' | 'not_a_product'
  note: string
  dirty?: boolean
}

definePageMeta({
  layout: 'default',
  // The endpoints already 404 off staging, but without this the page itself
  // would still render on novelsolar.com and ask a customer for their name
  // before failing. Runs on the server too, so production never ships it.
  middleware: [
    () => {
      if (!photoReviewHostAllowed(useRequestURL().host)) {
        return abortNavigation(createError({ statusCode: 404, statusMessage: 'Page not found' }))
      }
    },
  ],
})
useHead({ title: 'Photo review', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const route = useRoute()
const token = computed(() => String(route.query.k || ''))
// Thumbnails ship as static assets rather than from a storage bucket: 11 MB of
// WebP built from 2.8 GB of originals, deployed with the app so there is no
// second place to provision, and one folder to delete when the review is done.
const thumbBase = '/photo-review/thumbs'

const reviewer = ref('')
const products = ref<Product[]>([])
const manifest = ref<ManifestEntry[]>([])
const choices = reactive<Record<string, Choice>>({})
const othersByFile = reactive<Record<string, string[]>>({})
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const savedAt = ref('')

const PAGE_SIZE = 48
const filter = ref<'todo' | 'mine' | 'all'>('todo')
const folderFilter = ref('')
const search = ref('')
const page = ref(0)

onMounted(() => {
  reviewer.value = localStorage.getItem('photo-review-reviewer') || ''
})
watch(reviewer, (v) => localStorage.setItem('photo-review-reviewer', v))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [data, list] = await Promise.all([
      $fetch<{ products: Product[]; choices: { file: string; reviewer: string; productIds: string[]; role: Choice['role']; note: string | null }[] }>(
        '/api/photo-review/data',
        { query: { k: token.value } },
      ),
      $fetch<ManifestEntry[]>(`${thumbBase}/_manifest.json`),
    ])
    products.value = data.products
    manifest.value = list
    for (const c of data.choices) {
      if (c.reviewer === reviewer.value) {
        choices[c.file] = { productIds: c.productIds, role: c.role, note: c.note || '' }
      } else {
        ;(othersByFile[c.file] ||= []).push(c.reviewer)
      }
    }
  } catch (error) {
    loadError.value =
      (error as { statusMessage?: string })?.statusMessage ||
      'Could not load. Check the link is complete, including the part after ?k='
  } finally {
    loading.value = false
  }
}

const started = ref(false)
function start() {
  if (reviewer.value.trim().length < 2) return
  started.value = true
  load()
}

const folders = computed(() => {
  const set = new Set<string>()
  for (const m of manifest.value) set.add(m.folder || 'Loose photos')
  return [...set].sort()
})

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return manifest.value.filter((m) => {
    const mine = choices[m.file]
    if (filter.value === 'todo' && mine) return false
    if (filter.value === 'mine' && !mine) return false
    if (folderFilter.value && (m.folder || 'Loose photos') !== folderFilter.value) return false
    if (q && !m.file.toLowerCase().includes(q)) return false
    return true
  })
})

const paged = computed(() => visible.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE))
const pageCount = computed(() => Math.max(1, Math.ceil(visible.value.length / PAGE_SIZE)))
watch([filter, folderFilter, search], () => (page.value = 0))

const answered = computed(() => Object.keys(choices).length)

// --- product picker -------------------------------------------------------
const openPicker = ref('')
const pickerQuery = ref('')

function cleanName(base: string) {
  return base
    .replace(/\(\d+\)|copy|_upscayl.*$|-Photoroom/gi, '')
    .replace(/[_-]+/g, ' ')
    .trim()
}

const pickerResults = computed(() => {
  const q = pickerQuery.value.trim().toLowerCase()
  if (!q) return products.value.slice(0, 40)
  const terms = q.split(/\s+/).filter(Boolean)
  return products.value
    .filter((p) => {
      const n = p.name.toLowerCase()
      return terms.every((t) => n.includes(t))
    })
    .slice(0, 40)
})

function ensure(file: string): Choice {
  return (choices[file] ||= { productIds: [], role: 'main', note: '', dirty: true })
}

function addProduct(file: string, product: Product) {
  const c = ensure(file)
  if (!c.productIds.includes(product.id)) c.productIds.push(product.id)
  // A product that already has a main photo almost always wants this as an
  // extra angle rather than a replacement.
  if (product.hasImage && c.role === 'main') c.role = 'gallery'
  c.dirty = true
  openPicker.value = ''
  pickerQuery.value = ''
  queueSave()
}

function removeProduct(file: string, id: string) {
  const c = choices[file]
  if (!c) return
  c.productIds = c.productIds.filter((x) => x !== id)
  c.dirty = true
  if (!c.productIds.length && (c.role === 'main' || c.role === 'gallery')) Reflect.deleteProperty(choices, file)
  queueSave()
}

function setRole(file: string, role: Choice['role']) {
  // "Main photo" and "Extra angle" are meaningless without a product, and the
  // server drops such a row -- so taking the click would mark the card green
  // and count it as answered while nothing was ever saved. Send them to the
  // picker instead.
  if ((role === 'main' || role === 'gallery') && !choices[file]?.productIds.length) {
    openPicker.value = file
    const entry = manifest.value.find((m) => m.file === file)
    pickerQuery.value = entry ? cleanName(entry.base) : ''
    return
  }
  const c = ensure(file)
  c.role = role
  if (role === 'unknown' || role === 'not_a_product') c.productIds = []
  c.dirty = true
  queueSave()
}

function copyPrevious(index: number) {
  const list = paged.value
  for (let i = index - 1; i >= 0; i--) {
    const prev = choices[list[i]!.file]
    if (prev && prev.productIds.length) {
      const c = ensure(list[index]!.file)
      c.productIds = [...prev.productIds]
      c.role = 'gallery'
      c.dirty = true
      queueSave()
      return
    }
  }
}

function productName(id: string) {
  return products.value.find((p) => p.id === id)?.name || id
}

// --- saving ---------------------------------------------------------------
let saveTimer: ReturnType<typeof setTimeout> | null = null
function queueSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 1200)
}

async function save() {
  const items = Object.entries(choices)
    .filter(([, c]) => c.dirty)
    .map(([file, c]) => ({ file, productIds: c.productIds, role: c.role, note: c.note }))
  if (!items.length || saving.value) return
  saving.value = true
  try {
    // $apiFetch, not $fetch: every mutating /api/ request goes through the CSRF
    // middleware, and a plain $fetch carries no x-csrf-token, so each save
    // would 403 and the reviewer's answers would never leave the browser.
    const { $apiFetch } = useNuxtApp()
    for (let i = 0; i < items.length; i += 200) {
      await $apiFetch('/api/photo-review/save', {
        method: 'POST',
        query: { k: token.value },
        body: { reviewer: reviewer.value.trim(), items: items.slice(i, i + 200) },
      })
    }
    for (const item of items) {
      const c = choices[item.file]
      if (c) c.dirty = false
    }
    savedAt.value = new Date().toLocaleTimeString()
  } catch {
    savedAt.value = 'not saved — will retry'
    queueSave()
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-4 sm:p-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-2xl font-bold text-slate-900">Which product is this photo?</h1>
      <p class="text-slate-500 mt-1 mb-6 max-w-2xl">
        Pick the product each picture belongs to. Your answers save by themselves — you can close the page and come
        back. If you cannot tell what a photo is, mark it <b>Not sure</b> and move on.
      </p>

      <!-- name gate -->
      <div v-if="!started" class="bg-white rounded-2xl border border-slate-200 p-6 max-w-md">
        <label class="block text-sm font-semibold text-slate-700 mb-2">Your name</label>
        <input
          v-model="reviewer"
          class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none focus:border-slate-400"
          placeholder="e.g. Tunde"
          @keyup.enter="start"
        >
        <p class="text-xs text-slate-500 mt-2">So we know who identified what, and so two people don't clash.</p>
        <button
          class="mt-4 w-full rounded-lg bg-slate-900 text-white font-semibold p-3 disabled:opacity-40"
          :disabled="reviewer.trim().length < 2"
          @click="start"
        >
          Start
        </button>
      </div>

      <template v-else>
        <div v-if="loadError" class="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 mb-6">
          {{ loadError }}
        </div>
        <div v-else-if="loading" class="text-slate-500">Loading photos…</div>

        <template v-else>
          <!-- toolbar -->
          <div
            class="sticky top-0 z-10 bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center"
          >
            <div class="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                v-for="f in (['todo', 'mine', 'all'] as const)"
                :key="f"
                class="px-3 py-1.5 rounded-md text-sm font-medium capitalize"
                :class="filter === f ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'"
                @click="filter = f"
              >
                {{ f === 'todo' ? 'Not done' : f === 'mine' ? 'My answers' : 'All' }}
              </button>
            </div>
            <select v-model="folderFilter" class="rounded-lg border border-slate-200 p-2 text-sm">
              <option value="">All folders</option>
              <option v-for="f in folders" :key="f" :value="f">{{ f }}</option>
            </select>
            <input
              v-model="search"
              placeholder="Search file name…"
              class="rounded-lg border border-slate-200 p-2 text-sm flex-1 min-w-[160px]"
            >
            <div class="text-sm text-slate-500 ml-auto">
              <b class="text-slate-900">{{ answered }}</b> of {{ manifest.length }} answered
              <span v-if="saving" class="ml-2 text-amber-600">saving…</span>
              <span v-else-if="savedAt" class="ml-2 text-emerald-600">saved {{ savedAt }}</span>
            </div>
          </div>

          <div v-if="!visible.length" class="text-slate-500 bg-white border border-slate-200 rounded-2xl p-8 text-center">
            Nothing left here. Try another folder, or switch to “All”.
          </div>

          <!-- grid -->
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="(m, i) in paged"
              :key="m.file"
              class="bg-white rounded-2xl border p-3"
              :class="choices[m.file] ? 'border-emerald-300' : 'border-slate-200'"
            >
              <a :href="`${thumbBase}/${m.thumb}`" target="_blank" rel="noopener">
                <img
                  :src="`${thumbBase}/${m.thumb}`"
                  :alt="m.base"
                  loading="lazy"
                  class="w-full h-44 object-contain bg-slate-50 rounded-xl"
                >
              </a>
              <p class="text-xs text-slate-400 mt-2 truncate" :title="m.file">
                <span v-if="m.group">[{{ m.group }}] </span>{{ m.base }}
              </p>
              <p v-if="othersByFile[m.file]" class="text-[11px] text-amber-600 mt-0.5">
                also answered by {{ othersByFile[m.file]!.join(', ') }}
              </p>

              <!-- chosen products -->
              <div v-if="choices[m.file]?.productIds.length" class="mt-2 space-y-1">
                <div
                  v-for="id in choices[m.file]!.productIds"
                  :key="id"
                  class="flex items-start gap-2 bg-emerald-50 rounded-lg px-2 py-1"
                >
                  <span class="text-xs text-emerald-900 flex-1">{{ productName(id) }}</span>
                  <button class="text-emerald-700 text-xs font-bold" @click="removeProduct(m.file, id)">×</button>
                </div>
              </div>

              <!-- picker -->
              <div class="mt-2 relative">
                <button
                  v-if="openPicker !== m.file"
                  class="w-full text-left text-sm rounded-lg border border-slate-200 px-3 py-2 text-slate-500 hover:border-slate-400"
                  @click="
                    openPicker = m.file;
                    pickerQuery = cleanName(m.base)
                  "
                >
                  {{ choices[m.file]?.productIds.length ? '+ another product' : 'Choose product…' }}
                </button>
                <div v-else class="border border-slate-300 rounded-lg overflow-hidden">
                  <input
                    v-model="pickerQuery"
                    autofocus
                    placeholder="Type to search products"
                    class="w-full p-2 text-sm outline-none border-b border-slate-200"
                    @keyup.escape="openPicker = ''"
                  >
                  <div class="max-h-56 overflow-auto">
                    <button
                      v-for="p in pickerResults"
                      :key="p.id"
                      class="block w-full text-left px-3 py-2 text-xs hover:bg-slate-100 border-b border-slate-50"
                      @click="addProduct(m.file, p)"
                    >
                      <span :class="p.hasImage ? 'text-amber-600' : 'text-emerald-600'">●</span>
                      {{ p.name }}
                    </button>
                    <p v-if="!pickerResults.length" class="p-3 text-xs text-slate-400">No product matches that.</p>
                  </div>
                </div>
              </div>

              <!-- roles -->
              <div class="flex flex-wrap gap-1 mt-2">
                <button
                  v-for="r in (['main', 'gallery', 'unknown', 'not_a_product'] as const)"
                  :key="r"
                  class="text-[11px] px-2 py-1 rounded-md border"
                  :class="
                    choices[m.file]?.role === r
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-200 text-slate-500'
                  "
                  @click="setRole(m.file, r)"
                >
                  {{ r === 'main' ? 'Main photo' : r === 'gallery' ? 'Extra angle' : r === 'unknown' ? 'Not sure' : 'Not a product' }}
                </button>
                <button class="text-[11px] px-2 py-1 rounded-md border border-slate-200 text-slate-500" @click="copyPrevious(i)">
                  Same as previous
                </button>
              </div>
            </div>
          </div>

          <!-- paging -->
          <div v-if="pageCount > 1" class="flex items-center justify-center gap-3 mt-8">
            <button
              class="px-4 py-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              :disabled="page === 0"
              @click="page--"
            >
              Previous
            </button>
            <span class="text-sm text-slate-500">Page {{ page + 1 }} of {{ pageCount }}</span>
            <button
              class="px-4 py-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              :disabled="page >= pageCount - 1"
              @click="page++"
            >
              Next
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

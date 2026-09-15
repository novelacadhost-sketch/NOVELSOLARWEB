<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Edit Pages | Novel Solar Admin' })

const { addToast } = useToast()

interface Block {
  id?: string
  image_url: string
  alt: string
  eyebrow: string
  title: string
  description: string
  caption: string
  link: string
  active: boolean
}

/**
 * The slots an admin may edit, and what each one is.
 *
 * Adding a slot here is not enough on its own — the page must also read it via
 * usePageContent(). Listing one that no page reads would show an editor that
 * changes nothing, which is worse than not offering it.
 */
const EDITABLE = [
  {
    page: 'home',
    label: 'Homepage',
    slots: [
      {
        slot: 'hero',
        label: 'Hero banner carousel',
        help: 'The rotating banners at the top of the homepage. Images are shown wide — around 1600×900 works best.',
        hasCopy: true,
      },
    ],
  },
] as const

const selectedPage = ref<string>('home')
const slots = ref<Record<string, Block[]>>({})
const isLoading = ref(true)
const isSaving = ref<string | null>(null)
const uploading = ref<string | null>(null)

const currentPage = computed(() => EDITABLE.find((p) => p.page === selectedPage.value))

function emptyBlock(): Block {
  return { image_url: '', alt: '', eyebrow: '', title: '', description: '', caption: '', link: '', active: true }
}

async function load() {
  isLoading.value = true
  try {
    const res = await useNuxtApp().$apiFetch<{ slots: Record<string, Block[]> }>('/api/admin/page-content/list', {
      query: { page: selectedPage.value },
    })
    const next: Record<string, Block[]> = {}
    for (const def of currentPage.value?.slots ?? []) {
      next[def.slot] = (res.slots?.[def.slot] ?? []).map((b) => ({ ...emptyBlock(), ...b }))
    }
    slots.value = next
  } catch {
    addToast('Load failed', 'Could not read the current page content.', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(load)
watch(selectedPage, load)

function blocksFor(slot: string): Block[] {
  return (slots.value[slot] ??= [])
}

async function uploadImage(slot: string, index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = `${slot}:${index}`
  try {
    const formData = new FormData()
    formData.append('image', file)
    const res = await useNuxtApp().$apiFetch<{ url: string }>('/api/admin/page-content/upload', {
      method: 'POST',
      body: formData,
    })
    blocksFor(slot)[index]!.image_url = res.url
    addToast('Uploaded', 'Image uploaded. Remember to save.', 'success')
  } catch {
    addToast('Upload failed', 'The image could not be uploaded. Check the size (max 10MB) and format.', 'error')
  } finally {
    uploading.value = null
    input.value = ''
  }
}

function addBlock(slot: string) {
  blocksFor(slot).push(emptyBlock())
}

function removeBlock(slot: string, index: number) {
  blocksFor(slot).splice(index, 1)
}

function move(slot: string, index: number, delta: number) {
  const list = blocksFor(slot)
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item!)
}

async function save(slot: string) {
  const blocks = blocksFor(slot)
  const blank = blocks.findIndex((b) => !b.image_url)
  if (blank !== -1) {
    addToast('Missing image', `Item ${blank + 1} has no image. Upload one or remove the item.`, 'error')
    return
  }

  isSaving.value = slot
  try {
    await useNuxtApp().$apiFetch('/api/admin/page-content/save', {
      method: 'POST',
      body: { page: selectedPage.value, slot, blocks },
    })
    addToast('Saved', 'The page is updated. Refresh the site to see it.', 'success')
    await load()
  } catch {
    addToast('Save failed', 'The changes were not saved.', 'error')
  } finally {
    isSaving.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <header class="mb-8">
      <h1 class="text-2xl font-black uppercase tracking-tight text-[#002888]">Edit Pages</h1>
      <p class="mt-2 text-sm text-slate-600">
        Change the pictures and wording on the public site. Product pages are not edited here — those come from
        Bitrix.
      </p>
    </header>

    <div class="mb-6">
      <label for="page-select" class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Page</label>
      <select
        id="page-select"
        v-model="selectedPage"
        class="w-full max-w-xs rounded-xl border border-slate-300 px-3 py-2 text-sm"
      >
        <option v-for="p in EDITABLE" :key="p.page" :value="p.page">{{ p.label }}</option>
      </select>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-500">Loading…</p>

    <section v-for="def in currentPage?.slots ?? []" v-else :key="def.slot" class="mb-10">
      <div class="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900">{{ def.label }}</h2>
          <p class="text-xs text-slate-500">{{ def.help }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-xl bg-[#002888] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
          :disabled="isSaving === def.slot"
          @click="save(def.slot)"
        >
          {{ isSaving === def.slot ? 'Saving…' : 'Save' }}
        </button>
      </div>

      <p v-if="!blocksFor(def.slot).length" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Nothing has been set here yet, so the site is showing its built-in images. Add an item below to take over.
      </p>

      <div
        v-for="(block, index) in blocksFor(def.slot)"
        :key="index"
        class="mb-4 rounded-2xl border border-slate-200 p-4"
      >
        <div class="flex flex-wrap gap-4">
          <div class="w-40 shrink-0">
            <img
              v-if="block.image_url"
              :src="block.image_url"
              :alt="block.alt || 'Preview'"
              class="h-24 w-40 rounded-lg object-cover"
            >
            <div v-else class="flex h-24 w-40 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
              No image
            </div>
            <label class="mt-2 block cursor-pointer text-center text-xs font-bold text-[#002888]">
              {{ uploading === `${def.slot}:${index}` ? 'Uploading…' : 'Choose image' }}
              <input type="file" accept="image/*" class="hidden" @change="uploadImage(def.slot, index, $event)">
            </label>
          </div>

          <div class="min-w-[16rem] flex-1 space-y-2">
            <input v-model="block.alt" placeholder="Image description (for screen readers)" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <template v-if="def.hasCopy">
              <input v-model="block.eyebrow" placeholder="Small label above the heading" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <input v-model="block.title" placeholder="Heading" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <textarea v-model="block.description" rows="2" placeholder="Paragraph" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input v-model="block.caption" placeholder="Caption" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            </template>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs">
          <button type="button" class="font-bold text-slate-600 disabled:opacity-30" :disabled="index === 0" @click="move(def.slot, index, -1)">↑ Move up</button>
          <button type="button" class="font-bold text-slate-600 disabled:opacity-30" :disabled="index === blocksFor(def.slot).length - 1" @click="move(def.slot, index, 1)">↓ Move down</button>
          <label class="flex items-center gap-1 font-bold text-slate-600">
            <input v-model="block.active" type="checkbox"> Visible
          </label>
          <button type="button" class="ml-auto font-bold text-red-600" @click="removeBlock(def.slot, index)">Remove</button>
        </div>
      </div>

      <button
        type="button"
        class="rounded-xl border-2 border-dashed border-slate-300 px-4 py-2 text-xs font-bold uppercase text-slate-600"
        @click="addBlock(def.slot)"
      >
        + Add item
      </button>
    </section>
  </div>
</template>

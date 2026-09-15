<script setup lang="ts">
import { EDITABLE_IMAGE_PAGES } from '~/utils/editablePages'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Edit Pages | Novel Solar Admin' })

const { addToast } = useToast()

interface Block {
  image_url: string
  alt: string
  eyebrow: string
  title: string
  description: string
  caption: string
  link: string
  active: boolean
}

interface BlockSlot {
  slot: string
  label: string
  help: string
  hasCopy: boolean
}

interface PageDef {
  page: string
  label: string
  blockSlots: BlockSlot[]
  images: string[]
}

/**
 * Two kinds of editable content, deliberately separate in the UI.
 *
 * A "block slot" is an ordered collection the admin composes — the homepage
 * hero, where slides are added, reordered and removed. An "image" is a single
 * picture already in the layout that can be swapped in place; there is nothing
 * to add or order, so offering those controls would only confuse.
 */
const PAGES: PageDef[] = [
  {
    page: 'home',
    label: 'Homepage',
    blockSlots: [
      {
        slot: 'hero',
        label: 'Hero banner carousel',
        help: 'The rotating banners at the top of the homepage. Wide images work best — around 1600×900.',
        hasCopy: true,
      },
    ],
    images: [],
  },
  ...EDITABLE_IMAGE_PAGES.map((p) => ({ page: p.page, label: p.label, blockSlots: [], images: [...p.images] })),
]

interface TemplatePartner { slug: string; name: string }

/**
 * Admin-built partners are appended at runtime: their slugs are not known at
 * build time. They expose the two collections the shared template renders.
 */
const { data: templatePartners } = await useAsyncData('admin-template-partners', () =>
  useNuxtApp().$apiFetch<{ partners: TemplatePartner[] }>('/api/admin/partners/list'),
)

const allPages = computed<PageDef[]>(() => [
  ...PAGES,
  ...(templatePartners.value?.partners ?? []).map((p) => ({
    page: `partners/${p.slug}`,
    label: `Partner — ${p.name}`,
    blockSlots: [
      { slot: 'highlights', label: 'Highlight cards', help: 'Cards with a picture, a heading and a paragraph.', hasCopy: true },
      { slot: 'gallery', label: 'Gallery', help: 'Pictures shown in a grid near the bottom of the page.', hasCopy: false },
    ],
    images: [],
  })),
])

// Deep-linked from the partner list ("Pictures"), so the right page is preselected.
const route = useRoute()
const selectedPage = ref<string>(String(route.query.page ?? 'home'))
const slots = ref<Record<string, Block[]>>({})
const isLoading = ref(true)
const isSaving = ref<string | null>(null)
const busyImage = ref<string | null>(null)

const currentPage = computed(() => allPages.value.find((p) => p.page === selectedPage.value))

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
    for (const def of currentPage.value?.blockSlots ?? []) {
      next[def.slot] = (res.slots?.[def.slot] ?? []).map((b) => ({ ...emptyBlock(), ...b }))
    }
    for (const original of currentPage.value?.images ?? []) {
      next[original] = (res.slots?.[original] ?? []).map((b) => ({ ...emptyBlock(), ...b }))
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

/** What this image currently shows: the override if one is set, else the original. */
function currentImage(original: string): string {
  return blocksFor(original)[0]?.image_url || original
}

function isOverridden(original: string): boolean {
  return Boolean(blocksFor(original)[0]?.image_url)
}

async function uploadTo(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)
  const res = await useNuxtApp().$apiFetch<{ url: string }>('/api/admin/page-content/upload', {
    method: 'POST',
    body: formData,
  })
  return res.url
}

async function saveSlot(slot: string, blocks: Block[]) {
  await useNuxtApp().$apiFetch('/api/admin/page-content/save', {
    method: 'POST',
    body: { page: selectedPage.value, slot, blocks },
  })
}

/** Images save immediately — there is one value, so a separate Save step is only a way to lose work. */
async function replaceImage(original: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  busyImage.value = original
  try {
    const url = await uploadTo(file)
    await saveSlot(original, [{ ...emptyBlock(), image_url: url }])
    await load()
    addToast('Replaced', 'The image is live. Refresh the site to see it.', 'success')
  } catch {
    addToast('Replace failed', 'Check the file size (max 10MB) and format.', 'error')
  } finally {
    busyImage.value = null
    input.value = ''
  }
}

async function resetImage(original: string) {
  busyImage.value = original
  try {
    await saveSlot(original, [])
    await load()
    addToast('Reset', 'The original image is showing again.', 'success')
  } catch {
    addToast('Reset failed', 'The original could not be restored.', 'error')
  } finally {
    busyImage.value = null
  }
}

async function uploadBlockImage(slot: string, index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  busyImage.value = `${slot}:${index}`
  try {
    blocksFor(slot)[index]!.image_url = await uploadTo(file)
    addToast('Uploaded', 'Image added. Remember to press Save.', 'success')
  } catch {
    addToast('Upload failed', 'Check the file size (max 10MB) and format.', 'error')
  } finally {
    busyImage.value = null
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

async function saveBlocks(slot: string) {
  const blocks = blocksFor(slot)
  const blank = blocks.findIndex((b) => !b.image_url)
  if (blank !== -1) {
    addToast('Missing image', `Item ${blank + 1} has no image. Add one or remove the item.`, 'error')
    return
  }
  isSaving.value = slot
  try {
    await saveSlot(slot, blocks)
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
        Change the pictures and wording on the public site. Product pages are not edited here — those come from Bitrix.
      </p>
    </header>

    <div class="mb-6">
      <label for="page-select" class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Page</label>
      <select
        id="page-select"
        v-model="selectedPage"
        class="w-full max-w-sm rounded-xl border border-slate-300 px-3 py-2 text-sm"
      >
        <option v-for="p in allPages" :key="p.page" :value="p.page">{{ p.label }}</option>
      </select>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-500">Loading…</p>

    <template v-else>
      <!-- Ordered collections: add, reorder, remove -->
      <section v-for="def in currentPage?.blockSlots ?? []" :key="def.slot" class="mb-12">
        <div class="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900">{{ def.label }}</h2>
            <p class="text-xs text-slate-500">{{ def.help }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-xl bg-[#002888] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
            :disabled="isSaving === def.slot"
            @click="saveBlocks(def.slot)"
          >
            {{ isSaving === def.slot ? 'Saving…' : 'Save' }}
          </button>
        </div>

        <p v-if="!blocksFor(def.slot).length" class="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Nothing set here yet, so the site is showing its built-in banners. Add an item below to take over.
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
                {{ busyImage === `${def.slot}:${index}` ? 'Uploading…' : 'Choose image' }}
                <input type="file" accept="image/*" class="hidden" @change="uploadBlockImage(def.slot, index, $event)">
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

      <!-- Swap-in-place images -->
      <section v-if="currentPage?.images.length" class="mb-12">
        <h2 class="text-lg font-bold text-slate-900">Pictures on this page</h2>
        <p class="mb-4 text-xs text-slate-500">
          Click an image to replace it. Changes save straight away. Use a picture of roughly the same shape so the
          layout still looks right.
        </p>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="original in currentPage.images" :key="original" class="rounded-2xl border border-slate-200 p-3">
            <img :src="currentImage(original)" :alt="original" class="h-32 w-full rounded-lg bg-slate-50 object-contain">
            <p class="mt-2 truncate text-[11px] text-slate-400" :title="original">{{ original.replace('/images/', '') }}</p>
            <div class="mt-2 flex items-center gap-3 text-xs">
              <label class="cursor-pointer font-bold text-[#002888]">
                {{ busyImage === original ? 'Working…' : 'Replace' }}
                <input type="file" accept="image/*" class="hidden" @change="replaceImage(original, $event)">
              </label>
              <button
                v-if="isOverridden(original)"
                type="button"
                class="ml-auto font-bold text-slate-500"
                :disabled="busyImage === original"
                @click="resetImage(original)"
              >
                Undo
              </button>
              <span v-else class="ml-auto text-slate-400">Original</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

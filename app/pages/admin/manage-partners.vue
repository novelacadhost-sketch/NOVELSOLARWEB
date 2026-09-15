<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Partner Pages | Novel Solar Admin' })

const { addToast } = useToast()

interface Partner {
  slug: string
  name: string
  tagline: string
  description: string
  logo_url: string
  hero_url: string
  accent_color: string
  website_url: string
  active: boolean
  sort: number
}

/** Partners with a hand-built component. Listed so the UI can explain, not just refuse. */
const CUSTOM_SLUGS = ['itel', 'haisic', 'yinergy', 'livoltek', 'hithium']

const partners = ref<Partner[]>([])
const editing = ref<Partner | null>(null)
const isNew = ref(false)
const isLoading = ref(true)
const isSaving = ref(false)
const uploading = ref<'logo' | 'hero' | null>(null)

function blank(): Partner {
  return {
    slug: '',
    name: '',
    tagline: '',
    description: '',
    logo_url: '',
    hero_url: '',
    accent_color: '',
    website_url: '',
    active: false,
    sort: 0,
  }
}

async function load() {
  isLoading.value = true
  try {
    const res = await useNuxtApp().$apiFetch<{ partners: Partner[] }>('/api/admin/partners/list')
    partners.value = res.partners.map((p) => ({ ...blank(), ...p }))
  } catch {
    addToast('Load failed', 'Could not list the partner pages.', 'error')
  } finally {
    isLoading.value = false
  }
}
onMounted(load)

function startNew() {
  editing.value = blank()
  isNew.value = true
}
function startEdit(p: Partner) {
  editing.value = { ...p }
  isNew.value = false
}

// Only ever a starting point — the field stays editable, because the slug is a
// permanent URL and guessing one from a name is how you end up with /acme-co-ltd.
function suggestSlug() {
  if (!isNew.value || !editing.value) return
  editing.value.slug = editing.value.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function upload(kind: 'logo' | 'hero', event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !editing.value) return

  uploading.value = kind
  try {
    const formData = new FormData()
    formData.append('image', file)
    const res = await useNuxtApp().$apiFetch<{ url: string }>('/api/admin/page-content/upload', {
      method: 'POST',
      body: formData,
    })
    if (kind === 'logo') editing.value.logo_url = res.url
    else editing.value.hero_url = res.url
  } catch {
    addToast('Upload failed', 'Check the file size (max 10MB) and format.', 'error')
  } finally {
    uploading.value = null
    input.value = ''
  }
}

async function save() {
  if (!editing.value) return
  isSaving.value = true
  try {
    await useNuxtApp().$apiFetch('/api/admin/partners/save', { method: 'POST', body: editing.value })
    addToast('Saved', editing.value.active ? 'The partner page is live.' : 'Saved as a draft — not visible yet.', 'success')
    editing.value = null
    await load()
  } catch (err) {
    const e = err as { statusMessage?: string }
    addToast('Not saved', e.statusMessage || 'The partner could not be saved.', 'error')
  } finally {
    isSaving.value = false
  }
}

async function remove(p: Partner) {
  if (!confirm(`Delete the partner page for ${p.name}? Its pictures and gallery go too. This cannot be undone.`)) return
  try {
    await useNuxtApp().$apiFetch('/api/admin/partners/delete', { method: 'POST', body: { slug: p.slug } })
    addToast('Deleted', `${p.name} has been removed.`, 'success')
    await load()
  } catch {
    addToast('Delete failed', 'The partner could not be removed.', 'error')
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-[#002888]">Partner Pages</h1>
        <p class="mt-2 max-w-2xl text-sm text-slate-600">
          Create a page for a new partner. It uses the standard layout — a developer can replace it with a custom
          design later without changing the web address.
        </p>
      </div>
      <button type="button" class="rounded-xl bg-[#002888] px-4 py-2 text-xs font-bold uppercase text-white" @click="startNew">
        + New partner
      </button>
    </header>

    <p class="mb-8 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
      <strong>{{ CUSTOM_SLUGS.join(', ') }}</strong> already have hand-built pages and are not listed here. Those are
      edited in <NuxtLink to="/admin/manage-pages" class="font-bold text-[#002888] underline">Edit Pages</NuxtLink>.
    </p>

    <!-- Editor -->
    <section v-if="editing" class="mb-10 rounded-2xl border-2 border-[#002888] p-5">
      <h2 class="mb-4 text-lg font-bold text-slate-900">{{ isNew ? 'New partner' : `Editing ${editing.name}` }}</h2>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Name</span>
          <input v-model="editing.name" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" @blur="suggestSlug">
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Web address</span>
          <input
            v-model="editing.slug"
            :disabled="!isNew"
            placeholder="sunking"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          >
          <span class="mt-1 block text-[11px] text-slate-400">
            novelsolar.com/partners/{{ editing.slug || '…' }}{{ isNew ? '' : ' — fixed once created' }}
          </span>
        </label>
      </div>

      <label class="mt-4 block">
        <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Tagline</span>
        <input v-model="editing.tagline" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
      </label>

      <label class="mt-4 block">
        <span class="mb-1 block text-xs font-bold uppercase text-slate-500">About this partner</span>
        <textarea v-model="editing.description" rows="5" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Logo</span>
          <img v-if="editing.logo_url" :src="editing.logo_url" alt="Logo" class="h-16 w-auto max-w-[160px] object-contain">
          <label class="mt-1 block cursor-pointer text-xs font-bold text-[#002888]">
            {{ uploading === 'logo' ? 'Uploading…' : 'Choose logo' }}
            <input type="file" accept="image/*" class="hidden" @change="upload('logo', $event)">
          </label>
        </div>
        <div>
          <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Banner image</span>
          <img v-if="editing.hero_url" :src="editing.hero_url" alt="Banner" class="h-16 w-full rounded object-cover">
          <label class="mt-1 block cursor-pointer text-xs font-bold text-[#002888]">
            {{ uploading === 'hero' ? 'Uploading…' : 'Choose banner' }}
            <input type="file" accept="image/*" class="hidden" @change="upload('hero', $event)">
          </label>
        </div>
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-3">
        <label class="block">
          <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Brand colour</span>
          <input v-model="editing.accent_color" placeholder="#0044cc" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Website</span>
          <input v-model="editing.website_url" placeholder="https://example.com" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        </label>
      </div>

      <label class="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
        <input v-model="editing.active" type="checkbox"> Visible on the website
      </label>

      <div class="mt-5 flex gap-3">
        <button type="button" class="rounded-xl bg-[#002888] px-5 py-2 text-xs font-bold uppercase text-white disabled:opacity-50" :disabled="isSaving" @click="save">
          {{ isSaving ? 'Saving…' : 'Save' }}
        </button>
        <button type="button" class="rounded-xl border border-slate-300 px-5 py-2 text-xs font-bold uppercase text-slate-600" @click="editing = null">
          Cancel
        </button>
      </div>
    </section>

    <!-- List -->
    <p v-if="isLoading" class="text-sm text-slate-500">Loading…</p>
    <p v-else-if="!partners.length" class="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
      No partner pages have been created yet.
    </p>

    <div v-else class="space-y-3">
      <div v-for="p in partners" :key="p.slug" class="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 p-4">
        <img v-if="p.logo_url" :src="p.logo_url" :alt="p.name" class="h-10 w-20 object-contain">
        <div class="min-w-[12rem] flex-1">
          <p class="font-bold text-slate-900">{{ p.name }}</p>
          <p class="text-xs text-slate-500">/partners/{{ p.slug }}</p>
        </div>
        <span
          class="rounded-full px-3 py-1 text-[11px] font-bold uppercase"
          :class="p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
        >{{ p.active ? 'Live' : 'Draft' }}</span>
        <NuxtLink :to="`/admin/manage-pages?page=partners/${p.slug}`" class="text-xs font-bold text-slate-600">Pictures</NuxtLink>
        <button type="button" class="text-xs font-bold text-[#002888]" @click="startEdit(p)">Edit</button>
        <button type="button" class="text-xs font-bold text-red-600" @click="remove(p)">Delete</button>
      </div>
    </div>
  </div>
</template>

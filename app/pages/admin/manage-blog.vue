<script setup lang="ts">
import { markdownToHtml } from '~/utils/blogMarkdown'
import BlogEditor from '~/components/admin/BlogEditor.vue'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Manage Blog | Novel Solar Admin' })

interface PostSummary {
  slug: string
  title: string
  description: string
  excerpt: string
  date: string
  image: string
  category: string
  author: string
  draft: boolean
}

interface PostDetail extends PostSummary {
  body: string
}

const { addToast } = useToast()

const posts = ref<PostSummary[]>([])
const isListing = ref(false)
const isLoading = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const isUploading = ref(false)
const showDeleteConfirm = ref(false)
const previewMode = ref(false)

const emptyForm = (): PostDetail => ({
  slug: '',
  title: '',
  description: '',
  excerpt: '',
  date: new Date().toISOString().slice(0, 10),
  image: '',
  category: '',
  author: '',
  draft: true,
  body: '',
})

const form = ref<PostDetail>(emptyForm())
const originalSlug = ref<string | null>(null)
const slugManuallyEdited = ref(false)

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96)

const slugIsValid = computed(() => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.value.slug))
const isEditing = computed(() => originalSlug.value !== null)

watch(
  () => form.value.title,
  (title) => {
    if (!slugManuallyEdited.value && !isEditing.value) {
      form.value.slug = slugify(title)
    }
  },
)

const onSlugInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  slugManuallyEdited.value = true
  form.value.slug = slugify(target.value)
}

const loadPosts = async () => {
  isListing.value = true
  try {
    const res = await $fetch<{ posts: PostSummary[] }>('/api/admin/blog/list')
    posts.value = res.posts
  } catch (err: any) {
    addToast('Load failed', err?.statusMessage || err?.message || 'Could not load posts.', 'error')
  } finally {
    isListing.value = false
  }
}

const startNewPost = () => {
  form.value = emptyForm()
  originalSlug.value = null
  slugManuallyEdited.value = false
  previewMode.value = false
}

const editPost = async (slug: string) => {
  isLoading.value = true
  previewMode.value = false
  try {
    const res = await $fetch<{ post: { slug: string; frontmatter: any; body: string } }>(`/api/admin/blog/${slug}`)
    const fm = res.post.frontmatter
    form.value = {
      slug: res.post.slug,
      title: fm.title || '',
      description: fm.description || '',
      excerpt: fm.excerpt || '',
      date: fm.date || new Date().toISOString().slice(0, 10),
      image: fm.image || '',
      category: fm.category || '',
      author: fm.author || '',
      draft: fm.draft === true,
      body: res.post.body || '',
    }
    originalSlug.value = res.post.slug
    slugManuallyEdited.value = true
  } catch (err: any) {
    addToast('Load failed', err?.statusMessage || err?.message || 'Could not load post.', 'error')
  } finally {
    isLoading.value = false
  }
}

const onCoverFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const formData = new FormData()
  formData.append('image', file)

  isUploading.value = true
  try {
    const res = await useNuxtApp().$apiFetch<{ url: string }>('/api/admin/blog/upload-image', {
      method: 'POST',
      body: formData,
    })
    form.value.image = res.url
    addToast('Cover uploaded', 'Image uploaded to Cloudinary.', 'success')
  } catch (err: any) {
    addToast('Upload failed', err?.statusMessage || err?.message || 'Could not upload image.', 'error')
  } finally {
    isUploading.value = false
    target.value = ''
  }
}

const validate = (): string | null => {
  if (!form.value.title.trim()) return 'Title is required.'
  if (!slugIsValid.value) return 'Slug must be lowercase letters, numbers, and dashes only.'
  if (!form.value.body.trim()) return 'Body content is required.'
  return null
}

const savePost = async () => {
  const error = validate()
  if (error) {
    addToast('Cannot save', error, 'error')
    return
  }

  isSaving.value = true
  try {
    const res = await useNuxtApp().$apiFetch<{ slug: string; action: string; message: string }>('/api/admin/blog/save', {
      method: 'POST',
      body: {
        slug: form.value.slug,
        originalSlug: originalSlug.value || undefined,
        title: form.value.title,
        description: form.value.description,
        excerpt: form.value.excerpt,
        date: form.value.date,
        image: form.value.image,
        category: form.value.category,
        author: form.value.author,
        draft: form.value.draft,
        body: form.value.body,
      },
    })
    originalSlug.value = res.slug
    addToast(res.action === 'publish' ? 'Post published' : 'Post updated', res.message, 'success', 8000)
    await loadPosts()
  } catch (err: any) {
    addToast('Save failed', err?.statusMessage || err?.message || 'Could not save post.', 'error')
  } finally {
    isSaving.value = false
  }
}

const togglePublish = async () => {
  form.value.draft = !form.value.draft
  if (originalSlug.value) {
    await savePost()
  }
}

const requestDelete = () => {
  showDeleteConfirm.value = true
}
const cancelDelete = () => {
  showDeleteConfirm.value = false
}

const confirmDelete = async () => {
  if (!originalSlug.value) return
  isDeleting.value = true
  try {
    await useNuxtApp().$apiFetch('/api/admin/blog/delete', {
      method: 'POST',
      body: { slug: originalSlug.value },
    })
    addToast('Post deleted', 'Removal committed to GitHub.', 'success', 6000)
    showDeleteConfirm.value = false
    startNewPost()
    await loadPosts()
  } catch (err: any) {
    addToast('Delete failed', err?.statusMessage || err?.message || 'Could not delete post.', 'error')
  } finally {
    isDeleting.value = false
  }
}

const previewHtml = computed(() => markdownToHtml(form.value.body))

const formatDate = (date: string) => {
  if (!date) return ''
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
  } catch {
    return date
  }
}

await loadPosts()
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="bg-white border-b border-slate-200">
      <div class="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black text-slate-900 tracking-tight">Blog Manager</h1>
          <p class="text-sm text-slate-500 mt-1">
            Create, edit, and publish posts. Changes are committed to GitHub and become live after the next deployment.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink
            to="/admin/manage-products"
            class="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-2 text-sm transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-sm">inventory_2</span>
            Manage Products
          </NuxtLink>
          <NuxtLink
            to="/admin/add-product"
            class="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-2 text-sm transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-sm">add_box</span>
            Add Product
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
      <aside class="bg-white rounded-2xl border border-slate-100 p-5 h-fit">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-black uppercase tracking-widest text-slate-500">Posts</h2>
          <button
            type="button"
            class="text-purple-700 hover:text-purple-900 text-xs font-bold flex items-center gap-1"
            @click="startNewPost"
          >
            <span class="material-symbols-outlined text-sm">add</span>
            New
          </button>
        </div>

        <div v-if="isListing" class="text-sm text-slate-400 py-6 text-center">Loading…</div>
        <div v-else-if="posts.length === 0" class="text-sm text-slate-400 py-6 text-center">No posts yet.</div>
        <ul v-else class="space-y-2">
          <li v-for="p in posts" :key="p.slug">
            <button
              type="button"
              class="w-full text-left px-3 py-3 rounded-xl border transition-all"
              :class="
                originalSlug === p.slug ? 'border-purple-300 bg-purple-50/60' : 'border-slate-100 hover:bg-slate-50'
              "
              @click="editPost(p.slug)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-bold text-slate-900 line-clamp-1">{{ p.title || p.slug }}</span>
                <span
                  v-if="p.draft"
                  class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-100 text-amber-700"
                  >Draft</span
                >
              </div>
              <div class="text-xs text-slate-500 mt-1">
                {{ formatDate(p.date) }}{{ p.category ? ' • ' + p.category : '' }}
              </div>
            </button>
          </li>
        </ul>
      </aside>

      <section class="space-y-6">
        <div class="bg-white rounded-2xl border border-slate-100 p-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h2 class="text-lg font-black text-slate-900">{{ isEditing ? 'Edit Post' : 'New Post' }}</h2>
              <p v-if="isEditing" class="text-xs text-slate-500 mt-1">
                Editing <code class="text-slate-700">{{ originalSlug }}</code>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded-xl text-xs font-bold border transition-all"
                :class="
                  previewMode
                    ? 'border-purple-300 bg-purple-50 text-purple-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                "
                @click="previewMode = !previewMode"
              >
                <span class="material-symbols-outlined text-sm align-middle">visibility</span>
                {{ previewMode ? 'Edit' : 'Preview' }}
              </button>
              <button
                v-if="isEditing"
                type="button"
                class="px-3 py-2 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all"
                :disabled="isDeleting"
                @click="requestDelete"
              >
                <span class="material-symbols-outlined text-sm align-middle">delete</span>
                Delete
              </button>
              <button
                type="button"
                class="px-4 py-2 rounded-xl text-xs font-bold border transition-all"
                :class="
                  form.draft
                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                "
                :disabled="isSaving"
                @click="togglePublish"
              >
                {{ form.draft ? 'Draft (toggle to Published)' : 'Published (toggle to Draft)' }}
              </button>
              <button
                type="button"
                class="px-5 py-2 rounded-xl text-xs font-black bg-purple-700 text-white hover:bg-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isSaving"
                @click="savePost"
              >
                <span class="material-symbols-outlined text-sm align-middle">save</span>
                {{ isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Publish' }}
              </button>
            </div>
          </div>

          <div v-if="isLoading" class="text-sm text-slate-500">Loading post…</div>

          <div v-else-if="previewMode" class="space-y-6">
            <div class="aspect-video bg-slate-100 rounded-2xl overflow-hidden">
              <img v-if="form.image" :src="form.image" :alt="form.title" class="w-full h-full object-cover" />
            </div>
            <div>
              <span
                v-if="form.category"
                class="bg-blue-50 text-[#002888] text-xs font-black px-3 py-1 rounded-md uppercase tracking-widest"
                >{{ form.category }}</span
              >
              <h1 class="text-3xl font-black text-slate-900 mt-3">{{ form.title || 'Untitled post' }}</h1>
              <p class="text-sm text-slate-500 mt-1">
                {{ formatDate(form.date) }}{{ form.author ? ' • ' + form.author : '' }}
              </p>
            </div>
            <div class="prose prose-slate max-w-none" v-html="previewHtml" />
          </div>

          <form v-else class="grid grid-cols-1 md:grid-cols-2 gap-5" @submit.prevent="savePost">
            <label class="block md:col-span-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-500">Title</span>
              <input
                v-model="form.title"
                type="text"
                class="mt-2 w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50/30"
                placeholder="A compelling headline"
              />
            </label>

            <label class="block">
              <span class="text-xs font-black uppercase tracking-widest text-slate-500">Slug</span>
              <input
                :value="form.slug"
                type="text"
                class="mt-2 w-full px-5 py-4 rounded-2xl border-2 focus:ring-4 outline-none transition-all bg-slate-50/30 font-mono text-sm"
                :class="
                  slugIsValid
                    ? 'border-slate-100 focus:border-purple-500 focus:ring-purple-500/10'
                    : 'border-red-200 focus:border-red-400 focus:ring-red-500/10'
                "
                placeholder="lowercase-with-dashes"
                @input="onSlugInput"
              />
              <span v-if="!slugIsValid" class="text-xs text-red-600 mt-1 block"
                >Lowercase letters, numbers, dashes only.</span
              >
              <span v-else class="text-xs text-slate-400 mt-1 block">Public URL: /blog/{{ form.slug || '…' }}</span>
            </label>

            <label class="block">
              <span class="text-xs font-black uppercase tracking-widest text-slate-500">Date</span>
              <input
                v-model="form.date"
                type="date"
                class="mt-2 w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50/30"
              />
            </label>

            <label class="block">
              <span class="text-xs font-black uppercase tracking-widest text-slate-500">Category</span>
              <input
                v-model="form.category"
                type="text"
                class="mt-2 w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50/30"
                placeholder="e.g. Inverter"
              />
            </label>

            <label class="block">
              <span class="text-xs font-black uppercase tracking-widest text-slate-500">Author</span>
              <input
                v-model="form.author"
                type="text"
                class="mt-2 w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50/30"
                placeholder="Novel Solar Editorial"
              />
            </label>

            <label class="block md:col-span-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-500">Excerpt</span>
              <textarea
                v-model="form.excerpt"
                rows="2"
                class="mt-2 w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50/30"
                placeholder="One-line teaser shown on the blog hub"
              />
            </label>

            <label class="block md:col-span-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-500">Description (SEO)</span>
              <textarea
                v-model="form.description"
                rows="2"
                class="mt-2 w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50/30"
                placeholder="Used for meta description and OG description"
              />
            </label>

            <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 items-start">
              <div class="aspect-video w-full rounded-2xl bg-slate-100 overflow-hidden border border-slate-200">
                <img v-if="form.image" :src="form.image" :alt="form.title" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-xs">No cover</div>
              </div>
              <div class="space-y-3">
                <label class="block">
                  <span class="text-xs font-black uppercase tracking-widest text-slate-500">Cover image URL</span>
                  <input
                    v-model="form.image"
                    type="text"
                    class="mt-2 w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50/30 font-mono text-sm"
                    placeholder="/images/foo.jpg or https://res.cloudinary.com/..."
                  />
                </label>
                <label class="block">
                  <span class="text-xs font-black uppercase tracking-widest text-slate-500">Or upload a new cover</span>
                  <input
                    type="file"
                    accept="image/*"
                    class="mt-2 block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                    :disabled="isUploading"
                    @change="onCoverFileChange"
                  />
                  <span v-if="isUploading" class="text-xs text-slate-500 mt-1 block">Uploading…</span>
                </label>
              </div>
            </div>

            <div class="md:col-span-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-500">Body</span>
              <BlogEditor v-model="form.body" class="mt-2" />
            </div>
          </form>
        </div>

        <div v-if="showDeleteConfirm" class="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 class="text-lg font-black text-slate-900 mb-2">Delete this post?</h3>
            <p class="text-sm text-slate-600 mb-6">
              This will commit a deletion of <code class="font-mono text-slate-800">{{ originalSlug }}</code> to GitHub.
              The post will go offline after the next deployment. This cannot be undone from this UI.
            </p>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
                :disabled="isDeleting"
                @click="cancelDelete"
              >
                Cancel
              </button>
              <button
                type="button"
                class="px-4 py-2 rounded-xl text-xs font-black bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                :disabled="isDeleting"
                @click="confirmDelete"
              >
                {{ isDeleting ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
const { addToast } = useToast()
definePageMeta({ middleware: 'admin' })

const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref([])
const selectedProduct = ref(null)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const showDeleteConfirm = ref(false)
const previewUrls = new Map()

// Pagination state
const nextOffset = ref(null)
const totalProducts = ref(0)
const isLoadingMore = ref(false)

// Edit form state
const editForm = ref({
  id: '',
  name: '',
  price: null,
  dealerPrice: null,
  description: '',
  specs: [{ label: '', value: '' }],
  isDisabled: false,
  previewImageUrl: '',
  mainImageUrl: '',
  mainImageFile: null,
  galleryUrls: [],
  newGalleryFiles: [],
  removeMainImage: false,
})

const getPreviewUrl = (file) => {
  if (!file) return null
  if (previewUrls.has(file)) return previewUrls.get(file)
  const url = URL.createObjectURL(file)
  previewUrls.set(file, url)
  return url
}

const revokePreviewUrl = (file) => {
  if (!file || !previewUrls.has(file)) return
  URL.revokeObjectURL(previewUrls.get(file))
  previewUrls.delete(file)
}

const resetMediaState = () => {
  if (editForm.value.mainImageFile) {
    revokePreviewUrl(editForm.value.mainImageFile)
  }

  editForm.value.newGalleryFiles.forEach((file) => revokePreviewUrl(file))
}

const currentMainImagePreview = computed(() => {
  if (editForm.value.mainImageFile) {
    return getPreviewUrl(editForm.value.mainImageFile)
  }

  return editForm.value.removeMainImage ? '' : editForm.value.previewImageUrl
})

const combinedGalleryPreview = computed(() => [
  ...editForm.value.galleryUrls.map((url) => ({ type: 'existing', url })),
  ...editForm.value.newGalleryFiles.map((file, index) => ({
    type: 'new',
    file,
    index,
    url: getPreviewUrl(file),
  })),
])

const resetSearch = () => {
  resetMediaState()
  searchQuery.value = ''
  searchResults.value = []
  selectedProduct.value = null
  isEditing.value = false
  nextOffset.value = null
  totalProducts.value = 0
}

const performSearch = async (isLoadMore = false) => {
  if (isLoadMore) {
    isLoadingMore.value = true
  } else {
    isSearching.value = true
    searchResults.value = [] // Clear existing results if it's a fresh search
    nextOffset.value = null
  }

  try {
    const response = await useNuxtApp().$apiFetch('/api/admin/search-products', {
      method: 'POST',
      body: {
        query: searchQuery.value,
        start: isLoadMore ? nextOffset.value : 0,
      },
    })

    if (isLoadMore) {
      searchResults.value = [...searchResults.value, ...(response.products || [])]
    } else {
      searchResults.value = response.products || []
    }

    nextOffset.value = response.next || null
    totalProducts.value = response.total || 0

    if (searchResults.value.length === 0 && !isLoadMore) {
      addToast('Search', 'No products found matching your query.', 'info')
    }
  } catch (error) {
    console.error('Search failed:', error)
    addToast('Search Error', error.data?.statusMessage || 'Search failed', 'error')
  } finally {
    isSearching.value = false
    isLoadingMore.value = false
  }
}

const selectProduct = (product) => {
  resetMediaState()
  selectedProduct.value = product
  editForm.value = {
    id: product.id,
    name: product.name,
    price: Number.parseFloat(product.price),
    dealerPrice: product.dealerPrice ? Number.parseFloat(product.dealerPrice) : null,
    description: product.description || '',
    specs: product.specs && product.specs.length > 0 ? [...product.specs] : [{ label: '', value: '' }],
    isDisabled: !!product.isDisabled,
    previewImageUrl: product.imageUrl || '',
    mainImageUrl: product.persistedMainImageUrl || '',
    mainImageFile: null,
    galleryUrls: Array.isArray(product.gallery) ? [...product.gallery] : [],
    newGalleryFiles: [],
    removeMainImage: false,
  }
  isEditing.value = true
}

const addSpecRow = () => {
  editForm.value.specs.push({ label: '', value: '' })
}

const removeSpecRow = (index) => {
  if (editForm.value.specs.length > 1) {
    editForm.value.specs.splice(index, 1)
  }
}

const saveChanges = async () => {
  if (!editForm.value.name || !editForm.value.price) {
    addToast('Validation', 'Name and price are required', 'error')
    return
  }

  isSaving.value = true

  try {
    const formData = new FormData()
    formData.append('productId', editForm.value.id)
    formData.append('productName', editForm.value.name)
    formData.append('productPrice', String(editForm.value.price))
    formData.append(
      'productDealerPrice',
      editForm.value.dealerPrice != null && editForm.value.dealerPrice !== '' ? String(editForm.value.dealerPrice) : '',
    )
    formData.append('productDescription', editForm.value.description || '')
    formData.append('productSpecs', JSON.stringify(editForm.value.specs))
    formData.append('productDisabled', String(editForm.value.isDisabled))
    formData.append('mainImageUrl', editForm.value.mainImageUrl || '')
    formData.append('galleryUrls', JSON.stringify(editForm.value.galleryUrls || []))
    formData.append('removeMainImage', String(editForm.value.removeMainImage))

    if (editForm.value.mainImageFile) {
      formData.append('mainImageFile', editForm.value.mainImageFile)
    }

    editForm.value.newGalleryFiles.forEach((file) => {
      formData.append('newGalleryFiles', file)
    })

    await useNuxtApp().$apiFetch('/api/admin/update-product', {
      method: 'POST',
      body: formData,
    })

    addToast('Success', 'Product updated successfully!', 'success')
    isEditing.value = false
    selectedProduct.value = null
    performSearch()
  } catch (error) {
    console.error('Update failed:', error)
    addToast('Update Failed', error.data?.statusMessage || 'Update failed', 'error')
  } finally {
    isSaving.value = false
  }
}

const cancelEdit = () => {
  resetMediaState()
  isEditing.value = false
  selectedProduct.value = null
  showDeleteConfirm.value = false
}

const confirmDelete = () => {
  showDeleteConfirm.value = true
}

const handleMainImageChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  if (editForm.value.mainImageFile) {
    revokePreviewUrl(editForm.value.mainImageFile)
  }

  editForm.value.mainImageFile = file
  editForm.value.previewImageUrl = getPreviewUrl(file)
  editForm.value.removeMainImage = false
}

const clearMainImage = () => {
  if (editForm.value.mainImageFile) {
    revokePreviewUrl(editForm.value.mainImageFile)
  }

  editForm.value.mainImageFile = null
  editForm.value.previewImageUrl = ''
  editForm.value.mainImageUrl = ''
  editForm.value.removeMainImage = true
}

const handleGalleryUpload = (event) => {
  const files = Array.from(event.target.files || [])
  if (files.length === 0) return
  editForm.value.newGalleryFiles = [...editForm.value.newGalleryFiles, ...files]
}

const removeExistingGalleryImage = (index) => {
  editForm.value.galleryUrls.splice(index, 1)
}

const removeNewGalleryImage = (index) => {
  const file = editForm.value.newGalleryFiles[index]
  revokePreviewUrl(file)
  editForm.value.newGalleryFiles.splice(index, 1)
}

const deleteProduct = async () => {
  if (!editForm.value.id) {
    addToast('Validation', 'Missing required information', 'error')
    return
  }

  isDeleting.value = true
  showDeleteConfirm.value = false

  try {
    const response = await useNuxtApp().$apiFetch('/api/admin/delete-product', {
      method: 'POST',
      body: {
        productId: editForm.value.id,
        productName: editForm.value.name,
      },
    })

    addToast('Deleted', response.message, 'success')
    isEditing.value = false
    selectedProduct.value = null
    resetSearch()
  } catch (error) {
    console.error('Delete failed:', error)
    addToast('Delete Failed', error.data?.statusMessage || 'Delete failed', 'error')
  } finally {
    isDeleting.value = false
  }
}

useHead({
  title: 'Manage Products | Novel Solar Admin',
  meta: [{ name: 'description', content: 'Search and edit existing products' }],
})

const handleLogout = async () => {
  try {
    await useNuxtApp().$apiFetch('/api/admin/auth/logout', { method: 'POST' })
    navigateTo('/admin/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

onMounted(() => {
  performSearch(true)
})

onUnmounted(() => {
  resetMediaState()
  previewUrls.forEach((url) => URL.revokeObjectURL(url))
  previewUrls.clear()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <div class="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div class="text-center lg:text-left">
          <h1 class="text-4xl font-black text-slate-900 mb-2 tracking-tight">Manage Products</h1>
          <p class="text-slate-500 font-medium italic">Search and edit existing inventory</p>
        </div>

        <div class="flex flex-wrap justify-center lg:justify-end items-center gap-3 lg:max-w-[45%]">
          <NuxtLink
            to="/admin/add-product"
            class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold flex items-center gap-2 text-sm transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-sm">add</span>
            Add Products
          </NuxtLink>
          <NuxtLink
            to="/admin/manage-blog"
            class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold flex items-center gap-2 text-sm transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-sm">article</span>
            Manage Blog
          </NuxtLink>
          <button
            class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold flex items-center gap-2 text-sm transition-all"
            @click="handleLogout"
          >
            <span class="material-symbols-outlined text-sm">logout</span>
            Logout
          </button>
        </div>
      </div>

      <div v-if="!isEditing" class="space-y-8">
        <!-- Search Section -->
        <div class="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div class="md:col-span-3">
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Product Name</label>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by product name..."
                class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all"
                :disabled="isSearching"
                @keyup.enter="() => performSearch(false)"
              />
            </div>
            <button
              :disabled="isSearching"
              class="w-full px-5 py-4 bg-purple-600 text-white font-black rounded-2xl hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              @click="() => performSearch(false)"
            >
              <span
                v-if="isSearching"
                class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
              <span class="material-symbols-outlined">{{ searchQuery ? 'search' : 'sync' }}</span>
              {{ isSearching ? 'Processing...' : searchQuery ? 'Filter' : 'Fetch All' }}
            </button>
          </div>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-black text-slate-900">
              Results <span class="text-purple-600">({{ searchResults.length }})</span>
            </h2>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              v-for="product in searchResults"
              :key="product.id"
              class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all cursor-pointer"
              @click="selectProduct(product)"
            >
              <div class="flex gap-4">
                <div v-if="product.imageUrl" class="w-20 h-20 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden">
                  <img loading="lazy" :src="product.imageUrl" :alt="product.name" class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-black text-slate-900 truncate hover:text-purple-600">{{ product.name }}</h3>
                  <div class="flex items-center gap-3 mt-1">
                    <p class="text-lg font-bold text-purple-600">₦{{ Number(product.price).toLocaleString() }}</p>
                    <p
                      v-if="product.dealerPrice"
                      class="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"
                    >
                      Dealer: ₦{{ Number(product.dealerPrice).toLocaleString() }}
                    </p>
                  </div>
                  <p v-if="product.description" class="text-xs text-slate-500 line-clamp-2 mt-2">
                    {{ product.description }}
                  </p>
                  <div v-if="product.isDisabled" class="mt-2">
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700"
                    >
                      <span class="material-symbols-outlined text-xs">visibility_off</span>
                      Hidden From Storefront
                    </span>
                  </div>
                  <div class="mt-3 flex gap-2 text-xs font-bold text-slate-500">
                    <span v-if="product.specs.length" class="inline-flex items-center gap-1">
                      <span class="material-symbols-outlined text-sm">info</span>
                      {{ product.specs.length }} specs
                    </span>
                    <span v-if="product.gallery.length" class="inline-flex items-center gap-1">
                      <span class="material-symbols-outlined text-sm">image</span>
                      {{ product.gallery.length }} images
                    </span>
                  </div>
                </div>
                <span class="material-symbols-outlined text-slate-400 text-2xl self-center">edit</span>
              </div>
            </div>
          </div>

          <!-- Pagination UI -->
          <div v-if="searchResults.length > 0" class="flex flex-col items-center pt-8 pb-4">
            <p class="text-sm font-bold text-slate-400 mb-4">
              Showing {{ searchResults.length }} of {{ totalProducts }} products
            </p>

            <button
              v-if="nextOffset !== null"
              :disabled="isLoadingMore"
              class="px-8 py-3 bg-purple-50 text-purple-700 font-black rounded-2xl hover:bg-purple-100 transition-all disabled:opacity-50 flex items-center gap-2 border border-purple-200 shadow-sm"
              @click="performSearch(true)"
            >
              <span
                v-if="isLoadingMore"
                class="animate-spin inline-block w-4 h-4 border-2 border-purple-700 border-t-transparent rounded-full"
              />
              <span v-else class="material-symbols-outlined text-lg">expand_more</span>
              {{ isLoadingMore ? 'Loading...' : 'Load Next 50 Products' }}
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="searchResults.length === 0 && !isSearching" class="text-center py-12">
          <span class="material-symbols-outlined text-6xl text-slate-200 flex justify-center mb-4">folder_open</span>
          <p class="text-slate-400 font-medium">
            {{ searchQuery ? 'No products found' : 'Search for a product to get started' }}
          </p>
        </div>
      </div>

      <!-- Edit Form -->
      <div v-if="isEditing && selectedProduct" class="space-y-8">
        <div class="flex items-center gap-4 mb-6">
          <button
            class="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"
            @click="cancelEdit"
          >
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 class="text-2xl font-black text-slate-900">
            Edit: <span class="text-purple-600">{{ selectedProduct.name }}</span>
          </h2>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Edit Form -->
          <div class="lg:col-span-2 space-y-8">
            <!-- Basic Info -->
            <div class="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-6">
              <h3 class="text-xl font-black text-slate-900 flex items-center gap-2">
                <span class="material-symbols-outlined">edit_note</span>
                Product Information
              </h3>

              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Name</label>
                  <input
                    v-model="editForm.name"
                    type="text"
                    class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all"
                    :disabled="isSaving"
                  />
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
                      >Price (NGN)</label
                    >
                    <input
                      v-model="editForm.price"
                      type="number"
                      class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all"
                      :disabled="isSaving"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
                      >Dealer Price (NGN)</label
                    >
                    <input
                      v-model="editForm.dealerPrice"
                      type="number"
                      placeholder="Optional"
                      class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all"
                      :disabled="isSaving"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
                    >Description</label
                  >
                  <textarea
                    v-model="editForm.description"
                    rows="5"
                    class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all resize-none"
                    :disabled="isSaving"
                  />
                </div>

                <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <p class="text-xs font-black uppercase tracking-widest text-slate-400">Storefront Visibility</p>
                      <p class="mt-2 text-sm font-medium text-slate-600">
                        Hides this product from the shop, search and category pages. It stays active in Bitrix, so sales, quotes and the CRM catalogue are unaffected
                        quantity.
                      </p>
                    </div>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-all"
                      :class="
                        editForm.isDisabled
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      "
                      :disabled="isSaving"
                      @click="editForm.isDisabled = !editForm.isDisabled"
                    >
                      <span class="material-symbols-outlined text-base">{{
                        editForm.isDisabled ? 'visibility_off' : 'visibility'
                      }}</span>
                      {{ editForm.isDisabled ? 'Disabled' : 'Visible' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-6">
              <div class="flex items-center justify-between gap-4">
                <h3 class="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span class="material-symbols-outlined">imagesmode</span>
                  Product Media
                </h3>
                <label
                  class="px-4 py-2 bg-purple-50 text-purple-700 font-black rounded-xl border border-purple-100 hover:bg-purple-100 transition-all text-xs uppercase cursor-pointer"
                >
                  Replace Cover
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    :disabled="isSaving"
                    @change="handleMainImageChange"
                  />
                </label>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Cover Image</p>
                  <div class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div
                      v-if="currentMainImagePreview"
                      class="relative aspect-square overflow-hidden rounded-2xl bg-white"
                    >
                      <img
                        :src="currentMainImagePreview"
                        :alt="selectedProduct.name"
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <div
                      v-else
                      class="aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-white text-slate-400 flex items-center justify-center text-sm font-bold text-center p-6"
                    >
                      No cover image selected
                    </div>

                    <div class="mt-4 flex flex-wrap gap-3">
                      <label
                        class="px-4 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all text-xs uppercase cursor-pointer"
                      >
                        Upload New
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          :disabled="isSaving"
                          @change="handleMainImageChange"
                        />
                      </label>
                      <button
                        type="button"
                        class="px-4 py-3 bg-red-50 text-red-700 font-black rounded-2xl hover:bg-red-100 transition-all text-xs uppercase disabled:opacity-50"
                        :disabled="
                          isSaving || (!currentMainImagePreview && !editForm.mainImageFile && !editForm.mainImageUrl)
                        "
                        @click="clearMainImage"
                      >
                        Remove Cover
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-3">
                    <p class="block text-xs font-black text-slate-400 uppercase tracking-widest">Gallery</p>
                    <label
                      class="px-3 py-2 bg-purple-50 text-purple-700 font-black rounded-xl border border-purple-100 hover:bg-purple-100 transition-all text-xs uppercase cursor-pointer"
                    >
                      Add Images
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        class="hidden"
                        :disabled="isSaving"
                        @change="handleGalleryUpload"
                      />
                    </label>
                  </div>

                  <div class="rounded-3xl border border-slate-200 bg-slate-50 p-4 min-h-[280px]">
                    <div v-if="combinedGalleryPreview.length > 0" class="grid grid-cols-2 gap-3">
                      <div
                        v-for="(image, index) in combinedGalleryPreview"
                        :key="image.type === 'existing' ? `existing-${image.url}` : `new-${image.index}`"
                        class="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white group"
                      >
                        <img
                          :src="image.url"
                          :alt="`${selectedProduct.name} gallery image ${index + 1}`"
                          class="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          class="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/65 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                          :disabled="isSaving"
                          @click="
                            image.type === 'existing'
                              ? removeExistingGalleryImage(index)
                              : removeNewGalleryImage(image.index)
                          "
                        >
                          <span class="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </div>
                    <div
                      v-else
                      class="h-full min-h-[240px] rounded-2xl border-2 border-dashed border-slate-200 bg-white text-slate-400 flex items-center justify-center text-sm font-bold text-center p-6"
                    >
                      No gallery images yet
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Specs -->
            <div class="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-6">
              <div class="flex items-center justify-between">
                <h3 class="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span class="material-symbols-outlined">list_alt</span>
                  Technical Specs
                </h3>
                <button
                  type="button"
                  class="px-3 py-2 bg-purple-50 text-purple-700 font-black rounded-xl border border-purple-100 hover:bg-purple-100 transition-all text-xs uppercase"
                  :disabled="isSaving"
                  @click="addSpecRow"
                >
                  + Add
                </button>
              </div>

              <div class="space-y-3">
                <div v-for="(spec, index) in editForm.specs" :key="index" class="flex gap-3">
                  <input
                    v-model="spec.label"
                    type="text"
                    placeholder="Label"
                    class="w-1/3 px-4 py-3 rounded-xl border-2 border-slate-100 focus:ring-2 focus:ring-purple-500/20 outline-none text-sm"
                    :disabled="isSaving"
                  />
                  <input
                    v-model="spec.value"
                    type="text"
                    placeholder="Value"
                    class="flex-1 px-4 py-3 rounded-xl border-2 border-slate-100 focus:ring-2 focus:ring-purple-500/20 outline-none text-sm"
                    :disabled="isSaving"
                  />
                  <button
                    v-if="editForm.specs.length > 1"
                    type="button"
                    class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    :disabled="isSaving"
                    @click="removeSpecRow(index)"
                  >
                    <span class="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Product Preview -->
          <div class="lg:col-span-1">
            <div
              class="bg-gradient-to-br from-purple-600 to-purple-700 rounded-3xl shadow-xl p-8 text-white sticky top-8"
            >
              <h3 class="text-lg font-black mb-6">Preview</h3>

              <div v-if="currentMainImagePreview" class="w-full h-40 rounded-2xl bg-white/10 overflow-hidden mb-6">
                <img
                  loading="lazy"
                  :src="currentMainImagePreview"
                  :alt="selectedProduct.name"
                  class="w-full h-full object-cover"
                />
              </div>

              <div class="space-y-4">
                <div>
                  <p class="text-xs text-purple-200 uppercase font-bold">Name</p>
                  <p class="text-lg font-black truncate">{{ editForm.name }}</p>
                </div>

                <div>
                  <p class="text-xs text-purple-200 uppercase font-bold">Price</p>
                  <p class="text-2xl font-black text-purple-100">₦{{ Number(editForm.price).toLocaleString() }}</p>
                </div>

                <div>
                  <p class="text-xs text-purple-200 uppercase font-bold">Visibility</p>
                  <p class="text-sm font-black text-purple-50">
                    {{ editForm.isDisabled ? 'Hidden from customer UI' : 'Visible on customer UI' }}
                  </p>
                </div>

                <div v-if="editForm.specs.some((s) => s.label && s.value)">
                  <p class="text-xs text-purple-200 uppercase font-bold mb-2">Specs</p>
                  <div class="space-y-2">
                    <div
                      v-for="(spec, i) in editForm.specs.filter((s) => s.label && s.value)"
                      :key="i"
                      class="flex justify-between text-xs"
                    >
                      <span class="text-purple-100">{{ spec.label }}</span>
                      <span class="text-purple-50 font-bold">{{ spec.value }}</span>
                    </div>
                  </div>
                </div>

                <div v-if="combinedGalleryPreview.length" class="pt-4 border-t border-white/20">
                  <p class="text-xs text-purple-200 uppercase font-bold mb-2">Gallery</p>
                  <p class="text-sm text-purple-100">{{ combinedGalleryPreview.length }} additional images</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-4 justify-center flex-wrap">
          <button
            :disabled="isSaving || isDeleting"
            class="px-8 py-4 bg-slate-200 text-slate-900 font-black rounded-2xl hover:bg-slate-300 transition-all disabled:opacity-50"
            @click="cancelEdit"
          >
            Back
          </button>
          <button
            :disabled="isSaving || isDeleting"
            class="px-8 py-4 bg-red-100 text-red-700 font-black rounded-2xl hover:bg-red-200 transition-all disabled:opacity-50 flex items-center gap-2"
            @click="confirmDelete"
          >
            <span class="material-symbols-outlined">delete</span>
            Delete Product
          </button>
          <button
            :disabled="isSaving || isDeleting"
            class="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-black rounded-2xl hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 flex items-center gap-2"
            @click="saveChanges"
          >
            <span v-if="isSaving" class="animate-spin border-2 border-white/30 border-t-white w-4 h-4 rounded-full" />
            {{ isSaving ? 'Saving...' : editForm.isDisabled ? 'Save as Hidden' : 'Save Changes' }}
          </button>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-in fade-in slide-in-from-bottom-4">
          <div class="flex items-center gap-3 mb-6 text-red-600">
            <span class="material-symbols-outlined text-4xl">warning</span>
            <h3 class="text-2xl font-black">Delete Product?</h3>
          </div>

          <p class="text-slate-600 mb-2">You're about to permanently delete:</p>
          <p class="text-lg font-black text-slate-900 mb-6 break-words">"{{ selectedProduct.name }}"</p>

          <div class="bg-red-50 rounded-2xl p-4 mb-8 border border-red-200">
            <p class="text-sm text-red-700 font-medium">
              <strong>⚠️ This action cannot be undone.</strong> The product will be permanently removed from the
              database.
            </p>
          </div>

          <div class="flex gap-3">
            <button
              :disabled="isDeleting"
              class="flex-1 px-6 py-3 bg-slate-200 text-slate-900 font-black rounded-2xl hover:bg-slate-300 transition-all disabled:opacity-50"
              @click="showDeleteConfirm = false"
            >
              Keep It
            </button>
            <button
              :disabled="isDeleting"
              class="flex-1 px-6 py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              @click="deleteProduct"
            >
              <span
                v-if="isDeleting"
                class="animate-spin border-2 border-white/30 border-t-white w-4 h-4 rounded-full"
              />
              {{ isDeleting ? 'Deleting...' : 'Yes, Delete' }}
            </button>
          </div>
        </div>
      </div>
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
</style>

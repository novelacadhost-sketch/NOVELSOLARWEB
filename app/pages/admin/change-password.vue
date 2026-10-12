<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

useHead({
  title: 'Change Password | Novel Solar Admin',
  meta: [{ name: 'description', content: 'Change your admin account password.' }],
})

const changePassword = async () => {
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    errorMessage.value = 'All password fields are required.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'New password and confirmation do not match.'
    return
  }

  if (newPassword.value.length < 8) {
    errorMessage.value = 'New password must be at least 8 characters long.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await useNuxtApp().$apiFetch<{ message: string }>('/api/admin/change-password', {
      method: 'POST',
      body: {
        current_password: currentPassword.value,
        new_password: newPassword.value,
      },
    })

    successMessage.value = response.message
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Failed to update password.'
  } finally {
    isSubmitting.value = false
  }
}

const handleLogout = async () => {
  try {
    await useNuxtApp().$apiFetch('/api/admin/auth/logout', { method: 'POST' })
    await navigateTo('/admin/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <div class="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div class="text-center lg:text-left">
          <h1 class="text-4xl font-black text-slate-900 mb-2 tracking-tight">Change Password</h1>
          <p class="text-slate-500 font-medium italic">Update your admin password securely.</p>
        </div>

        <div class="flex flex-wrap justify-center lg:justify-end items-center gap-3 lg:max-w-[50%]">
          <NuxtLink
            to="/admin/add-product"
            class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold flex items-center gap-2 text-sm transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-sm">add_box</span>
            Add Products
          </NuxtLink>
          <NuxtLink
            to="/admin/manage-products"
            class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold flex items-center gap-2 text-sm transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-sm">inventory_2</span>
            Manage Inventory
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

      <div class="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div>
          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Current Password</label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">lock</span>
            <input
              v-model="currentPassword"
              :type="showCurrentPassword ? 'text' : 'password'"
              class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-slate-900 font-medium outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all"
              :disabled="isSubmitting"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              @click="showCurrentPassword = !showCurrentPassword"
            >
              <span class="material-symbols-outlined">{{ showCurrentPassword ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">New Password</label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400"
              >lock_reset</span
            >
            <input
              v-model="newPassword"
              :type="showNewPassword ? 'text' : 'password'"
              class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-slate-900 font-medium outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all"
              :disabled="isSubmitting"
              autocomplete="new-password"
            />
            <button
              type="button"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              @click="showNewPassword = !showNewPassword"
            >
              <span class="material-symbols-outlined">{{ showNewPassword ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
            >Confirm New Password</label
          >
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400"
              >lock_check</span
            >
            <input
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-slate-900 font-medium outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all"
              :disabled="isSubmitting"
              autocomplete="new-password"
            />
            <button
              type="button"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              @click="showConfirmPassword = !showConfirmPassword"
            >
              <span class="material-symbols-outlined">{{ showConfirmPassword ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>

        <div v-if="errorMessage" class="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-700">
          {{ successMessage }}
        </div>

        <button
          type="button"
          :disabled="isSubmitting"
          class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50"
          @click="changePassword"
        >
          {{ isSubmitting ? 'Updating...' : 'Change Password' }}
        </button>
      </div>
    </div>
  </div>
</template>

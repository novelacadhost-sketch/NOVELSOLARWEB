<template>
  <div class="space-y-6">
    <div class="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
      <div class="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="text-2xl font-black text-slate-900">Admin Management</h2>
          <p class="text-slate-500 text-sm font-medium mt-1">Create new admin accounts and review current access.</p>
        </div>
        <span
          v-if="isMasterAdmin"
          class="text-xs font-black text-red-600 bg-red-50 px-3 py-2 rounded-full border border-red-100"
          >MASTER ADMIN</span
        >
      </div>

      <div v-if="loadError" class="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 mb-6">
        {{ loadError }}
      </div>

      <div v-if="isMasterAdmin" class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div class="bg-slate-50 rounded-3xl border border-slate-200 p-6 space-y-4">
          <h3 class="text-lg font-black text-slate-900">Create New Admin</h3>

          <div>
            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
            <input
              v-model="newAdminForm.email"
              type="email"
              placeholder="admin@example.com"
              class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
              :disabled="isCreatingAdmin"
            />
          </div>

          <div>
            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Username</label>
            <input
              v-model="newAdminForm.username"
              type="text"
              placeholder="john_admin"
              class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
              :disabled="isCreatingAdmin"
            />
          </div>

          <div v-if="createAdminError" class="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
            {{ createAdminError }}
          </div>

          <div
            v-if="createAdminSuccess"
            class="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-700 whitespace-pre-line"
          >
            {{ createAdminSuccess }}
          </div>

          <button
            type="button"
            :disabled="isCreatingAdmin || !newAdminForm.email || !newAdminForm.username"
            class="w-full bg-red-600 text-white py-3 rounded-2xl font-black hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            @click="createNewAdmin"
          >
            <span
              v-if="isCreatingAdmin"
              class="animate-spin border-2 border-white/30 border-t-white w-4 h-4 rounded-full"
            />
            {{ isCreatingAdmin ? 'Creating Admin...' : 'Create Admin' }}
          </button>
        </div>

        <div class="bg-slate-900 rounded-3xl p-6 text-white">
          <h3 class="text-lg font-black mb-4">What Happens Next</h3>
          <div class="space-y-3 text-sm text-slate-200">
            <p>The new admin is created in Supabase Auth and added to `admin_profiles`.</p>
            <p>A temporary password is generated so you can share access securely if needed.</p>
            <p>Only master admins can see and use this form.</p>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-black text-slate-900">Current Admin Accounts</h3>
          <button
            type="button"
            :disabled="isLoadingAdmins"
            class="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
            @click="loadAdmins"
          >
            {{ isLoadingAdmins ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <div
          v-if="deleteError"
          class="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 flex items-center justify-between gap-3"
        >
          <span>{{ deleteError }}</span>
          <button type="button" class="text-red-400 hover:text-red-600 font-black text-xs" @click="deleteError = ''">
            ✕ Dismiss
          </button>
        </div>

        <div v-if="isLoadingAdmins" class="text-center py-8 text-slate-500">Loading admin accounts...</div>

        <div
          v-else-if="admins.length === 0"
          class="text-center py-8 text-slate-500 bg-slate-50 rounded-2xl border border-slate-200"
        >
          No admin accounts found.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="admin in admins"
            :key="admin.user_id"
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 transition-all"
            :class="{ 'border-red-300 bg-red-50': confirmDeleteId === admin.user_id }"
          >
            <div>
              <p class="font-black text-slate-900">{{ admin.admin_username }}</p>
              <p class="text-sm text-slate-600">{{ admin.email }}</p>
            </div>

            <div class="flex items-center gap-3 text-xs font-bold flex-wrap justify-end">
              <span v-if="admin.is_master" class="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-100"
                >MASTER</span
              >
              <span class="text-slate-500">{{ formatDate(admin.created_at) }}</span>

              <!-- Delete action — master admin only, cannot delete self -->
              <template v-if="isMasterAdmin && admin.user_id !== currentUserId">
                <!-- Confirm prompt -->
                <div v-if="confirmDeleteId === admin.user_id" class="flex items-center gap-2">
                  <span class="text-red-600 font-black text-xs">Remove this admin?</span>
                  <button
                    type="button"
                    :disabled="deletingId === admin.user_id"
                    class="px-3 py-1.5 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                    @click="deleteAdmin(admin.user_id)"
                  >
                    <span
                      v-if="deletingId === admin.user_id"
                      class="animate-spin border-2 border-white/30 border-t-white w-3 h-3 rounded-full"
                    />
                    {{ deletingId === admin.user_id ? 'Removing…' : 'Yes, Remove' }}
                  </button>
                  <button
                    type="button"
                    :disabled="deletingId === admin.user_id"
                    class="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl font-black hover:bg-slate-300 transition-colors disabled:opacity-50"
                    @click="confirmDeleteId = null"
                  >
                    Cancel
                  </button>
                </div>

                <!-- Initial delete button -->
                <button
                  v-else
                  type="button"
                  class="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-xl font-black hover:bg-red-50 transition-colors flex items-center gap-1"
                  @click="confirmDeleteId = admin.user_id"
                >
                  <span class="material-symbols-outlined text-sm" style="font-size: 14px">person_remove</span>
                  Remove
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface Admin {
  user_id: string
  admin_username: string
  email: string
  is_master: boolean
  created_at: string
}

const admins = ref<Admin[]>([])
const isLoadingAdmins = ref(false)
const isCreatingAdmin = ref(false)
const isMasterAdmin = ref(false)
const currentUserId = ref<string | null>(null)
const loadError = ref('')
const createAdminError = ref('')
const createAdminSuccess = ref('')

// Delete admin state
const confirmDeleteId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const deleteError = ref('')

const newAdminForm = ref({
  email: '',
  username: '',
})

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

const loadAdmins = async () => {
  isLoadingAdmins.value = true
  loadError.value = ''

  try {
    const response = await $fetch<{ admins: Admin[]; isMasterAdmin: boolean; currentUserId?: string }>(
      '/api/admin/list-admins',
    )
    admins.value = response.admins || []
    isMasterAdmin.value = !!response.isMasterAdmin
    currentUserId.value = response.currentUserId || null
  } catch (error: any) {
    loadError.value = error?.data?.statusMessage || 'Failed to load admin accounts.'
    admins.value = []
    isMasterAdmin.value = false
  } finally {
    isLoadingAdmins.value = false
  }
}

const createNewAdmin = async () => {
  isCreatingAdmin.value = true
  createAdminError.value = ''
  createAdminSuccess.value = ''

  try {
    const response = await useNuxtApp().$apiFetch<{ message: string; temporaryPassword?: string }>('/api/admin/create-admin', {
      method: 'POST',
      body: {
        admin_email: newAdminForm.value.email,
        admin_username: newAdminForm.value.username,
      },
    })

    createAdminSuccess.value = response.temporaryPassword
      ? `${response.message}\nTemporary password: ${response.temporaryPassword}`
      : response.message
    newAdminForm.value = { email: '', username: '' }
    await loadAdmins()
  } catch (error: any) {
    createAdminError.value = error?.data?.statusMessage || 'Failed to create admin.'
  } finally {
    isCreatingAdmin.value = false
  }
}

const deleteAdmin = async (targetUserId: string) => {
  deletingId.value = targetUserId
  deleteError.value = ''

  try {
    await useNuxtApp().$apiFetch('/api/admin/delete-admin', {
      method: 'POST',
      body: { target_user_id: targetUserId },
    })
    confirmDeleteId.value = null
    await loadAdmins()
  } catch (error: any) {
    deleteError.value = error?.data?.statusMessage || 'Failed to remove admin.'
  } finally {
    deletingId.value = null
  }
}

onMounted(loadAdmins)
</script>

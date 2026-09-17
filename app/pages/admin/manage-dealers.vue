<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

useHead({
  title: 'Manage Dealers | Novel Solar Admin',
})

const { addToast } = useToast()

const dealers = ref<Record<string, unknown>[]>([])
const isLoading = ref(true)
const isActionLoading = ref<Record<string, boolean>>({})

const activeDealers = computed(() => {
  return dealers.value.filter((d) => d.status !== 'rejected')
})

const fetchDealers = async () => {
  isLoading.value = true
  try {
    const response = await useNuxtApp().$apiFetch<{ dealers: Record<string, unknown>[] }>('/api/admin/dealers')
    dealers.value = response.dealers as Record<string, unknown>[]
  } catch (error: unknown) {
    addToast('Error', 'Failed to fetch dealers', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchDealers()
})

const handleLogout = async () => {
  try {
    await useNuxtApp().$apiFetch('/api/admin/auth/logout', { method: 'POST' })
    await navigateTo('/admin/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

// Invitation flow has been removed in favor of passwordless OTP
const approveDealer = async (applicationId: string) => {
  isActionLoading.value[applicationId] = true
  try {
    await useNuxtApp().$apiFetch('/api/admin/approve-dealer', {
      method: 'POST',
      body: { applicationId },
    })
    addToast('Success', 'Dealer approved and invitation sent!', 'success')
    await fetchDealers()
  } catch (err: unknown) {
    const error = err as { statusMessage?: string }
    addToast('Error', error.statusMessage || 'Failed to approve dealer', 'error')
  } finally {
    isActionLoading.value[applicationId] = false
  }
}

const showConfirmModal = ref(false)
const dealerToRemove = ref<string | null>(null)

const initiateRejectDealer = (applicationId: string) => {
  dealerToRemove.value = applicationId
  showConfirmModal.value = true
}

const cancelRemoval = () => {
  showConfirmModal.value = false
  dealerToRemove.value = null
}

const confirmRejectDealer = async () => {
  const applicationId = dealerToRemove.value
  if (!applicationId) return

  isActionLoading.value[applicationId] = true
  try {
    await useNuxtApp().$apiFetch('/api/admin/reject-dealer', {
      method: 'POST',
      body: { applicationId },
    })
    addToast('Success', 'Dealer rejected/removed successfully.', 'success')
    showConfirmModal.value = false
    dealerToRemove.value = null
    await fetchDealers()
  } catch (err: unknown) {
    const error = err as { statusMessage?: string }
    addToast('Error', error.statusMessage || 'Failed to reject dealer', 'error')
  } finally {
    isActionLoading.value[applicationId] = false
  }
}

const isExpired = (invitation: Record<string, unknown> | null | undefined) => {
  if (!invitation) return false
  if (invitation.used) return false
  return new Date(invitation.expires_at as string) < new Date()
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <div class="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div class="text-center lg:text-left">
          <h1 class="text-4xl font-black text-slate-900 mb-2 tracking-tight">Manage Dealers</h1>
          <p class="text-slate-500 font-medium italic">Review applications and manage dealer invitations.</p>
        </div>

        <div class="flex flex-wrap justify-center lg:justify-end items-center gap-3">
          <NuxtLink
            to="/admin/dealers-trash"
            class="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm group"
            title="View Trash"
          >
            <span class="material-symbols-outlined group-hover:scale-110 transition-transform">delete</span>
          </NuxtLink>
          <button
            class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold flex items-center gap-2 text-sm transition-all"
            @click="handleLogout"
          >
            Logout
          </button>
        </div>
      </div>

      <div class="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div v-if="isLoading" class="p-12 text-center text-slate-500 font-bold">
          <div class="w-8 h-8 border-4 border-[#002888]/20 border-t-[#002888] rounded-full animate-spin mx-auto mb-4" />
          Loading dealers...
        </div>

        <div v-else-if="dealers.length === 0" class="p-12 text-center text-slate-500 font-medium">
          No dealer applications found.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Business</th>
                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Contact</th>
                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="dealer in activeDealers" :key="dealer.id" class="hover:bg-slate-50/50 transition-colors">
                <td class="p-4">
                  <p class="font-bold text-slate-900">{{ dealer.business_name }}</p>
                  <p class="text-sm text-slate-500">{{ dealer.email }}</p>
                </td>
                <td class="p-4">
                  <p class="font-medium text-slate-700">{{ dealer.contact_name }}</p>
                  <p class="text-sm text-slate-500">{{ dealer.phone }}</p>
                </td>
                <td class="p-4">
                  <span
                    :class="[
                      'px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-full',
                      dealer.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : dealer.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700',
                    ]"
                  >
                    {{ dealer.status }}
                  </span>
                </td>
                <td class="p-4 text-right">
                  <div v-if="dealer.status === 'pending'" class="flex items-center justify-end">
                    <button
                      class="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded transition-colors mr-2 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm font-bold tracking-wider uppercase"
                      :disabled="isActionLoading[dealer.id as string]"
                      @click="approveDealer(dealer.id as string)"
                    >
                      <span
                        v-if="isActionLoading[dealer.id as string]"
                        class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"
                      />
                      Approve
                    </button>
                    <button
                      class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50 shadow-sm font-bold tracking-wider uppercase"
                      @click="initiateRejectDealer(dealer.id as string)"
                    >
                      Reject
                    </button>
                  </div>
                  <div v-else class="flex items-center justify-end gap-3">
                    <span v-if="dealer.status === 'approved'" class="text-xs text-slate-400 font-medium italic mt-1"
                      >Account Active</span
                    >
                    <button
                      v-if="dealer.status === 'approved'"
                      class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50 shadow-sm font-bold tracking-wider uppercase inline-flex items-center gap-1.5"
                      :disabled="isActionLoading[dealer.id as string]"
                      @click="initiateRejectDealer(dealer.id as string)"
                    >
                      <span
                        v-if="isActionLoading[dealer.id as string]"
                        class="w-3 h-3 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin"
                      />
                      Remove
                    </button>
                    <span
                      v-else-if="dealer.status === 'rejected'"
                      class="text-xs text-slate-400 font-medium italic mt-1"
                      >Application Rejected</span
                    >
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div
      v-if="showConfirmModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
    >
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
        <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
          <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 class="text-xl font-bold text-center text-slate-900 mb-2">Remove Dealer?</h3>
        <p class="text-center text-slate-500 mb-6">
          Are you sure you want to reject or remove this dealer? This action will send them an email notification and
          immediately revoke their wholesale access if they were active.
        </p>
        <div class="flex gap-3 justify-center">
          <button
            class="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
            :disabled="dealerToRemove ? isActionLoading[dealerToRemove] : false"
            @click="cancelRemoval"
          >
            Cancel
          </button>
          <button
            class="px-5 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
            :disabled="dealerToRemove ? isActionLoading[dealerToRemove] : false"
            @click="confirmRejectDealer"
          >
            <span
              v-if="dealerToRemove && isActionLoading[dealerToRemove]"
              class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
            />
            Confirm Removal
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

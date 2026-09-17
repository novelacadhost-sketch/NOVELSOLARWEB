<template>
  <div class="min-h-screen bg-slate-50">
    <header class="bg-white border-b border-slate-200">
      <div class="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-4">
<NuxtLink
            to="/admin/customers-trash"
            class="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm group"
            title="View Trashed Customers"
          >
            <span class="material-symbols-outlined group-hover:scale-110 transition-transform">delete</span>
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Customer Directory</h1>
            <p class="text-sm text-slate-500 font-medium">Manage and view registered customers and dealers.</p>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <div v-if="pending" class="flex flex-col items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mb-4" />
        <p class="text-slate-500 font-medium">Loading customers...</p>
      </div>

      <div v-else-if="error" class="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 mb-8">
        <div class="flex items-center gap-3 font-bold mb-1">
          <span class="material-symbols-outlined">error</span>
          Failed to load customers
        </div>
        <p class="text-sm opacity-90">{{ error.message }}</p>
      </div>

      <div v-else>
        <!-- Search Bar -->
        <div class="mb-6 flex gap-4">
          <div class="relative flex-1 max-w-md">
            <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name or email..."
              class="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>
          <select
            v-model="roleFilter"
            class="px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
          >
            <option value="all">All Roles</option>
            <option value="customer">Regular Customers</option>
            <option value="dealer">Dealers</option>
          </select>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr
                  class="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500 uppercase tracking-wider"
                >
                  <th class="px-6 py-4">Name</th>
                  <th class="px-6 py-4">Email</th>
                  <th class="px-6 py-4">Role</th>
                  <th class="px-6 py-4">Joined</th>
                  <th class="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="customer in filteredCustomers"
                  :key="customer.id"
                  class="hover:bg-slate-50 transition-colors group cursor-pointer"
                  @click="navigateTo('/admin/customers/' + customer.id)"
                >
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-900">
                      {{
                        customer.first_name || customer.last_name
                          ? `${customer.first_name || ''} ${customer.last_name || ''}`
                          : 'Unknown'
                      }}
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm font-medium text-slate-600">{{ customer.email || 'N/A' }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                      :class="
                        customer.role === 'dealer' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'
                      "
                    >
                      {{ customer.role === 'dealer' ? 'Dealer' : 'Customer' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm text-slate-500 font-medium">
                    {{ new Date(customer.created_at).toLocaleDateString() }}
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-3 items-center">
                      <NuxtLink
                        :to="'/admin/customers/' + customer.id"
                        class="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                        @click.stop
                      >
                        View Profile
                        <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </NuxtLink>
                      <button
                        class="inline-flex items-center gap-1.5 text-sm font-bold text-red-500 hover:text-red-700 transition-colors"
                        :disabled="isTrashing === customer.id"
                        @click.stop="handleTrashCustomer(customer.id)"
                      >
                        <span
                          v-if="isTrashing === customer.id"
                          class="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"
                        />
                        <span v-else class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredCustomers.length === 0">
                  <td colspan="5" class="px-6 py-12 text-center text-slate-500 font-medium">
                    No customers found matching your criteria.
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
            <span class="material-symbols-outlined text-red-600">delete</span>
          </div>
          <h3 class="text-xl font-bold text-center text-slate-900 mb-2">Remove Customer?</h3>
          <p class="text-center text-slate-500 mb-6">
            Are you sure you want to remove this customer? They will be moved to the trash.
          </p>
          <div class="flex gap-3 justify-center">
            <button
              class="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
              :disabled="isTrashing !== null"
              @click="cancelRemoval"
            >
              Cancel
            </button>
            <button
              class="px-5 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              :disabled="isTrashing !== null"
              @click="confirmTrashCustomer"
            >
              <span
                v-if="isTrashing !== null"
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              />
              Confirm Removal
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Manage Customers | Admin' })

const { addToast } = useToast()

const searchQuery = ref('')
const roleFilter = ref('all')

const { data, pending, error, refresh } = useFetch('/api/admin/customers')

const isTrashing = ref<string | null>(null)
const showConfirmModal = ref(false)
const customerToRemove = ref<string | null>(null)

const handleTrashCustomer = (id: string) => {
  customerToRemove.value = id
  showConfirmModal.value = true
}

const cancelRemoval = () => {
  showConfirmModal.value = false
  customerToRemove.value = null
}

const confirmTrashCustomer = async () => {
  if (!customerToRemove.value) return
  const id = customerToRemove.value
  isTrashing.value = id

  try {
    await useNuxtApp().$apiFetch('/api/admin/trash-customer', {
      method: 'POST',
      body: { customerId: id },
    })
    addToast('Success', 'Customer moved to trash successfully.', 'success')
    showConfirmModal.value = false
    customerToRemove.value = null
    await refresh()
  } catch (err: any) {
    addToast('Error', err.data?.statusMessage || err.message || 'Failed to trash customer', 'error')
  } finally {
    isTrashing.value = null
  }
}

const filteredCustomers = computed(() => {
  if (!data.value?.customers) return []

  let result = data.value.customers

  if (roleFilter.value !== 'all') {
    result = result.filter((c: Record<string, unknown>) => c.role === roleFilter.value)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((c: Record<string, unknown>) => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase()
      const email = (c.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }

  return result
})
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 48;
}
</style>

<template>
  <div class="min-h-screen bg-slate-50 pb-12">
    <header class="bg-white border-b border-slate-200">
      <div class="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-4">
          <NuxtLink
            to="/admin/manage-customers"
            class="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Back to Directory"
          >
            <span class="material-symbols-outlined text-2xl">arrow_back</span>
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Customer Profile</h1>
            <p class="text-sm text-slate-500 font-medium">View details and purchase history.</p>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-8">
      <div v-if="pending" class="flex flex-col items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mb-4" />
        <p class="text-slate-500 font-medium">Loading profile...</p>
      </div>

      <div v-else-if="error" class="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 mb-8">
        <div class="flex items-center gap-3 font-bold mb-1">
          <span class="material-symbols-outlined">error</span>
          Failed to load profile
        </div>
        <p class="text-sm opacity-90">{{ error.message }}</p>
      </div>

      <div v-else-if="data?.customer">
        <!-- Profile Card -->
        <div
          class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mb-8 p-8 flex flex-col md:flex-row gap-8 items-start"
        >
          <div
            class="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200"
          >
            <span class="material-symbols-outlined text-5xl text-slate-400">person</span>
          </div>

          <div class="flex-1 w-full">
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <h2 class="text-3xl font-black text-slate-900 tracking-tight mb-1">
                  {{
                    data.customer.first_name || data.customer.last_name
                      ? `${data.customer.first_name || ''} ${data.customer.last_name || ''}`
                      : 'Unknown Customer'
                  }}
                </h2>
                <div class="flex items-center gap-2 text-slate-500 font-medium">
                  <span class="material-symbols-outlined text-[18px]">mail</span>
                  {{ data.customer.email || 'No email provided' }}
                </div>
              </div>
              <span
                class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold self-start"
                :class="
                  data.customer.role === 'dealer' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'
                "
              >
                {{ data.customer.role === 'dealer' ? 'Authorized Dealer' : 'Regular Customer' }}
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account ID</div>
                <div class="font-medium text-slate-900 truncate" :title="data.customer.id">{{ data.customer.id }}</div>
              </div>
              <div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Member Since</div>
                <div class="font-medium text-slate-900">
                  {{
                    new Date(data.customer.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  }}
                </div>
              </div>
              <div v-if="data.customer.role === 'dealer'">
                <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dealer Status</div>
                <div class="font-medium text-slate-900 capitalize">{{ data.customer.dealer_status || 'None' }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Order History -->
        <h3 class="text-xl font-black text-slate-900 tracking-tight mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-slate-400">shopping_bag</span>
          Purchase History
        </h3>

        <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div v-if="data.orders && data.orders.length > 0" class="divide-y divide-slate-100">
            <div v-for="order in data.orders" :key="order.id" class="p-6 hover:bg-slate-50 transition-colors">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div class="font-bold text-slate-900 text-lg mb-1">
                    Order #{{ order.id.substring(0, 8).toUpperCase() }}
                  </div>
                  <div class="text-sm font-medium text-slate-500">
                    {{ new Date(order.created_at).toLocaleString() }}
                  </div>
                </div>
                <div class="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2">
                  <div class="font-black text-slate-900 text-lg">
                    ₦{{ order.total ? order.total.toLocaleString() : '0' }}
                  </div>
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize"
                    :class="{
                      'bg-emerald-100 text-emerald-700': order.status === 'completed' || order.status === 'delivered',
                      'bg-amber-100 text-amber-700': order.status === 'pending' || order.status === 'processing',
                      'bg-slate-100 text-slate-700': !['completed', 'delivered', 'pending', 'processing'].includes(
                        order.status,
                      ),
                    }"
                  >
                    {{ order.status || 'Unknown' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="p-12 text-center flex flex-col items-center">
            <div
              class="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100"
            >
              <span class="material-symbols-outlined text-3xl text-slate-300">receipt_long</span>
            </div>
            <h4 class="text-lg font-bold text-slate-900 mb-1">No Orders Found</h4>
            <p class="text-slate-500 font-medium max-w-sm">
              This customer hasn't placed any orders yet, or their orders are exclusively managed in the Bitrix CRM
              system.
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const customerId = route.params.id

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Customer Profile | Admin' })

const { data, pending, error } = useFetch(`/api/admin/customer/${customerId}`)
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

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="bg-white border-b border-slate-200">
      <div class="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-4">
          <NuxtLink to="/admin" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl" title="Dashboard">
            <span class="material-symbols-outlined">arrow_back</span>
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Orders</h1>
            <p class="text-sm text-slate-500 font-medium">
              Website and app orders. Collection and delivery are tracked in Bitrix.
            </p>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            v-for="t in TABS"
            :key="t.id"
            class="px-4 py-2 rounded-xl text-sm font-bold border transition"
            :class="tab === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'"
            @click="tab = t.id"
          >
            {{ t.label }}
            <span
              v-if="t.id === 'queue' && queueCount"
              class="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs"
              >{{ queueCount }}</span
            >
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <!-- Orders -->
      <template v-if="tab === 'orders'">
        <div class="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            v-model="search"
            type="search"
            placeholder="Search by order number, name, email or phone"
            class="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400"
          />
          <select
            v-model="filter"
            class="px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
          >
            <option value="all">All orders</option>
            <option value="paid">Paid online</option>
            <option value="awaiting">Awaiting payment (last hour)</option>
            <option value="abandoned">Payment not completed</option>
            <option value="store">Pay at store</option>
          </select>
        </div>

        <div v-if="error" class="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100">Could not load orders.</div>
        <div v-else class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th class="px-5 py-4">Date</th>
                  <th class="px-5 py-4">Order</th>
                  <th class="px-5 py-4">Customer</th>
                  <th class="px-5 py-4">Fulfilment</th>
                  <th class="px-5 py-4 text-right">Total</th>
                  <th class="px-5 py-4">Payment</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                <tr v-if="pending && !orders.length">
                  <td colspan="6" class="px-5 py-10 text-center text-slate-400">Loading…</td>
                </tr>
                <tr v-else-if="!orders.length">
                  <td colspan="6" class="px-5 py-10 text-center text-slate-400">No orders match.</td>
                </tr>
                <tr
                  v-for="order in orders"
                  :key="order.id"
                  class="hover:bg-slate-50 cursor-pointer"
                  @click="navigateTo(`/admin/orders/${order.id}`)"
                >
                  <td class="px-5 py-4 whitespace-nowrap text-slate-500">{{ formatOrderDate(order.createdAt) }}</td>
                  <td class="px-5 py-4">
                    <p class="font-bold text-slate-900 whitespace-nowrap">{{ shortRef(order.reference) }}</p>
                    <p class="text-xs text-slate-400">
                      {{ order.items.length }} item{{ order.items.length === 1 ? '' : 's' }}
                      <span v-if="order.promoCode" class="ml-1 font-bold text-emerald-600">{{ order.promoCode }}</span>
                    </p>
                  </td>
                  <td class="px-5 py-4">
                    <p class="font-bold text-slate-800">{{ order.customer.name || '—' }}</p>
                    <p class="text-xs text-slate-500">{{ order.customer.phone || order.customer.email }}</p>
                  </td>
                  <td class="px-5 py-4 text-slate-600">
                    {{ order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery' }}
                    <p class="text-xs text-slate-400">{{ order.branch }}</p>
                  </td>
                  <td class="px-5 py-4 text-right font-bold text-slate-900 whitespace-nowrap">
                    {{ formatNaira(order.total) }}
                  </td>
                  <td class="px-5 py-4">
                    <span
                      class="text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap"
                      :class="STATUS_TONE_CLASSES[order.status.tone]"
                      >{{ order.status.label }}</span
                    >
                    <p v-if="order.progress && !order.progress.cancelled" class="mt-1 text-xs text-slate-500 whitespace-nowrap">
                      {{ order.progress.label }}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="total > pageSize" class="flex items-center justify-between mt-4 text-sm">
          <span class="text-slate-500">{{ total }} orders</span>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 rounded-xl border border-slate-200 bg-white font-bold disabled:opacity-40"
              :disabled="page <= 1"
              @click="page--"
            >
              Previous
            </button>
            <button
              class="px-4 py-2 rounded-xl border border-slate-200 bg-white font-bold disabled:opacity-40"
              :disabled="page * pageSize >= total"
              @click="page++"
            >
              Next
            </button>
          </div>
        </div>
      </template>

      <!-- CRM queue -->
      <template v-else>
        <p class="text-sm text-slate-500 mb-4">
          Items waiting to reach Bitrix, or that gave up after 5 tries. Retry sends one again now. Check Bitrix first if
          you are unsure: an item someone already re-entered by hand would be created twice.
        </p>
        <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th class="px-5 py-4">Queued</th>
                <th class="px-5 py-4">What</th>
                <th class="px-5 py-4">State</th>
                <th class="px-5 py-4">Last error</th>
                <th class="px-5 py-4" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="!queue.length">
                <td colspan="5" class="px-5 py-10 text-center text-slate-400">Nothing waiting. Everything reached Bitrix.</td>
              </tr>
              <tr v-for="row in queue" :key="row.id">
                <td class="px-5 py-4 whitespace-nowrap text-slate-500">{{ formatOrderDate(row.createdAt) }}</td>
                <td class="px-5 py-4">
                  <NuxtLink
                    v-if="row.orderId"
                    :to="`/admin/orders/${row.orderId}`"
                    class="font-bold text-slate-900 hover:underline"
                    >{{ row.title }}</NuxtLink
                  >
                  <p v-else class="font-bold text-slate-900">{{ row.title }}</p>
                  <p class="text-xs text-slate-500">{{ row.contact }}</p>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <span
                    class="text-xs font-bold px-2.5 py-1 rounded-full border"
                    :class="row.status === 'failed' ? STATUS_TONE_CLASSES.bad : STATUS_TONE_CLASSES.warn"
                    >{{ row.status === 'failed' ? 'Gave up' : 'Waiting' }} · {{ row.attempts }} tries</span
                  >
                </td>
                <td class="px-5 py-4 text-xs text-slate-500 max-w-xs break-words">{{ row.lastError || '—' }}</td>
                <td class="px-5 py-4 text-right">
                  <button
                    class="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-40"
                    :disabled="retrying === row.id"
                    @click="retry(row.id)"
                  >
                    {{ retrying === row.id ? 'Sending…' : 'Retry now' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { STATUS_TONE_CLASSES, formatNaira, formatOrderDate } from '~/utils/money'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Orders | Novel Solar Admin' })

interface AdminOrder {
  id: string
  reference: string
  createdAt: string
  status: { label: string; tone: string }
  progress?: { label: string; cancelled: boolean }
  fulfillment: 'pickup' | 'delivery'
  branch: string | null
  total: number
  promoCode: string | null
  items: unknown[]
  customer: { name: string | null; email: string | null; phone: string | null }
}

interface QueueRow {
  id: string
  status: string
  attempts: number
  lastError: string | null
  createdAt: string
  orderId: string | null
  title: string
  contact: string | null
}

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'queue', label: 'Bitrix queue' },
] as const

const { addToast } = useToast()
const tab = ref<'orders' | 'queue'>(useRoute().query.tab === 'queue' ? 'queue' : 'orders')
const search = ref('')
const debouncedSearch = refDebounced(search, 350)
const filter = ref('all')
const page = ref(1)
watch([debouncedSearch, filter], () => {
  page.value = 1
})

const { data, pending, error } = await useFetch<{ orders: AdminOrder[]; total: number; pageSize: number }>(
  '/api/admin/orders',
  {
    query: { q: debouncedSearch, filter, page },
    headers: useRequestHeaders(['cookie']),
  },
)
const orders = computed(() => data.value?.orders ?? [])
const total = computed(() => data.value?.total ?? 0)
const pageSize = computed(() => data.value?.pageSize ?? 50)

const { data: queueData, refresh: refreshQueue } = await useFetch<{ rows: QueueRow[] }>('/api/admin/crm-outbox', {
  headers: useRequestHeaders(['cookie']),
})
const queue = computed(() => queueData.value?.rows ?? [])
const queueCount = computed(() => queue.value.length)

/** ORD-1791234567890-a1b2c3d4 -> A1B2C3D4: the part people read out on the phone. */
const shortRef = (ref: string) => (ref.match(/-([0-9a-f]{8})$/i)?.[1] ?? ref).toUpperCase()

const retrying = ref<string | null>(null)
async function retry(id: string) {
  retrying.value = id
  try {
    const api = useNuxtApp().$apiFetch
    await api('/api/admin/crm-outbox/retry', { method: 'POST', body: { id } })
    const result = await api<{ sent: number; failed: number }>('/api/admin/drain-crm-outbox', { method: 'POST' })
    if (result.sent > 0) addToast('Sent', 'The item reached Bitrix.', 'success')
    else addToast('Still failing', 'Bitrix refused it again. See the error for why.', 'error')
  } catch (err) {
    const message = (err as { data?: { statusMessage?: string } }).data?.statusMessage
    addToast('Retry failed', message || 'Could not retry this item.', 'error')
  } finally {
    retrying.value = null
    await refreshQueue()
  }
}
</script>

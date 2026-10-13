<template>
  <div class="min-h-screen bg-slate-50">
    <header class="bg-white border-b border-slate-200">
      <div class="max-w-5xl mx-auto px-6 py-6 flex items-center gap-4">
        <NuxtLink to="/admin/orders" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl" title="Orders">
          <span class="material-symbols-outlined">arrow_back</span>
        </NuxtLink>
        <div class="min-w-0">
          <h1 class="text-xl font-black text-slate-900 tracking-tight break-all">{{ order?.reference || 'Order' }}</h1>
          <p v-if="order" class="text-sm text-slate-500">Placed {{ formatOrderDate(order.createdAt) }}</p>
        </div>
        <span
          v-if="order"
          class="ml-auto text-sm font-bold px-3 py-1.5 rounded-full border whitespace-nowrap"
          :class="STATUS_TONE_CLASSES[order.status.tone]"
          >{{ order.status.label }}</span
        >
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-6 py-8">
      <div v-if="pending" class="h-64 bg-white rounded-3xl border border-slate-200 animate-pulse" />
      <div v-else-if="error || !order" class="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100">
        Order not found.
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <section class="bg-white rounded-3xl border border-slate-200 p-6">
            <h2 class="font-black text-slate-900 mb-4">Items</h2>
            <ul class="divide-y divide-slate-100">
              <li v-for="(item, i) in order.items" :key="i" class="flex items-center gap-4 py-3">
                <img
                  :src="item.image || '/images/placeholder.png'"
                  alt=""
                  class="w-12 h-12 rounded-xl bg-slate-100 object-contain shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-slate-900">{{ item.name }}</p>
                  <p class="text-xs text-slate-500">
                    Bitrix #{{ item.productId }} · {{ item.quantity }} × {{ formatNaira(item.unitPrice) }}
                    <span v-if="item.unitDiscount" class="text-emerald-600">
                      less {{ formatNaira(item.unitDiscount) }}</span
                    >
                  </p>
                </div>
                <span class="font-bold text-slate-900">{{
                  formatNaira((item.unitPrice - item.unitDiscount) * item.quantity)
                }}</span>
              </li>
            </ul>
            <dl class="mt-4 pt-4 border-t border-slate-100 space-y-1 text-sm">
              <div class="flex justify-between text-slate-500">
                <dt>Subtotal</dt>
                <dd>{{ formatNaira(order.subtotal) }}</dd>
              </div>
              <div v-if="order.discount" class="flex justify-between text-emerald-700">
                <dt>Discount{{ order.promoCode ? ` (${order.promoCode})` : '' }}</dt>
                <dd>−{{ formatNaira(order.discount) }}</dd>
              </div>
              <div class="flex justify-between font-black text-slate-900 text-base">
                <dt>Total</dt>
                <dd>{{ formatNaira(order.total) }}</dd>
              </div>
            </dl>
          </section>

          <section class="bg-white rounded-3xl border border-slate-200 p-6">
            <h2 class="font-black text-slate-900 mb-4">Payment</h2>
            <p class="text-sm text-slate-600 mb-3">
              {{ order.paymentMethod === 'paystack' ? 'Online via Paystack' : 'Pay at store on collection' }}
            </p>
            <ul v-if="order.events.length" class="space-y-3 text-sm">
              <li v-for="(event, i) in order.events" :key="i" class="bg-slate-50 rounded-2xl p-3">
                <p class="font-bold text-slate-800">{{ event.message || event.status }}</p>
                <p class="text-xs text-slate-500">{{ formatOrderDate(event.at) }}</p>
                <p v-if="event.paystack?.reference" class="text-xs text-slate-500 mt-1">
                  Paystack ref {{ event.paystack.reference }}<span v-if="event.paystack.channel">
                    · {{ event.paystack.channel }}</span
                  >
                </p>
              </li>
            </ul>
            <p v-else class="text-sm text-slate-400">No payment recorded.</p>
          </section>

          <section class="bg-white rounded-3xl border border-slate-200 p-6">
            <h2 class="font-black text-slate-900 mb-1">Bitrix</h2>
            <p v-if="!order.outbox.length" class="text-sm text-slate-500">
              Sent to Bitrix directly when the order was {{ order.paymentMethod === 'paystack' ? 'paid' : 'placed' }}.
              Look it up there by the order number above.
            </p>
            <ul v-else class="space-y-2 text-sm">
              <li v-for="row in order.outbox" :key="row.id" class="bg-slate-50 rounded-2xl p-3">
                <p class="font-bold text-slate-800">
                  {{ row.status === 'sent' ? 'Delivered to Bitrix' : row.status === 'failed' ? 'Gave up' : 'Waiting to send' }}
                  <span class="font-medium text-slate-500">after {{ row.attempts }} tries</span>
                </p>
                <p v-if="row.last_error && row.status !== 'sent'" class="text-xs text-red-600 mt-1 break-words">
                  {{ row.last_error }}
                </p>
                <NuxtLink
                  v-if="row.status !== 'sent'"
                  to="/admin/orders?tab=queue"
                  class="text-xs font-bold text-slate-900 underline"
                  >Retry from the Bitrix queue</NuxtLink
                >
              </li>
            </ul>
          </section>
        </div>

        <div class="space-y-6">
          <section class="bg-white rounded-3xl border border-slate-200 p-6 text-sm">
            <h2 class="font-black text-slate-900 mb-3">Customer</h2>
            <p class="font-bold text-slate-900">{{ order.customer.name || '—' }}</p>
            <p v-if="order.customer.phone">
              <a :href="`tel:${order.customer.phone}`" class="text-slate-600 hover:underline">{{ order.customer.phone }}</a>
            </p>
            <p v-if="order.customer.email">
              <a :href="`mailto:${order.customer.email}`" class="text-slate-600 hover:underline break-all">{{
                order.customer.email
              }}</a>
            </p>
            <p class="text-xs text-slate-400 mt-2">{{ order.customer.hasAccount ? 'Has an account' : 'Guest checkout' }}</p>
          </section>

          <section class="bg-white rounded-3xl border border-slate-200 p-6 text-sm">
            <h2 class="font-black text-slate-900 mb-3">{{ order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery' }}</h2>
            <p class="text-slate-700">{{ order.branch || 'No branch recorded' }}</p>
            <p v-if="order.fulfillment === 'delivery' && order.customer.address" class="text-slate-500 mt-2">
              {{ order.customer.address }}
            </p>
          </section>

          <section v-if="order.promoCode || order.staffBitrixId" class="bg-white rounded-3xl border border-slate-200 p-6 text-sm">
            <h2 class="font-black text-slate-900 mb-3">Promotion</h2>
            <p v-if="order.promoCode" class="text-slate-700">Code {{ order.promoCode }}</p>
            <p v-if="order.staffBitrixId" class="text-slate-500">Credited to Bitrix user #{{ order.staffBitrixId }}</p>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { STATUS_TONE_CLASSES, formatNaira, formatOrderDate } from '~/utils/money'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Order | Novel Solar Admin' })

interface AdminOrderDetail {
  reference: string
  createdAt: string
  status: { label: string; tone: string }
  paymentMethod: string | null
  fulfillment: 'pickup' | 'delivery'
  branch: string | null
  subtotal: number
  discount: number
  total: number
  promoCode: string | null
  staffBitrixId: number | null
  items: { productId: string | null; name: string; quantity: number; unitPrice: number; unitDiscount: number; image: string | null }[]
  customer: { name: string | null; email: string | null; phone: string | null; address: string | null; hasAccount: boolean }
  events: { status: string; message: string | null; at: string; paystack: { reference: unknown; channel: unknown } | null }[]
  outbox: { id: string; status: string; attempts: number; last_error: string | null }[]
}

const route = useRoute()
const { data, pending, error } = await useFetch<{ order: AdminOrderDetail }>(
  `/api/admin/orders/${route.params.id}`,
  { headers: useRequestHeaders(['cookie']) },
)
const order = computed(() => data.value?.order ?? null)

</script>

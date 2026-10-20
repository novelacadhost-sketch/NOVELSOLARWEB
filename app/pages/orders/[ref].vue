<template>
  <div class="min-h-screen bg-gray-50 py-10 px-4">
    <div class="max-w-3xl mx-auto">
      <NuxtLink to="/orders" class="inline-flex items-center gap-1 text-sm font-bold text-[#002888] hover:underline mb-6">
        <span class="material-symbols-outlined text-base">arrow_back</span> All orders
      </NuxtLink>

      <div v-if="pending" class="h-64 bg-white rounded-3xl border border-slate-200 animate-pulse" />

      <div v-else-if="error" class="bg-white rounded-3xl border border-slate-200 p-10 text-center">
        <h1 class="text-xl font-black text-slate-900 mb-2">
          {{ error.statusCode === 401 ? 'Sign in to see this order' : 'Order not found' }}
        </h1>
        <p class="text-slate-500 mb-6">
          {{
            error.statusCode === 401
              ? 'Sign in with the email address you used at checkout.'
              : 'It may belong to a different account. Check the order number in your confirmation email.'
          }}
        </p>
        <NuxtLink
          :to="error.statusCode === 401 ? '/login' : '/orders'"
          class="inline-block bg-[#002888] text-white px-8 py-3 rounded-xl font-bold"
          >{{ error.statusCode === 401 ? 'Sign in' : 'Your orders' }}</NuxtLink
        >
      </div>

      <template v-else-if="order">
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 mb-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Order</p>
              <h1 class="text-lg sm:text-xl font-black text-slate-900 break-all">{{ order.reference }}</h1>
              <p class="text-sm text-slate-500 mt-1">Placed {{ formatOrderDate(order.createdAt) }}</p>
            </div>
            <span
              class="text-sm font-bold px-3 py-1.5 rounded-full border"
              :class="STATUS_TONE_CLASSES[badge.tone]"
              >{{ badge.label }}</span
            >
          </div>

          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm">
            <div class="bg-slate-50 rounded-2xl p-4">
              <dt class="font-bold text-slate-500 mb-1">{{ order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery' }}</dt>
              <dd class="text-slate-900">
                <template v-if="order.fulfillment === 'pickup'">{{ order.branch || 'Branch to be confirmed' }}</template>
                <template v-else>Our team will call you to confirm the delivery charge and date.</template>
              </dd>
            </div>
            <div class="bg-slate-50 rounded-2xl p-4">
              <dt class="font-bold text-slate-500 mb-1">Payment</dt>
              <dd class="text-slate-900">{{ paymentText }}</dd>
            </div>
          </dl>
        </div>

        <div
          v-if="order.progress && !order.progress.cancelled"
          class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 mb-4"
        >
          <h2 class="font-black text-slate-900">{{ order.progress.label }}</h2>
          <p class="text-sm text-slate-500 mb-5">
            {{ order.progress.detail }}
            <template v-if="order.progress.updatedAt">Updated {{ formatOrderDate(order.progress.updatedAt) }}.</template>
          </p>
          <ol class="relative ml-3 border-l-2 border-slate-200 space-y-4">
            <li v-for="step in order.progress.steps" :key="step.key" class="relative pl-6">
              <span
                class="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full border-2"
                :class="
                  step.current
                    ? 'border-[#002888] bg-[#002888]'
                    : step.done
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-300 bg-white'
                "
              />
              <span
                class="text-sm"
                :class="step.current ? 'font-black text-[#002888]' : step.done ? 'font-bold text-slate-800' : 'text-slate-400'"
                >{{ step.label }}</span
              >
            </li>
          </ol>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 mb-4">
          <h2 class="font-black text-slate-900 mb-4">Items</h2>
          <ul class="divide-y divide-slate-100">
            <li v-for="(item, i) in order.items" :key="i" class="flex items-center gap-4 py-3">
              <img
                :src="item.image || '/images/placeholder.png'"
                :alt="item.name"
                class="w-14 h-14 rounded-xl bg-slate-100 object-contain shrink-0"
              />
              <div class="flex-1 min-w-0">
                <NuxtLink
                  v-if="item.productId"
                  :to="`/shop/${item.productId}`"
                  class="font-bold text-slate-900 hover:text-[#002888]"
                  >{{ item.name }}</NuxtLink
                >
                <p v-else class="font-bold text-slate-900">{{ item.name }}</p>
                <p class="text-sm text-slate-500">
                  {{ item.quantity }} × {{ formatNaira(item.unitPrice - item.unitDiscount) }}
                </p>
              </div>
              <span class="font-bold text-slate-900">{{
                formatNaira((item.unitPrice - item.unitDiscount) * item.quantity)
              }}</span>
            </li>
          </ul>

          <dl class="mt-4 pt-4 border-t border-slate-100 space-y-1 text-sm">
            <div v-if="order.discount > 0" class="flex justify-between text-slate-500">
              <dt>Subtotal</dt>
              <dd>{{ formatNaira(order.subtotal) }}</dd>
            </div>
            <div v-if="order.discount > 0" class="flex justify-between text-green-700">
              <dt>Discount{{ order.promoCode ? ` (${order.promoCode})` : '' }}</dt>
              <dd>−{{ formatNaira(order.discount) }}</dd>
            </div>
            <div class="flex justify-between font-black text-slate-900 text-base">
              <dt>Total</dt>
              <dd>{{ formatNaira(order.total) }}</dd>
            </div>
            <p v-if="order.fulfillment === 'delivery'" class="text-xs text-slate-400">Delivery charge not included.</p>
          </dl>
        </div>

        <div v-if="order.events.length" class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 mb-4">
          <h2 class="font-black text-slate-900 mb-4">Updates</h2>
          <ol class="space-y-2 text-sm">
            <li v-for="(event, i) in order.events" :key="i" class="flex gap-3">
              <span class="text-slate-400 whitespace-nowrap">{{ formatOrderDate(event.at) }}</span>
              <span class="text-slate-700">{{ event.message }}</span>
            </li>
          </ol>
        </div>

        <p class="text-sm text-slate-500 text-center">
          Questions about this order? <NuxtLink to="/contact" class="font-bold text-[#002888]">Contact us</NuxtLink>
          and quote the order number above.
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STATUS_TONE_CLASSES, formatNaira, formatOrderDate } from '~/utils/money'
import { orderBadge } from '~/utils/orderBadge'

interface OrderDetail {
  id: string
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
  items: { productId: string | null; name: string; quantity: number; unitPrice: number; unitDiscount: number; image: string | null }[]
  events: { message: string; at: string }[]
  progress: {
    label: string
    detail: string
    cancelled: boolean
    updatedAt: string | null
    steps: { key: string; label: string; done: boolean; current: boolean }[]
  }
}

const route = useRoute()
useHead({ title: 'Order details', meta: [{ name: 'robots', content: 'noindex' }] })

const { data, pending, error } = await useFetch<{ order: OrderDetail }>(
  `/api/user/orders/${encodeURIComponent(String(route.params.ref))}`,
  { headers: useRequestHeaders(['cookie']) },
)
const order = computed(() => data.value?.order ?? null)
const badge = computed(() => (order.value ? orderBadge(order.value) : { label: '', tone: 'info' }))

const paymentText = computed(() => {
  const o = order.value
  if (!o) return ''
  if (o.paymentMethod === 'paystack') {
    return o.status.label === 'Paid' ? 'Payment received' : 'Online payment (Paystack) not yet received'
  }
  if (o.status.label === 'Paid') return 'Payment received'
  return o.fulfillment === 'pickup' ? 'Pay at the store when you collect' : 'To be arranged with our team'
})
</script>

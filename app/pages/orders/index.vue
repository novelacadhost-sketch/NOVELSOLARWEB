<template>
  <div class="min-h-screen bg-gray-50 py-10 px-4">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between gap-4 mb-6">
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900">Your orders</h1>
        <NuxtLink to="/account" class="text-sm font-bold text-[#002888] hover:underline">Account</NuxtLink>
      </div>

      <div v-if="pending" class="space-y-3">
        <div v-for="n in 3" :key="n" class="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      </div>

      <div v-else-if="signedOut" class="bg-white rounded-3xl border border-slate-200 p-10 text-center">
        <span class="material-symbols-outlined text-5xl text-slate-300">lock</span>
        <h2 class="text-xl font-black text-slate-900 mt-3 mb-2">Sign in to see your orders</h2>
        <p class="text-slate-500 mb-6">
          Orders placed as a guest appear here once you sign in with the same email address.
        </p>
        <NuxtLink to="/login" class="inline-block bg-[#002888] text-white px-8 py-3 rounded-xl font-bold">
          Sign in
        </NuxtLink>
      </div>

      <div v-else-if="error" class="bg-red-50 text-red-700 rounded-2xl p-6">
        We could not load your orders. Please try again shortly.
      </div>

      <div v-else-if="!orders.length" class="bg-white rounded-3xl border border-slate-200 p-10 text-center">
        <span class="material-symbols-outlined text-5xl text-slate-300">receipt_long</span>
        <h2 class="text-xl font-black text-slate-900 mt-3 mb-2">No orders yet</h2>
        <p class="text-slate-500 mb-6">When you place an order, it will appear here.</p>
        <NuxtLink to="/shop" class="inline-block bg-[#002888] text-white px-8 py-3 rounded-xl font-bold">
          Browse the shop
        </NuxtLink>
      </div>

      <ul v-else class="space-y-3">
        <li v-for="order in orders" :key="order.id">
          <NuxtLink
            :to="`/orders/${order.reference}`"
            class="flex flex-col sm:flex-row sm:items-center gap-4 bg-white rounded-2xl border border-slate-200 p-5 hover:border-[#002888]/40 hover:shadow-sm transition"
          >
            <div class="flex -space-x-3 shrink-0">
              <img
                v-for="(item, i) in order.items.slice(0, 3)"
                :key="i"
                :src="item.image || '/images/placeholder.png'"
                :alt="item.name"
                class="w-12 h-12 rounded-xl border-2 border-white bg-slate-100 object-contain"
                loading="lazy"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-slate-900 truncate">
                {{ order.items[0]?.name || 'Order' }}
                <span v-if="order.items.length > 1" class="font-medium text-slate-500">
                  + {{ order.items.length - 1 }} more</span
                >
              </p>
              <p class="text-sm text-slate-500">
                {{ formatOrderDate(order.createdAt) }} ·
                {{ order.fulfillment === 'pickup' ? `Pickup${order.branch ? `, ${order.branch}` : ''}` : 'Delivery' }}
              </p>
              <p class="text-xs text-slate-400 mt-0.5 break-all">{{ order.reference }}</p>
            </div>
            <div class="flex sm:flex-col items-center sm:items-end justify-between gap-2">
              <span class="font-black text-slate-900">{{ formatNaira(order.total) }}</span>
              <span
                class="text-xs font-bold px-2.5 py-1 rounded-full border"
                :class="STATUS_TONE_CLASSES[order.status.tone]"
                >{{ order.status.label }}</span
              >
            </div>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STATUS_TONE_CLASSES, formatNaira, formatOrderDate } from '~/utils/money'

interface OrderSummary {
  id: string
  reference: string
  createdAt: string
  status: { label: string; tone: string }
  fulfillment: 'pickup' | 'delivery'
  branch: string | null
  total: number
  items: { name: string; image: string | null }[]
}

useHead({ title: 'Your orders', meta: [{ name: 'robots', content: 'noindex' }] })

const { data, pending, error } = await useFetch<{ orders: OrderSummary[] }>('/api/user/orders', {
  headers: useRequestHeaders(['cookie']),
})

const signedOut = computed(() => error.value?.statusCode === 401)
const orders = computed(() => data.value?.orders ?? [])
</script>

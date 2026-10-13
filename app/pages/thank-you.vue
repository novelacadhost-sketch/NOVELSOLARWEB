<template>
  <div class="min-h-[80vh] flex items-center justify-center px-4 py-10">
    <div class="max-w-xl w-full py-10 px-6 sm:px-8 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5">
      <div class="text-center">
        <div class="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span class="material-symbols-outlined text-5xl text-green-500">check_circle</span>
        </div>
        <h1 class="text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight">Thank you for your order</h1>
        <p v-if="reference" class="text-slate-500">
          Order number <span class="font-bold text-slate-900 break-all">{{ reference }}</span>
        </p>
        <p class="text-xs text-slate-400 mt-1">Quote this number if you contact us about the order.</p>
      </div>

      <!-- Payment outcome. Set by the Paystack callback, or by checkout for
           pay-at-store and for a payment that could not be started. -->
      <div v-if="payment" class="mt-8 rounded-2xl border p-4 text-left" :class="paymentStyle.box">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-xl" :class="paymentStyle.icon">{{ paymentStyle.symbol }}</span>
          <div>
            <p class="font-bold text-sm" :class="paymentStyle.title">{{ paymentStyle.heading }}</p>
            <p class="text-xs mt-0.5" :class="paymentStyle.body">{{ paymentStyle.detail }}</p>
          </div>
        </div>
      </div>

      <div v-if="order?.items.length" class="mt-8">
        <h2 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Your order</h2>
        <ul class="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
          <li v-for="(item, i) in order.items" :key="i" class="flex items-center gap-3 p-3">
            <img
              :src="item.image || '/images/placeholder.png'"
              :alt="item.name"
              class="w-12 h-12 rounded-lg bg-slate-50 object-contain shrink-0"
            />
            <span class="flex-1 text-sm font-bold text-slate-800">{{ item.name }}</span>
            <span class="text-sm text-slate-500">× {{ item.quantity }}</span>
          </li>
        </ul>
        <dl v-if="order.total != null" class="mt-3 space-y-1 text-sm px-1">
          <div v-if="order.discount" class="flex justify-between text-green-700">
            <dt>Discount</dt>
            <dd>−{{ formatNaira(order.discount) }}</dd>
          </div>
          <div class="flex justify-between font-black text-slate-900">
            <dt>Total</dt>
            <dd>{{ formatNaira(order.total) }}</dd>
          </div>
          <p v-if="order.fulfillment === 'delivery'" class="text-xs text-slate-400">Delivery charge not included.</p>
        </dl>
      </div>

      <div class="bg-slate-50 p-6 rounded-2xl mt-8 text-left border border-slate-100">
        <h2 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">What happens next</h2>
        <ol class="space-y-3">
          <li v-for="(step, i) in nextSteps" :key="i" class="flex items-start gap-3 text-sm text-slate-700 font-bold">
            <span
              class="w-5 h-5 rounded-full bg-[#002888] text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5"
              >{{ i + 1 }}</span
            >
            {{ step }}
          </li>
        </ol>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 mt-8">
        <NuxtLink
          v-if="user && reference"
          :to="`/orders/${reference}`"
          class="flex-1 text-center bg-[#002888] text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-900 transition-all"
        >
          View your order
        </NuxtLink>
        <NuxtLink
          v-else
          to="/"
          class="flex-1 text-center bg-[#002888] text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-900 transition-all"
        >
          Return home
        </NuxtLink>
        <NuxtLink
          to="/shop"
          class="flex-1 text-center bg-white border-2 border-slate-100 text-slate-700 py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
        >
          Keep shopping
        </NuxtLink>
      </div>

      <p class="mt-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
        Questions?
        <a :href="whatsappHref" target="_blank" rel="noopener" class="text-[#002888] hover:underline"
          >Chat with sales on WhatsApp</a
        >
      </p>
    </div>
  </div>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 1,
    'wght' 600,
    'GRAD' 0,
    'opsz' 48;
}
</style>

<script setup lang="ts">
import { formatNaira } from '~/utils/money'
import { readLastOrder, type LastOrder } from '~/utils/lastOrder'

useHead({
  title: 'Thank You!',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const route = useRoute()
const user = useSupabaseUser()
const whatsappHref = `https://wa.me/${useRuntimeConfig().public.whatsappNumber}`
const payment = computed(() => String(route.query.payment || ''))
const reference = computed(() => String(route.query.ref || '') || order.value?.reference || '')

// sessionStorage exists only in the browser, so this fills in after mount.
const order = ref<LastOrder | null>(null)
onMounted(() => {
  order.value = readLastOrder(String(route.query.ref || '') || null)
})

const nextSteps = computed(() => {
  const pickup = order.value?.fulfillment === 'pickup'
  const branch = order.value?.branch
  if (pickup) {
    return [
      'We have emailed you a receipt with your order number.',
      `${branch ? `Our ${branch} team` : 'Your branch'} is preparing your items and will contact you when they are ready.`,
      payment.value === 'store'
        ? 'Bring your order number and pay when you collect.'
        : 'Bring your order number when you collect.',
    ]
  }
  return [
    'We have emailed you a receipt with your order number.',
    'Our team will call you to confirm the delivery charge and agree a delivery date.',
    'Your items are dispatched once the delivery is agreed.',
  ]
})

// 'pending' and 'review' are deliberately not failures. The customer may well
// have paid; what is unresolved is our record of it, and telling them their
// payment failed when it did not is the worse error.
const PAYMENT_STATES: Record<string, { heading: string; detail: string; symbol: string; tone: 'ok' | 'warn' | 'bad' }> =
  {
    success: {
      heading: 'Payment received',
      detail: 'Your payment has been confirmed and your order is being processed.',
      symbol: 'check_circle',
      tone: 'ok',
    },
    store: {
      heading: 'Pay when you collect',
      detail: 'Your order is reserved. Payment is taken at the store when you pick it up.',
      symbol: 'storefront',
      tone: 'ok',
    },
    failed: {
      heading: 'Payment not completed',
      detail: 'Your order is saved but unpaid. Our team will contact you to arrange payment.',
      symbol: 'error',
      tone: 'bad',
    },
    pending: {
      heading: 'Payment is being confirmed',
      detail: 'We could not confirm the payment just now. If it left your account, it will be matched shortly.',
      symbol: 'schedule',
      tone: 'warn',
    },
    review: {
      heading: 'Payment needs review',
      detail: 'The amount received does not match the order total. Our team will be in touch.',
      symbol: 'help',
      tone: 'warn',
    },
    unknown: {
      heading: 'Order received',
      detail: 'We could not read a payment reference for this order.',
      symbol: 'info',
      tone: 'warn',
    },
  }

const TONES = {
  ok: {
    box: 'bg-green-50 border-green-200',
    icon: 'text-green-600',
    title: 'text-green-900',
    body: 'text-green-800',
  },
  warn: {
    box: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-800',
  },
  bad: { box: 'bg-red-50 border-red-200', icon: 'text-red-600', title: 'text-red-900', body: 'text-red-800' },
}

const paymentStyle = computed(() => {
  const state = PAYMENT_STATES[payment.value] ?? PAYMENT_STATES.unknown!
  return { ...state, ...TONES[state.tone] }
})
</script>

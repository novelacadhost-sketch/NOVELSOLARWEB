<template>
  <div class="min-h-[80vh] flex items-center justify-center px-4">
    <div
      class="max-w-xl w-full text-center py-12 px-8 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5"
    >
      <div class="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
        <span class="material-symbols-outlined text-5xl text-green-500">check_circle</span>
      </div>

      <h1 class="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight uppercase">Order Received!</h1>
      <p class="text-slate-500 text-lg mb-10 leading-relaxed font-bold italic">
        "Powering your world, one panel at a time."
      </p>

      <!-- Payment outcome, set by the Paystack callback redirect. Absent for
           orders that were not paid online, which is the normal case today. -->
      <div v-if="payment" class="mb-8 rounded-2xl border p-4 text-left" :class="paymentStyle.box">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-xl" :class="paymentStyle.icon">{{ paymentStyle.symbol }}</span>
          <div>
            <p class="font-bold text-sm" :class="paymentStyle.title">{{ paymentStyle.heading }}</p>
            <p class="text-xs mt-0.5" :class="paymentStyle.body">{{ paymentStyle.detail }}</p>
            <p v-if="reference" class="text-[10px] mt-2 font-mono text-slate-500">Ref: {{ reference }}</p>
          </div>
        </div>
      </div>

      <div class="bg-slate-50 p-6 rounded-2xl mb-10 text-left border border-slate-100">
        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Next Steps</h3>
        <ul class="space-y-3">
          <li class="flex items-start gap-3 text-sm text-slate-700 font-bold">
            <span
              class="w-5 h-5 rounded-full bg-[#002888] text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5"
              >1</span
            >
            Check your email for a detailed order receipt.
          </li>
          <li class="flex items-start gap-3 text-sm text-slate-700 font-bold">
            <span
              class="w-5 h-5 rounded-full bg-[#002888] text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5"
              >2</span
            >
            Our logistics team will call you to confirm delivery.
          </li>
          <li class="flex items-start gap-3 text-sm text-slate-700 font-bold">
            <span
              class="w-5 h-5 rounded-full bg-[#002888] text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5"
              >3</span
            >
            Your assigned branch is preparing your items.
          </li>
        </ul>
      </div>

      <div class="flex flex-col sm:flex-row gap-4">
        <NuxtLink
          to="/"
          class="flex-1 bg-[#002888] text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-900 transition-all shadow-lg active:scale-95"
        >
          Return Home
        </NuxtLink>
        <NuxtLink
          to="/shop"
          class="flex-1 bg-white border-2 border-slate-100 text-slate-700 py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
        >
          Keep Shopping
        </NuxtLink>
      </div>

      <p class="mt-12 text-slate-400 text-xs font-bold uppercase tracking-widest">
        Questions? <a href="#" class="text-[#002888] hover:underline">Chat with Sales</a>
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
useHead({
  title: 'Thank You! | NovelSolar',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const route = useRoute()
const payment = computed(() => String(route.query.payment || ''))
const reference = computed(() => String(route.query.ref || ''))

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

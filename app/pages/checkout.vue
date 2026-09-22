<script setup lang="ts">
import { z } from 'zod'
const { cart, cartTotalAmount } = useCart()
const { addToast } = useToast()

const selectedFulfillment = ref('delivery') // 'delivery' or 'pickup'
const selectedState = ref('')
const selectedBranch = ref(null)

const suggestedBranches = computed(() => {
  if (!selectedState.value) return []

  // 1. If we have exact matches, return them immediately
  if (exactMatches.value.length > 0) {
    return exactMatches.value
  }

  // 2. Otherwise, find the closest branches via coordinates
  const stateData = nigerianStates.find((s) => s.name === selectedState.value)
  if (!stateData) return []

  const sorted = [...branches].sort((a, b) => {
    const distA = getDistance(stateData.coords[0], stateData.coords[1], a.coordinates[0], a.coordinates[1])
    const distB = getDistance(stateData.coords[0], stateData.coords[1], b.coordinates[0], b.coordinates[1])
    return distA - distB
  })

  return sorted.slice(0, 3)
})

// Matched on the `state` field only — see branchesInState(). The old address
// substring fallback showed a Benin branch to Lagos customers, among others.
const exactMatches = computed(() => branchesInState(selectedState.value))

// Form state
const isSubmitting = ref(false)
const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  note: '',
})
// Pay-now checkout, off until Paystack can actually charge. The new step
// offers Paystack as the only delivery option, so shipping it early would
// leave delivery uncheckoutable. See nuxt.config.ts.
const newCheckout = useRuntimeConfig().public.newCheckout

const paymentMethod = ref(newCheckout ? 'paystack' : 'Cash on Delivery')

// Delivery can only be paid online, because the cost is not known yet and an
// agent settles it afterwards — there is no counter at which to pay.
const paymentOptions = computed(() =>
  selectedFulfillment.value === 'pickup'
    ? [
        { value: 'paystack', label: 'Pay Now', hint: 'Card or transfer via Paystack', icon: 'credit_card' },
        { value: 'pay_at_store', label: 'Pay at Store', hint: 'Pay when you collect your items', icon: 'storefront' },
      ]
    : [{ value: 'paystack', label: 'Pay Now', hint: 'Card or transfer via Paystack', icon: 'credit_card' }],
)

// Switching to delivery while "Pay at Store" is selected would otherwise
// submit a payment method that is not on offer.
watch(selectedFulfillment, () => {
  if (!newCheckout) return
  if (!paymentOptions.value.some((o) => o.value === paymentMethod.value)) {
    paymentMethod.value = 'paystack'
  }
})

const formErrors = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
})

const checkoutSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^(\+234|0)[789][01]\d{8}$/, 'Must be a valid 11-digit Nigerian phone number'),
  address: z.string().min(5, 'Please provide a full delivery address'),
  note: z.string().optional(),
})

const submitOrder = async () => {
  if (cart.value.length === 0) {
    addToast('Empty Cart', 'Please add some solar equipment to your cart.', 'error')
    return
  }

  // Clear previous errors
  Object.keys(formErrors).forEach((key) => (formErrors[key] = ''))

  // Validate form payload
  const result = checkoutSchema.safeParse(form)
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      if (issue.path[0]) {
        formErrors[issue.path[0]] = issue.message
      }
    })
    addToast('Validation Error', 'Please correct the highlighted fields.', 'error')
    return
  }

  isSubmitting.value = true
  try {
    const response = await useNuxtApp().$apiFetch<{ paymentUrl?: string | null; paymentPending?: boolean }>('/api/checkout', {
      method: 'POST',
      body: {
        customer: form,
        cart: cart.value.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
        branch: selectedBranch.value,
        paymentMethod: paymentMethod.value,
        // Was never sent before 2026-09-22, so the server guessed it from
        // paymentMethod and every store pickup was recorded as a delivery.
        fulfillment: selectedFulfillment.value,
      },
    })

    cart.value = []

    // Pay now: hand the customer to Paystack. A full page navigation, not
    // navigateTo — the destination is off-site.
    if (response?.paymentUrl) {
      window.location.href = response.paymentUrl
      return
    }

    // The order is placed and in the CRM, but the payment could not be opened.
    // Saying "order placed" alone would leave them expecting a payment screen
    // that never comes.
    if (response?.paymentPending) {
      addToast('Order Placed', 'We could not start the payment. Our team will contact you to complete it.', 'info')
      navigateTo('/thank-you?payment=pending')
      return
    }

    addToast('Order Placed', 'Your order was successfully sent to NovelSolar!', 'success')
    navigateTo('/thank-you')
  } catch (error) {
    addToast('Order Error', 'There was an issue processing your order. Please try again.', 'error')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  try {
    const profile = await useNuxtApp().$apiFetch('/api/user/profile')
    if (profile) {
      // Auto-fill form fields if data exists
      if (profile.firstName) form.firstName = profile.firstName
      if (profile.lastName) form.lastName = profile.lastName
      if (profile.email) form.email = profile.email
      if (profile.phone) form.phone = profile.phone
      if (profile.address) form.address = profile.address
    }
  } catch (error) {
    // Silent fail for guest checkout
    console.log('Guest checkout initiated - profile fetch skipped')
  }
})
</script>

<template>
  <main class="max-w-6xl mx-auto w-full px-4 md:px-6 py-8 md:py-12">
    <div v-if="cart.length === 0" class="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <span class="material-symbols-outlined text-4xl text-gray-300">shopping_cart</span>
      </div>
      <h2 class="text-2xl font-bold text-slate-900 mb-2">Your cart is empty</h2>
      <p class="text-gray-500 mb-8">Add some solar equipment to your cart before checking out.</p>
      <NuxtLink
        to="/products"
        class="bg-[#002888] text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-900 transition-all shadow-lg inline-block"
      >
        Return to Shop
      </NuxtLink>
    </div>

    <div v-else class="flex flex-col lg:flex-row gap-12">
      <!-- Left Column: Forms -->
      <div class="flex-1 space-y-10">
        <!-- Contact Information -->
        <section class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="w-8 h-8 rounded-full bg-[#002888] text-white flex items-center justify-center text-sm font-bold"
              >1</span
            >
            <h2 class="text-xl font-bold text-slate-900">Contact Information</h2>
          </div>
          <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1.5"
                >Email Address <span class="text-red-500">*</span></label
              >
              <input
                v-model="form.email"
                type="email"
                placeholder="you@example.com"
                :class="[
                  'rounded-lg bg-slate-50 p-3 w-full transition-all outline-none',
                  formErrors.email
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/50'
                    : 'border border-slate-200 focus:ring-2 focus:ring-[#002888]/20 focus:border-[#002888]',
                ]"
              />
              <p v-if="formErrors.email" class="text-red-500 text-xs mt-1.5 font-bold">{{ formErrors.email }}</p>
            </div>
          </div>
        </section>

        <!-- Shipping Address -->
        <section class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="w-8 h-8 rounded-full bg-[#002888] text-white flex items-center justify-center text-sm font-bold"
              >2</span
            >
            <h2 class="text-xl font-bold text-slate-900">Shipping Address</h2>
          </div>
          <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5"
                  >First Name <span class="text-red-500">*</span></label
                >
                <input
                  v-model="form.firstName"
                  type="text"
                  placeholder="John"
                  :class="[
                    'rounded-lg bg-slate-50 p-3 w-full transition-all outline-none',
                    formErrors.firstName
                      ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/50'
                      : 'border border-slate-200 focus:ring-2 focus:ring-[#002888]/20 focus:border-[#002888]',
                  ]"
                />
                <p v-if="formErrors.firstName" class="text-red-500 text-xs mt-1.5 font-bold">
                  {{ formErrors.firstName }}
                </p>
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5"
                  >Last Name <span class="text-red-500">*</span></label
                >
                <input
                  v-model="form.lastName"
                  type="text"
                  placeholder="Doe"
                  :class="[
                    'rounded-lg bg-slate-50 p-3 w-full transition-all outline-none',
                    formErrors.lastName
                      ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/50'
                      : 'border border-slate-200 focus:ring-2 focus:ring-[#002888]/20 focus:border-[#002888]',
                  ]"
                />
                <p v-if="formErrors.lastName" class="text-red-500 text-xs mt-1.5 font-bold">
                  {{ formErrors.lastName }}
                </p>
              </div>
            </div>
            <div class="mb-4">
              <label class="block text-sm font-semibold text-slate-700 mb-1.5"
                >Street Address <span class="text-red-500">*</span></label
              >
              <input
                v-model="form.address"
                type="text"
                placeholder="123 Solar Street, Phase 1"
                :class="[
                  'rounded-lg bg-slate-50 p-3 w-full transition-all outline-none',
                  formErrors.address
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/50'
                    : 'border border-slate-200 focus:ring-2 focus:ring-[#002888]/20 focus:border-[#002888]',
                ]"
              />
              <p v-if="formErrors.address" class="text-red-500 text-xs mt-1.5 font-bold">{{ formErrors.address }}</p>
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1.5"
                >Phone Number <span class="text-red-500">*</span></label
              >
              <input
                v-model="form.phone"
                type="tel"
                placeholder="080..."
                :class="[
                  'rounded-lg bg-slate-50 p-3 w-full transition-all outline-none',
                  formErrors.phone
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/50'
                    : 'border border-slate-200 focus:ring-2 focus:ring-[#002888]/20 focus:border-[#002888]',
                ]"
              />
              <p v-if="formErrors.phone" class="text-red-500 text-xs mt-1.5 font-bold">{{ formErrors.phone }}</p>
            </div>
          </div>
        </section>

        <!-- Fulfillment Setup (Smart Router) -->
        <section class="space-y-6">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="w-8 h-8 rounded-full bg-[#002888] text-white flex items-center justify-center text-sm font-bold"
              >3</span
            >
            <h2 class="text-xl font-bold text-slate-900">Fulfillment Options</h2>
          </div>

          <!-- Fulfillment Toggle -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              class="p-6 rounded-2xl border-2 transition-all flex items-center gap-4 text-left"
              :class="
                selectedFulfillment === 'delivery'
                  ? 'border-[#002888] bg-blue-50/30'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              "
              @click="selectedFulfillment = 'delivery'"
            >
              <div class="w-12 h-12 rounded-xl bg-[#002888] text-white flex items-center justify-center">
                <span class="material-symbols-outlined">local_shipping</span>
              </div>
              <div>
                <p class="font-bold text-slate-900">Local Delivery</p>
                <p class="text-xs text-slate-500">Doorstep delivery within Nigeria</p>
              </div>
            </button>
            <button
              class="p-6 rounded-2xl border-2 transition-all flex items-center gap-4 text-left"
              :class="
                selectedFulfillment === 'pickup'
                  ? 'border-[#002888] bg-blue-50/30'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              "
              @click="selectedFulfillment = 'pickup'"
            >
              <div class="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center">
                <span class="material-symbols-outlined">storefront</span>
              </div>
              <div>
                <p class="font-bold text-slate-900">Store Pickup</p>
                <p class="text-xs text-slate-500">Free pickup from closest branch</p>
              </div>
            </button>
          </div>

          <!-- State Selector -->
          <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Select your shipping state:</label>
              <select
                v-model="selectedState"
                class="rounded-lg border-slate-200 bg-slate-50 focus:ring-2 focus:ring-[#002888]/20 focus:border-[#002888] p-3 w-full transition-all outline-none"
              >
                <option value="" disabled>Choose a state...</option>
                <option v-for="state in nigerianStates" :key="state.name" :value="state.name">
                  {{ state.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Branch Suggestions Section -->
          <div
            v-if="suggestedBranches.length > 0"
            class="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500"
          >
            <div class="flex items-center gap-2 px-1">
              <span class="material-symbols-outlined text-[#002888] text-lg">hub</span>
              <h4 class="font-bold text-slate-800 text-sm">
                {{
                  exactMatches.length > 0
                    ? 'Expert branches available in your state:'
                    : 'No branches in your state. Here are the closest options:'
                }}
              </h4>
            </div>

            <div class="grid gap-3">
              <label
                v-for="branch in suggestedBranches"
                :key="branch.name"
                class="flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all hover:shadow-md"
                :class="
                  selectedBranch?.name === branch.name
                    ? 'border-[#002888] bg-blue-50/30 ring-1 ring-[#002888]'
                    : 'border-gray-100 bg-white'
                "
              >
                <input
                  v-model="selectedBranch"
                  type="radio"
                  :value="branch"
                  class="w-5 h-5 text-[#002888] border-gray-300 focus:ring-[#002888]"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <p class="font-bold text-slate-900 truncate uppercase text-sm">{{ branch.name }}</p>
                    <span
                      v-if="exactMatches.some((e) => e.name === branch.name)"
                      class="bg-green-100 text-green-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase"
                      >In State</span
                    >
                  </div>
                  <p class="text-xs text-slate-500 line-clamp-1 italic">{{ branch.address }}</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-[10px] font-black text-[#002888] uppercase tracking-tighter">
                    {{ branch.city }}
                  </p>
                </div>
              </label>
            </div>
          </div>
        </section>

        <!-- Payment Options (pay-now checkout) -->
        <section v-if="newCheckout" class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="w-8 h-8 rounded-full bg-[#002888] text-white flex items-center justify-center text-sm font-bold"
              >4</span
            >
            <h2 class="text-xl font-bold text-slate-900">Payment</h2>
          </div>

          <div
            v-if="selectedFulfillment === 'delivery'"
            class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
          >
            <span class="material-symbols-outlined text-amber-600 text-xl">local_shipping</span>
            <div class="text-sm text-amber-900">
              <p class="font-bold">Delivery cost is not included</p>
              <p class="text-xs mt-0.5 text-amber-800">
                You are paying for the items now. Our agent will contact you to confirm the delivery cost for your
                address before dispatch.
              </p>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <label
              v-for="(option, index) in paymentOptions"
              :key="option.value"
              class="flex items-center gap-4 p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              :class="index < paymentOptions.length - 1 ? 'border-b border-gray-100' : ''"
            >
              <input
                v-model="paymentMethod"
                type="radio"
                :value="option.value"
                class="w-5 h-5 text-[#002888] border-gray-300 focus:ring-[#002888]"
              />
              <div class="flex-1">
                <p class="font-bold text-slate-900 uppercase text-sm tracking-wide">{{ option.label }}</p>
                <p class="text-xs text-slate-500">{{ option.hint }}</p>
              </div>
              <span class="material-symbols-outlined text-gray-400">{{ option.icon }}</span>
            </label>
          </div>

          <p v-if="selectedFulfillment === 'pickup'" class="text-xs text-slate-500 px-1">
            Paying at the store holds nothing in reserve. Items are sold on a first-come basis until collected.
          </p>
        </section>


        <!-- Payment Options -->
        <section v-if="!newCheckout" class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="w-8 h-8 rounded-full bg-[#002888] text-white flex items-center justify-center text-sm font-bold"
              >4</span
            >
            <h2 class="text-xl font-bold text-slate-900">Payment Options</h2>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <label
              class="flex items-center gap-4 p-6 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <input
                v-model="paymentMethod"
                type="radio"
                value="Cash on Delivery"
                class="w-5 h-5 text-[#002888] border-gray-300 focus:ring-[#002888]"
              />
              <div class="flex-1">
                <p class="font-bold text-slate-900 uppercase text-sm tracking-wide">Cash on Delivery</p>
                <p class="text-xs text-slate-500">Pay when your items arrive</p>
              </div>
              <span class="material-symbols-outlined text-gray-400">payments</span>
            </label>
            <label class="flex items-center gap-4 p-6 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                v-model="paymentMethod"
                type="radio"
                value="Financing / Installment"
                class="w-5 h-5 text-[#002888] border-gray-300 focus:ring-[#002888]"
              />
              <div class="flex-1">
                <p class="font-bold text-slate-900 uppercase text-sm tracking-wide">Financing / Installment</p>
                <p class="text-xs text-slate-500">Flexible payment plans available</p>
              </div>
              <span class="material-symbols-outlined text-gray-400">account_balance</span>
            </label>
          </div>
        </section>

        <!-- Order Note -->
        <section class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="w-8 h-8 rounded-full bg-[#002888] text-white flex items-center justify-center text-sm font-bold"
              >5</span
            >
            <h2 class="text-xl font-bold text-slate-900">Special Instructions</h2>
          </div>
          <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <textarea
              v-model="form.note"
              rows="3"
              placeholder="Any additional notes for delivery..."
              class="rounded-lg border-slate-200 bg-slate-50 focus:ring-2 focus:ring-[#002888]/20 focus:border-[#002888] p-3 w-full transition-all outline-none resize-none"
            />
          </div>
        </section>

        <!-- Submit Button -->
        <button
          :disabled="isSubmitting"
          class="w-full bg-[#002888] text-white font-bold py-5 rounded-2xl shadow-xl hover:bg-blue-900 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
          @click="submitOrder"
        >
          <span v-if="isSubmitting" class="animate-spin border-2 border-white/30 border-t-white w-5 h-5 rounded-full" />
          {{ isSubmitting ? 'Processing Order...' : 'Complete Order' }}
          <span v-if="!isSubmitting" class="material-symbols-outlined">arrow_forward</span>
          <span v-else class="material-symbols-outlined animate-spin">sync</span>
        </button>
      </div>

      <!-- Right Column: Sticky Order Summary -->
      <div class="w-full lg:w-[400px]">
        <div class="sticky top-24 space-y-6">
          <div class="bg-white p-8 rounded-2xl border border-gray-100 shadow-xl">
            <h2 class="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span class="material-symbols-outlined text-[#002888]">receipt_long</span>
              Order Summary
            </h2>

            <!-- Dynamic Cart Loop -->
            <div class="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              <div v-for="item in cart" :key="item.id" class="flex gap-4">
                <div class="relative w-16 h-16 shrink-0 mt-2 mr-2">
                  <div
                    class="w-full h-full bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 overflow-hidden"
                  >
                    <img
                      loading="lazy"
                      :src="item.PROPERTY_102 || item.image || item.PREVIEW_PICTURE || '/images/placeholder.png'"
                      :alt="item.name"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    class="absolute -top-1 -right-1 bg-[#002888] text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white z-10"
                  >
                    {{ item.quantity }}
                  </span>
                </div>
                <div class="flex-1 flex flex-col justify-center min-w-0">
                  <h3 class="text-sm font-bold text-slate-900 line-clamp-1 uppercase tracking-tight">
                    {{ item.name }}
                  </h3>
                  <p class="text-xs text-slate-500 font-medium">₦{{ Number(item.price).toLocaleString() }} each</p>
                </div>
                <div class="flex flex-col items-end justify-center">
                  <span class="text-sm font-black text-slate-900 italic"
                    >₦{{ Number(item.price * item.quantity).toLocaleString() }}</span
                  >
                </div>
              </div>
            </div>

            <!-- Totals Section -->
            <div class="space-y-4 pt-6 border-t border-dashed border-gray-200">
              <div class="flex justify-between text-sm text-slate-600 font-medium">
                <span>Subtotal</span>
                <span>₦{{ Number(cartTotalAmount).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm text-slate-600 font-medium">
                <span>{{ selectedFulfillment === 'pickup' ? 'Collection' : 'Delivery' }}</span>
                <span
                  v-if="selectedFulfillment === 'pickup'"
                  class="text-green-600 font-bold uppercase text-[10px] bg-green-50 px-2 py-0.5 rounded"
                  >Free</span
                >
                <span v-else class="text-amber-700 font-bold uppercase text-[10px] bg-amber-50 px-2 py-0.5 rounded"
                  >Agent will contact you</span
                >
              </div>
              <div class="flex justify-between items-end pt-4 border-t border-gray-100">
                <span class="text-sm font-bold text-slate-900">Total Due</span>
                <div class="flex flex-col items-end">
                  <span class="text-3xl font-black text-[#002888]"
                    >₦{{ Number(cartTotalAmount).toLocaleString() }}</span
                  >
                  <span class="text-[10px] text-slate-400 font-bold uppercase mt-1">
                    {{ selectedFulfillment === 'pickup' ? 'Inclusive of all taxes' : 'Items only — excludes delivery' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Trust Badges -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col items-center text-center">
              <span class="material-symbols-outlined text-[#002888] mb-2">verified_user</span>
              <p class="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">Secure Payment</p>
              <p class="text-[9px] text-slate-500 leading-tight">SSL encrypted checkout process</p>
            </div>
            <div class="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col items-center text-center">
              <span class="material-symbols-outlined text-[#002888] mb-2">support_agent</span>
              <p class="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">24/7 Support</p>
              <p class="text-[9px] text-slate-500 leading-tight">Expert help for solar systems</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
</style>

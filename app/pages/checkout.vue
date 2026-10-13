<script setup lang="ts">
import { z } from 'zod'
const site = useSite()
const { cart, cartTotalAmount } = useCart()
const { addToast } = useToast()
const { payWithPopup } = usePaystackPopup()

const selectedFulfillment = ref('delivery') // 'delivery' or 'pickup'
const selectedState = ref('')
const selectedBranch = ref<(typeof branches)[number] | (typeof homeEssentialsBranches)[number] | null>(null)
// Novel Home Essentials fulfils from its own two branches, whatever the state;
// the server refuses any other.
const fixedBranches = site.branchIds ? homeEssentialsBranches : null

const suggestedBranches = computed(() => {
  if (fixedBranches) return fixedBranches
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
    addToast('Empty Cart', 'Please add some items to your cart.', 'error')
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

  // Every order is fulfilled from a branch — deliveries ship from one too — and
  // the branch is what routes the deal and messages its manager. Without this
  // the page sent branch: null, the server rejected it with an unreadable
  // validation error, and the customer saw only "There was an issue".
  if (!selectedBranch.value) {
    addToast('Choose a branch', 'Please select your state and a branch for your order.', 'error')
    return
  }

  isSubmitting.value = true
  try {
    const response = await useNuxtApp().$apiFetch<{
      paymentUrl?: string | null
      paymentAccessCode?: string | null
      paymentReference?: string | null
      paymentPending?: boolean
    }>('/api/checkout', {
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
        // A rejected code is not sent. One that could not be checked (a network
        // blip) still is: the server looks it up again either way.
        promoCode: promoCodeState.value === 'invalid' ? undefined : (normalisePromoCode(promoCode.value) ?? undefined),
        // The staff link this customer came through, if any. It keeps that
        // person credited when the box holds a promo code instead.
        refCode: staffRef.read() ?? undefined,
      },
    })

    // Pay now: open Paystack over the page rather than navigating away.
    // resumeTransaction uses the access code the server got when it fixed the
    // amount, so nothing here can change what is charged.
    //
    // The cart is NOT cleared first. The page stays visible behind the
    // overlay, so emptying it here shows "Your cart is empty" through the
    // popup, and anyone who dismisses the popup is left with nothing to retry.
    if (response?.paymentAccessCode && response?.paymentReference && response?.paymentUrl) {
      const completed = await payWithPopup({
        accessCode: response.paymentAccessCode,
        reference: response.paymentReference,
        fallbackUrl: response.paymentUrl,
        onPaid: () => {
          cart.value = []
        },
      })

      // Dismissed. The order exists and is pending, and the cart is intact so
      // they can try again — saying nothing would look like the button broke.
      if (!completed) {
        addToast('Payment cancelled', 'Your order is saved. You can try paying again.', 'info')
        isSubmitting.value = false
      }
      return
    }

    // No access code — the popup cannot be used, so use the hosted page. We
    // are leaving the site, so the cart goes now.
    if (response?.paymentUrl) {
      cart.value = []
      window.location.href = response.paymentUrl
      return
    }

    cart.value = []

    // The order is placed and in the CRM, but the payment could not be opened.
    // Saying "order placed" alone would leave them expecting a payment screen
    // that never comes.
    if (response?.paymentPending) {
      addToast('Order Placed', 'We could not start the payment. Our team will contact you to complete it.', 'info')
      navigateTo('/thank-you?payment=pending')
      return
    }

    addToast('Order Placed', `Your order was successfully sent to ${site.name}!`, 'success')
    navigateTo('/thank-you')
  } catch (error) {
    // Out of stock is not a failure to apologise for — it is a customer we can
    // still serve. /api/checkout answers 409 INSUFFICIENT_STOCK with the short
    // items, and the popup below turns that into a call-back request.
    const shortage = readStockShortage(error)
    const unavailable = readUnavailable(error)
    const promoRejected = readPromoRejection(error)
    if (promoRejected) {
      // Nothing was ordered. Drop the discount from the totals so the next
      // press shows and charges the full price, and say why.
      promoCodeApplied.value = null
      promoCodeState.value = 'invalid'
      promoCodeMessage.value = promoRejected
      addToast('Promo code not applied', `${promoRejected} Your order was not placed; please check the total and try again.`, 'error')
    } else if (shortage) {
      stockShortage.value = shortage
      stockRequestPhone.value = form.phone
      stockRequestState.value = 'asking'
    } else if (unavailable) {
      // Removed from the catalog since it went in the cart. It can never be
      // bought, so leaving it there would refuse every retry the same way.
      const gone = new Set(unavailable.map((item) => String(item.id)))
      const names = cart.value.filter((item) => gone.has(String(item.id))).map((item) => item.name)
      cart.value = cart.value.filter((item) => !gone.has(String(item.id)))
      addToast(
        'Items no longer available',
        `We removed ${names.length ? names.join(', ') : 'some items'} from your cart. Please review your order and try again.`,
        'error',
      )
    } else {
      addToast('Order Error', 'There was an issue processing your order. Please try again.', 'error')
    }
  } finally {
    isSubmitting.value = false
  }
}

interface StockShortageItem {
  id: string
  name: string
  requested: number
  available: number
}

const stockShortage = ref<StockShortageItem[] | null>(null)
const stockRequestPhone = ref('')
const stockRequestState = ref<'asking' | 'sending' | 'sent'>('asking')
const stockRequestError = ref('')

function readStockShortage(error: unknown): StockShortageItem[] | null {
  const body = (error as { data?: { data?: { code?: string; items?: StockShortageItem[] } } })?.data?.data
  return body?.code === 'INSUFFICIENT_STOCK' && Array.isArray(body.items) && body.items.length ? body.items : null
}

function readUnavailable(error: unknown): { id: string }[] | null {
  const body = (error as { data?: { data?: { code?: string; items?: { id: string }[] } } })?.data?.data
  return body?.code === 'PRODUCT_UNAVAILABLE' && Array.isArray(body.items) && body.items.length ? body.items : null
}

function closeStockShortage() {
  // The cart is left exactly as it was: nothing was ordered.
  stockShortage.value = null
  stockRequestError.value = ''
}

async function submitStockRequest() {
  if (!stockShortage.value) return
  const phone = stockRequestPhone.value.trim()
  if (phone.length < 7) {
    stockRequestError.value = 'Please enter a phone number we can reach you on.'
    return
  }

  stockRequestError.value = ''
  stockRequestState.value = 'sending'
  try {
    await useNuxtApp().$apiFetch('/api/stock-request', {
      method: 'POST',
      body: {
        customer: {
          firstName: form.firstName || 'Customer',
          lastName: form.lastName,
          phone,
          email: form.email,
        },
        items: stockShortage.value.map((item) => ({ id: item.id, quantity: item.requested })),
        branch: selectedBranch.value
          ? { name: selectedBranch.value.name, bitrixId: selectedBranch.value.bitrixId }
          : undefined,
        client: 'web',
      },
    })
    stockRequestState.value = 'sent'
  } catch {
    stockRequestState.value = 'asking'
    stockRequestError.value = 'We could not send your request. Please try again, or call us.'
  }
}

// Promo code box. It takes a staff code (DAFO12) or a promo code (NOVEL10).
// The server decides the real discount at checkout; this only shows what to
// expect, with the server's own arithmetic (app/utils/promoDiscount.ts).
const staffRef = useStaffRef()
const promoCode = ref('')
const promoCodeState = ref<'idle' | 'checking' | 'applied' | 'invalid' | 'error'>('idle')
const promoCodeMessage = ref('')
interface AppliedPromoCode extends PromoTerms {
  code: string
  kind: 'staff' | 'promo'
  noDiscountReason: 'dealer' | 'disabled' | null
}
const promoCodeApplied = ref<AppliedPromoCode | null>(null)

const promoDiscount = computed(() =>
  previewPromoDiscount(
    cart.value.map((item) => ({ price: Number(item.price), quantity: Number(item.quantity) })),
    promoCodeApplied.value,
  ),
)
const promoDiscountAmount = computed(() => promoDiscount.value.amount)
const totalDue = computed(() => Number(cartTotalAmount.value) - promoDiscountAmount.value)

/** "1%", "10%" or "₦5,000 off". */
const promoLabel = computed(() => {
  const applied = promoCodeApplied.value
  if (!applied) return ''
  return applied.discountType === 'fixed'
    ? `₦${Math.round(applied.discountValue).toLocaleString()} off`
    : `${applied.discountValue}% off`
})

async function applyPromoCode() {
  const code = normalisePromoCode(promoCode.value)
  promoCodeApplied.value = null
  promoCodeMessage.value = ''
  if (!code) {
    promoCodeState.value = promoCode.value.trim() ? 'invalid' : 'idle'
    if (promoCode.value.trim()) promoCodeMessage.value = "We don't recognise that promo code."
    return
  }

  promoCodeState.value = 'checking'
  try {
    const res = await useNuxtApp().$apiFetch<{
      valid: boolean
      code: string | null
      kind: 'staff' | 'promo' | null
      message: string | null
      discountType: 'percent' | 'fixed' | null
      discountValue: number
      noDiscountReason: 'dealer' | 'disabled' | null
      minOrderAmount: number
      maxDiscountAmount: number
    }>('/api/promo-code', { query: { code } })
    if (!res.valid) {
      promoCodeState.value = 'invalid'
      promoCodeMessage.value = res.message || "We don't recognise that promo code."
      return
    }
    promoCode.value = code
    promoCodeApplied.value = {
      code,
      kind: res.kind === 'promo' ? 'promo' : 'staff',
      noDiscountReason: res.noDiscountReason,
      discountType: res.discountType ?? 'percent',
      discountValue: Number(res.discountValue) || 0,
      minOrderAmount: Number(res.minOrderAmount) || 0,
      maxDiscountAmount: Number(res.maxDiscountAmount) || 0,
    }
    promoCodeState.value = 'applied'
    // A staff code typed here replaces one remembered from a link. A promo
    // code does not: the link's staff member is still credited.
    if (res.kind === 'staff') staffRef.save(code)
  } catch {
    promoCodeState.value = 'error'
  }
}

function onPromoCodeInput() {
  // Editing an applied code un-applies it until it is checked again, so the
  // totals never show a discount for a code that has been typed over.
  promoCodeApplied.value = null
  promoCodeState.value = 'idle'
  promoCodeMessage.value = ''
}

/** Checkout refused the code (expired, used up, already used…) between the check and the order. */
function readPromoRejection(error: unknown): string | null {
  const err = error as { data?: { statusMessage?: string; data?: { code?: string } } }
  return err?.data?.data?.code === 'PROMO_CODE_REJECTED'
    ? err.data.statusMessage || 'This promo code can no longer be used.'
    : null
}

onMounted(async () => {
  const remembered = staffRef.read()
  if (remembered) {
    promoCode.value = remembered
    applyPromoCode()
  }

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
      <p class="text-gray-500 mb-8">Add some items to your cart before checking out.</p>
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
                placeholder="12 Example Street, Phase 1"
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
          <div v-if="!fixedBranches" class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
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
                  fixedBranches
                    ? 'Choose the branch for your order:'
                    : exactMatches.length > 0
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
                      v-if="!fixedBranches && exactMatches.some((e) => e.name === branch.name)"
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

            <!-- Promo code -->
            <div class="pt-6 mb-6 border-t border-dashed border-gray-200">
              <label for="promo-code" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"
                >Promo code (optional)</label
              >
              <div class="flex gap-2">
                <input
                  id="promo-code"
                  v-model="promoCode"
                  type="text"
                  autocomplete="off"
                  autocapitalize="characters"
                  spellcheck="false"
                  placeholder="Enter code"
                  maxlength="20"
                  class="min-w-0 flex-1 rounded-lg border-slate-200 bg-slate-50 focus:ring-2 focus:ring-[#002888]/20 focus:border-[#002888] px-3 py-2 text-sm uppercase transition-all outline-none"
                  @input="onPromoCodeInput"
                  @keydown.enter.prevent="applyPromoCode"
                >
                <button
                  type="button"
                  :disabled="promoCodeState === 'checking' || !promoCode.trim()"
                  class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-40"
                  @click="applyPromoCode"
                >
                  {{ promoCodeState === 'checking' ? 'Checking…' : 'Apply' }}
                </button>
              </div>
              <p v-if="promoCodeState === 'applied' && promoCodeApplied" class="mt-2 text-xs font-bold text-green-700">
                <template v-if="promoDiscountAmount > 0">
                  Code {{ promoCodeApplied.code }} applied: {{ promoLabel }}{{
                    promoDiscount.capped ? `, up to ₦${promoCodeApplied.maxDiscountAmount.toLocaleString()}` : ''
                  }}.
                </template>
                <template v-else-if="promoDiscount.belowMinimum">
                  Code {{ promoCodeApplied.code }} applied. Orders of ₦{{
                    promoCodeApplied.minOrderAmount.toLocaleString()
                  }}
                  or more get {{ promoLabel }}.
                </template>
                <template v-else-if="promoCodeApplied.noDiscountReason === 'dealer'">
                  Code {{ promoCodeApplied.code }} applied. Your dealer prices already include your discount.
                </template>
                <template v-else>Code {{ promoCodeApplied.code }} applied.</template>
              </p>
              <p v-else-if="promoCodeState === 'invalid'" class="mt-2 text-xs font-bold text-amber-700">
                {{ promoCodeMessage || "We don't recognise that promo code." }} You can still place your order without
                it.
              </p>
              <p v-else-if="promoCodeState === 'error'" class="mt-2 text-xs font-bold text-slate-500">
                We couldn't check that code just now. It will be checked again when you place your order.
              </p>
            </div>

            <!-- Totals Section -->
            <div class="space-y-4 pt-6 border-t border-dashed border-gray-200">
              <div class="flex justify-between text-sm text-slate-600 font-medium">
                <span>Subtotal</span>
                <span>₦{{ Number(cartTotalAmount).toLocaleString() }}</span>
              </div>
              <div v-if="promoDiscountAmount > 0" class="flex justify-between text-sm text-green-700 font-medium">
                <span>Promo code {{ promoCodeApplied?.code }} ({{ promoLabel }})</span>
                <span>-₦{{ promoDiscountAmount.toLocaleString() }}</span>
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
                  <span class="text-3xl font-black text-[#002888]">₦{{ totalDue.toLocaleString() }}</span>
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
              <p class="text-[9px] text-slate-500 leading-tight">Expert help from our team</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Out of stock: offer a call back instead of a dead end. -->
    <div
      v-if="stockShortage"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-shortage-title"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <template v-if="stockRequestState !== 'sent'">
          <div class="flex items-start gap-3 mb-4">
            <span class="material-symbols-outlined text-amber-600 text-2xl">inventory_2</span>
            <div>
              <h2 id="stock-shortage-title" class="text-lg font-bold text-slate-900">
                We don't have enough of this in stock yet
              </h2>
              <p class="text-sm text-slate-500 mt-1">
                Leave your number and our team will call you to arrange the supply.
              </p>
            </div>
          </div>

          <ul class="mb-5 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <li v-for="item in stockShortage" :key="item.id" class="text-sm">
              <p class="font-bold text-slate-900">{{ item.name }}</p>
              <p class="text-xs text-slate-500">
                You asked for {{ item.requested }} —
                {{ item.available > 0 ? `we have ${item.available} right now` : 'currently out of stock' }}
              </p>
            </li>
          </ul>

          <label class="block text-sm font-semibold text-slate-700 mb-2" for="stock-request-phone">
            Your phone number
          </label>
          <input
            id="stock-request-phone"
            v-model="stockRequestPhone"
            type="tel"
            autocomplete="tel"
            class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#002888] focus:ring-[#002888]"
            placeholder="080..."
          />
          <p v-if="stockRequestError" class="mt-2 text-xs text-red-600">{{ stockRequestError }}</p>

          <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-gray-50"
              @click="closeStockShortage"
            >
              Change my order
            </button>
            <button
              type="button"
              class="rounded-xl bg-[#002888] px-5 py-3 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
              :disabled="stockRequestState === 'sending'"
              @click="submitStockRequest"
            >
              {{ stockRequestState === 'sending' ? 'Sending…' : 'Call me about supply' }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="text-center">
            <span class="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
            <h2 class="text-lg font-bold text-slate-900 mt-2">Thank you — we'll be in touch</h2>
            <p class="text-sm text-slate-500 mt-1">
              Our team will call you on {{ stockRequestPhone }} about when your items will be available. Your cart
              has been kept.
            </p>
            <button
              type="button"
              class="mt-6 rounded-xl bg-[#002888] px-5 py-3 text-sm font-bold text-white hover:bg-blue-900"
              @click="closeStockShortage"
            >
              Close
            </button>
          </div>
        </template>
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

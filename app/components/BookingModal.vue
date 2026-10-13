<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    isOpen: boolean
    serviceName?: string
  }>(),
  {
    serviceName: 'General Service',
  },
)

const emit = defineEmits<{
  close: []
}>()

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  preferredDate: '',
  serviceType: props.serviceName,
  details: '',
})

// Watch for changes to the prop to keep the form updated if they click different services
watch(
  () => props.serviceName,
  (newVal) => {
    form.value.serviceType = newVal
  },
)

const isSubmitting = ref(false)
const isSuccess = ref(false)
const errorMessage = ref('')

const submitBooking = async () => {
  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await useNuxtApp().$apiFetch('/api/book-service', {
      method: 'POST',
      body: form.value,
    })
    isSuccess.value = true
  } catch (error) {
    errorMessage.value = error.data?.statusMessage || 'An error occurred. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

const closeModal = () => {
  if (!isSubmitting.value) {
    // Reset state on close
    setTimeout(() => {
      isSuccess.value = false
      errorMessage.value = ''
    }, 300)
    emit('close')
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-heading"
      class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200"
    >
      <button
        aria-label="Close Booking Modal"
        class="absolute top-6 right-6 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all z-10 focus-visible:ring-2 focus-visible:ring-[#002888]"
        @click="closeModal"
      >
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div v-if="isSuccess" class="p-12 text-center">
        <div class="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <h2 class="text-3xl font-black text-slate-900 mb-4">Booking Received!</h2>
        <p class="text-slate-600 font-medium mb-8">
          Thank you, {{ form.firstName }}. Your request for <strong>{{ form.serviceType }}</strong> has been sent. Our
          dispatch team will call you shortly to confirm your appointment time.
        </p>
        <button
          class="bg-[#002888] text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-900 transition-all shadow-lg w-full sm:w-auto outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          @click="closeModal"
        >
          Done
        </button>
      </div>

      <div v-else class="p-8 md:p-12">
        <div class="mb-8">
          <h2 id="booking-heading" class="text-3xl font-black text-[#002888] mb-2">Book a Service</h2>
          <p class="text-slate-600 font-medium">
            Fill out the details below to schedule your <strong>{{ form.serviceType }}</strong
            >.
          </p>
        </div>

        <div v-if="errorMessage" class="mb-6 p-4 bg-red-50 text-red-700 rounded-xl font-bold text-sm">
          {{ errorMessage }}
        </div>

        <form class="space-y-5" @submit.prevent="submitBooking">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label
                for="booking-firstname"
                class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
                >First Name</label
              >
              <input
                id="booking-firstname"
                v-model="form.firstName"
                type="text"
                required
                :disabled="isSubmitting"
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all"
              />
            </div>
            <div>
              <label
                for="booking-lastname"
                class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
                >Last Name</label
              >
              <input
                id="booking-lastname"
                v-model="form.lastName"
                type="text"
                required
                :disabled="isSubmitting"
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label for="booking-phone" class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
                >Phone</label
              >
              <input
                id="booking-phone"
                v-model="form.phone"
                type="tel"
                required
                :disabled="isSubmitting"
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all"
              />
            </div>
            <div>
              <label for="booking-email" class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
                >Email</label
              >
              <input
                id="booking-email"
                v-model="form.email"
                type="email"
                required
                :disabled="isSubmitting"
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label for="booking-address" class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
              >Service Address</label
            >
            <input
              id="booking-address"
              v-model="form.address"
              type="text"
              placeholder="123 Main St, City..."
              required
              :disabled="isSubmitting"
              class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all"
            />
          </div>

          <div>
            <label for="booking-date" class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
              >Preferred Date</label
            >
            <input
              id="booking-date"
              v-model="form.preferredDate"
              type="date"
              required
              :disabled="isSubmitting"
              class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all text-slate-700"
            />
          </div>

          <div>
            <label for="booking-details" class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
              >Issue Details / Notes</label
            >
            <textarea
              id="booking-details"
              v-model="form.details"
              rows="3"
              placeholder="Briefly describe what you need help with..."
              :disabled="isSubmitting"
              class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full bg-[#002888] text-white py-4 rounded-xl font-black text-lg uppercase tracking-widest hover:bg-blue-900 transition-all shadow-xl active:scale-95 disabled:opacity-70 flex items-center justify-center gap-3 mt-4 outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          >
            <svg
              v-if="isSubmitting"
              class="animate-spin border-2 border-white/30 border-t-white w-5 h-5 rounded-full"
              viewBox="0 0 24 24"
            />
            {{ isSubmitting ? 'Booking...' : 'Confirm Booking' }}
          </button>
          <PrivacyNotice class="mt-3 text-center" />
        </form>
      </div>
    </div>
  </div>
</template>

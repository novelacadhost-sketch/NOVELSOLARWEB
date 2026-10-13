<template>
  <div class="min-h-screen bg-slate-50 py-16 px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-4xl md:text-5xl font-black text-[#002888] tracking-tight mb-4">Request a Quote</h1>
        <p class="text-lg text-slate-500 font-medium max-w-xl mx-auto">
          Tell us about your energy needs, and our technical team will prepare a customized solution and pricing
          estimate.
        </p>
      </div>

      <!-- Success State -->
      <div
        v-if="isSuccess"
        class="bg-white rounded-3xl shadow-xl p-12 text-center border border-slate-100 animate-in fade-in zoom-in duration-500"
      >
        <div class="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <h2 class="text-3xl font-black text-slate-900 mb-4">Request Received!</h2>
        <p class="text-slate-600 font-medium mb-8 max-w-md mx-auto leading-relaxed">
          Thank you, {{ form.firstName }}. Your quote request has been sent to our engineering team. We will review your
          details and contact you within 24 hours.
        </p>
        <NuxtLink
          to="/"
          class="inline-block bg-[#002888] text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-900 transition-all shadow-lg"
        >
          Return to Homepage
        </NuxtLink>
      </div>

      <!-- Form State -->
      <div v-else class="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#00AEEF] to-[#002888]" />

        <!-- Error Message -->
        <div
          v-if="errorMessage"
          class="mb-8 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 font-bold text-sm flex items-center gap-2"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          {{ errorMessage }}
        </div>

        <!-- Form -->
        <form class="space-y-6" @submit.prevent="submitQuote">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">First Name</label>
              <input
                v-model="form.firstName"
                type="text"
                required
                :disabled="isSubmitting"
                class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Last Name</label>
              <input
                v-model="form.lastName"
                type="text"
                required
                :disabled="isSubmitting"
                class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
                >Email Address</label
              >
              <input
                v-model="form.email"
                type="email"
                required
                :disabled="isSubmitting"
                class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
              <input
                v-model="form.phone"
                type="tel"
                required
                :disabled="isSubmitting"
                class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
              >I am interested in...</label
            >
            <select
              v-model="form.projectType"
              required
              :disabled="isSubmitting"
              class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all bg-white appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled>Select a service</option>
              <option value="Complete Solar Installation">Complete Home Solar Installation</option>
              <option value="Inverter & Battery Upgrade">Inverter & Battery Upgrade</option>
              <option value="Commercial Solar Project">Commercial / Enterprise Project</option>
              <option value="Product Purchase Only">Purchasing Equipment Only</option>
              <option value="Other">Other Request</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
              >Project Details</label
            >
            <textarea
              v-model="form.details"
              rows="4"
              placeholder="Please describe your current power setup or what you are looking to achieve..."
              :disabled="isSubmitting"
              class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full bg-[#002888] text-white py-5 rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-blue-900 transition-all shadow-xl active:scale-95 disabled:opacity-70 disabled:active:scale-100 disabled:hover:bg-[#002888] flex items-center justify-center gap-3"
          >
            <svg
              v-if="isSubmitting"
              class="animate-spin border-2 border-white/30 border-t-white w-5 h-5 rounded-full"
              viewBox="0 0 24 24"
            />
            {{ isSubmitting ? 'Sending Request...' : 'Submit Quote Request' }}
          </button>
          <PrivacyNotice class="mt-3 text-center" />
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  projectType: '',
  details: '',
})

const isSubmitting = ref(false)
const isSuccess = ref(false)
const errorMessage = ref('')

const submitQuote = async () => {
  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await useNuxtApp().$apiFetch('/api/quote', {
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

useHead({
  title: 'Request a Quote | Novel Solar',
  meta: [{ name: 'description', content: 'Get a custom quote for your solar and energy storage needs.' }],
})
</script>

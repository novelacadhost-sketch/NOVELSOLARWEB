<template>
  <div class="min-h-screen bg-slate-50 py-16 px-6 lg:px-8">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-12">
        <h1 class="text-4xl md:text-5xl font-black text-[#002888] tracking-tight mb-4">Contact Novel Solar</h1>
        <p class="text-lg text-slate-500 font-medium max-w-2xl mx-auto">
          Tell us what you need, and our team will point you to the right products, support channel, or next step.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-start">
        <div class="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#D4AF37] via-[#00AEEF] to-[#002888]" />

          <div v-if="isSuccess" class="text-center py-8 md:py-12">
            <div
              class="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <h2 class="text-3xl font-black text-slate-900 mb-4">Message Sent</h2>
            <p class="text-slate-600 font-medium mb-8 max-w-md mx-auto leading-relaxed">
              Thank you, {{ form.name }}. Your message has been delivered to our team, and we will get back to you as
              soon as possible.
            </p>
            <button
              type="button"
              class="inline-flex items-center justify-center bg-[#002888] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-900 transition-all shadow-lg"
              @click="resetForm"
            >
              Send Another Message
            </button>
          </div>

          <template v-else>
            <div class="mb-8">
              <div
                class="inline-flex items-center gap-2 rounded-full bg-[#002888]/5 text-[#002888] px-4 py-2 text-xs font-black uppercase tracking-[0.25em] mb-4"
              >
                General Inquiry
              </div>
              <h2 class="text-3xl font-black text-slate-900 mb-3">Send us a message</h2>
              <p class="text-slate-500 font-medium leading-relaxed max-w-2xl">
                Ask about products, installations, technical support, or partnership opportunities. We will make sure
                your message reaches the right team.
              </p>
            </div>

            <div
              v-if="errorMessage"
              class="mb-8 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 font-bold text-sm flex items-start gap-3"
            >
              <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M18 10A8 8 0 112 10a8 8 0 0116 0zM9 6a1 1 0 012 0v4a1 1 0 11-2 0V6zm1 8a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 14z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>{{ errorMessage }}</span>
            </div>

            <form class="space-y-6" @submit.prevent="sendMessage">
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                <input
                  v-model="form.name"
                  type="text"
                  required
                  :disabled="isSubmitting"
                  placeholder="Your full name"
                  class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
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
                    placeholder="you@example.com"
                    class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
                    >Phone Number</label
                  >
                  <input
                    v-model="form.phone"
                    type="tel"
                    :disabled="isSubmitting"
                    placeholder="+234..."
                    class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Subject</label>
                <input
                  v-model="form.subject"
                  type="text"
                  required
                  :disabled="isSubmitting"
                  placeholder="How can we help?"
                  class="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-[#002888] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Message</label>
                <textarea
                  v-model="form.message"
                  rows="6"
                  required
                  :disabled="isSubmitting"
                  placeholder="Share the details of your request, question, or project."
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
                {{ isSubmitting ? 'Sending Message...' : 'Send Message' }}
              </button>
              <PrivacyNotice class="mt-3" />
            </form>
          </template>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
            <h2 class="text-2xl font-black text-slate-900 mb-6">Contact Details</h2>
            <div class="space-y-6">
              <div class="flex items-start gap-4">
                <div class="w-12 h-12 bg-[#002888]/5 rounded-2xl flex items-center justify-center text-[#002888]">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 class="font-black text-slate-900 mb-1">Phone</h3>
                  <p class="text-slate-500 font-medium">{{ whatsappNumberFormatted }}</p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div class="w-12 h-12 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center text-[#B8911F]">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 class="font-black text-slate-900 mb-1">Email</h3>
                  <p class="text-slate-500 font-medium">
                    <a href="mailto:sales@novelsolar.com" class="hover:text-[#002888]">sales@novelsolar.com</a><br />
                    <a href="mailto:info@novelsolar.com" class="hover:text-[#002888]">info@novelsolar.com</a>
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div class="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-[#00AEEF]">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 class="font-black text-slate-900 mb-1">Head office</h3>
                  <p class="text-slate-500 font-medium">
                    Akinjide Plaza, 76 Adekunle Fajuyi Road, Ekotedo, Ibadan, Oyo State
                  </p>
                  <p class="text-slate-400 text-sm mt-1">Mon–Fri 8:00am–5:30pm · Sat 10:00am–5:30pm</p>
                  <NuxtLink to="/branch-outlets" class="text-sm font-bold text-[#002888] hover:underline"
                    >See all our branches</NuxtLink
                  >
                </div>
              </div>
            </div>
          </div>

          <div class="bg-[#002888] text-white rounded-3xl shadow-xl p-8 overflow-hidden relative">
            <div class="absolute -right-16 -top-16 w-40 h-40 rounded-full bg-white/10" />
            <div class="absolute -left-12 -bottom-16 w-32 h-32 rounded-full bg-[#D4AF37]/20" />
            <div class="relative">
              <p class="text-xs font-black uppercase tracking-[0.3em] text-white/70 mb-3">Fast Response</p>
              <h3 class="text-2xl font-black mb-3">Need product guidance?</h3>
              <p class="text-white/80 font-medium leading-relaxed">
                Share your question through the form and we will direct it to sales, support, or installations based on
                your subject line.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  public: { whatsappNumberFormatted },
} = useRuntimeConfig()

const initialFormState = () => ({
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
})

const form = ref(initialFormState())
const isSubmitting = ref(false)
const isSuccess = ref(false)
const errorMessage = ref('')

const resetForm = () => {
  form.value = initialFormState()
  isSuccess.value = false
  errorMessage.value = ''
}

const sendMessage = async () => {
  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await useNuxtApp().$apiFetch('/api/contact', {
      method: 'POST',
      body: form.value,
    })

    isSuccess.value = true
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Error sending message. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

useHead({
  title: 'Contact',
  meta: [
    {
      name: 'description',
      content: 'Contact Novel Solar for product questions, support, and general solar energy inquiries.',
    },
  ],
})
</script>

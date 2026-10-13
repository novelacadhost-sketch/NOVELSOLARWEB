<template>
  <div class="min-h-screen bg-slate-50">
    <section class="bg-[#002888] py-16 md:py-24 relative overflow-hidden">
      <div class="absolute inset-0 opacity-10 pointer-events-none">
        <div class="absolute top-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div
          class="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"
        />
      </div>

      <div class="max-w-7xl mx-auto px-4 relative z-10">
        <nav class="text-xs font-black uppercase tracking-widest text-blue-100/80 flex items-center gap-2 mb-8">
          <NuxtLink to="/" class="hover:text-white transition-colors">Home</NuxtLink>
          <span>/</span>
          <NuxtLink to="/partners" class="hover:text-white transition-colors">Partners</NuxtLink>
          <span>/</span>
          <span class="text-white">Become a Partner</span>
        </nav>

        <div class="max-w-3xl">
          <h1 class="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight mb-6">
            Build the Next Energy Network With Us
          </h1>
          <p class="text-lg md:text-xl text-blue-100 font-medium leading-relaxed max-w-2xl">
            Apply to join the Novel Solar partner ecosystem and unlock regional distribution, project collaboration, and
            go-to-market support.
          </p>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 py-16 md:py-24">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <article
          v-for="track in partnershipTracks"
          :key="track.title"
          class="bg-white border border-slate-100 rounded-3xl p-7 shadow-sm"
        >
          <h2 class="text-xl font-black text-slate-900 mb-3">{{ track.title }}</h2>
          <p class="text-slate-500 font-medium leading-relaxed">{{ track.description }}</p>
        </article>
      </div>

      <div class="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-200/40 overflow-hidden">
        <div class="p-8 md:p-10 border-b border-slate-100">
          <h2 class="text-3xl font-black text-slate-900 tracking-tight mb-2">Partner Application</h2>
          <p class="text-slate-500 font-medium">Share your company profile and our partnerships team will reach out.</p>
        </div>

        <div class="p-8 md:p-10">
          <div v-if="isSuccess" class="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-8">
            <h3 class="text-emerald-700 font-black text-lg mb-1">Application received</h3>
            <p class="text-emerald-700/90 font-medium">
              Thanks for applying. We have sent your request to our partnerships desk.
            </p>
          </div>

          <div
            v-if="errorMessage"
            class="bg-red-50 border border-red-100 rounded-2xl p-4 mb-8 text-red-700 font-semibold"
          >
            {{ errorMessage }}
          </div>

          <form class="grid grid-cols-1 md:grid-cols-2 gap-6" @submit.prevent="submitApplication">
            <div class="space-y-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Company Name</label>
              <input
                v-model="form.companyName"
                type="text"
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-[#002888] focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            <div class="space-y-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Contact Person</label>
              <input
                v-model="form.contactName"
                type="text"
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-[#002888] focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            <div class="space-y-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Business Email</label>
              <input
                v-model="form.email"
                type="email"
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-[#002888] focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            <div class="space-y-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Phone Number</label>
              <input
                v-model="form.phone"
                type="tel"
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-[#002888] focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            <div class="space-y-2 md:col-span-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Partnership Type</label>
              <select
                v-model="form.partnershipType"
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-[#002888] focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white"
              >
                <option value="Distribution">Distribution Partner</option>
                <option value="EPC">EPC / Installer Partner</option>
                <option value="Technology">Technology / Manufacturer Partner</option>
                <option value="Finance">Finance / Investment Partner</option>
              </select>
            </div>

            <div class="space-y-2 md:col-span-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest"
                >Company Website (Optional)</label
              >
              <input
                v-model="form.website"
                type="url"
                placeholder="https://"
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-[#002888] focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            <div class="space-y-2 md:col-span-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Message</label>
              <textarea
                v-model="form.message"
                rows="5"
                required
                placeholder="Tell us about your market coverage, product focus, and what you are looking to build with Novel Solar."
                class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-[#002888] focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none"
              />
            </div>

            <div class="md:col-span-2 flex flex-col sm:flex-row gap-4 pt-2">
              <button
                type="submit"
                :disabled="isSubmitting"
                class="inline-flex items-center justify-center gap-2 bg-[#002888] text-white px-8 py-4 rounded-xl font-black uppercase tracking-wider hover:bg-blue-900 transition-all disabled:opacity-60"
              >
                <span
                  v-if="isSubmitting"
                  class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                />
                {{ isSubmitting ? 'Submitting...' : 'Submit Application' }}
              </button>
              <NuxtLink
                to="/contact"
                class="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black uppercase tracking-wider border-2 border-slate-200 text-slate-700 hover:border-[#002888] hover:text-[#002888] transition-all"
              >
                Need Help?
              </NuxtLink>
            </div>
            <PrivacyNotice class="md:col-span-2" />
          </form>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const partnershipTracks = [
  {
    title: 'Distribution Expansion',
    description: 'Scale quality solar products into new cities with logistics, sales enablement, and pricing support.',
  },
  {
    title: 'Project Collaboration',
    description: 'Work with our engineering and procurement teams on commercial and residential deployments.',
  },
  {
    title: 'Technology Partnerships',
    description: 'Launch new products through a market-ready channel with visibility across installers and developers.',
  },
]

const form = ref({
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  partnershipType: 'Distribution',
  message: '',
})

const isSubmitting = ref(false)
const isSuccess = ref(false)
const errorMessage = ref('')

const resetForm = () => {
  form.value = {
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    partnershipType: 'Distribution',
    message: '',
  }
}

const submitApplication = async () => {
  if (isSubmitting.value) return

  isSubmitting.value = true
  isSuccess.value = false
  errorMessage.value = ''

  try {
    await useNuxtApp().$apiFetch('/api/contact', {
      method: 'POST',
      body: {
        name: `${form.value.contactName} (${form.value.companyName})`,
        email: form.value.email.trim().toLowerCase(),
        phone: form.value.phone,
        subject: `Partner Request: ${form.value.partnershipType} | ${form.value.companyName}`,
        message: [
          `Partnership Type: ${form.value.partnershipType}`,
          `Company Name: ${form.value.companyName}`,
          `Contact Person: ${form.value.contactName}`,
          `Phone: ${form.value.phone}`,
          `Website: ${form.value.website || 'N/A'}`,
          '',
          'Message:',
          form.value.message,
        ].join('\n'),
      },
    })

    isSuccess.value = true
    resetForm()
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || 'Failed to submit application. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

useHead({
  title: 'Become a Partner | Novel Solar',
  meta: [
    {
      name: 'description',
      content: 'Apply to become a Novel Solar partner for distribution, EPC projects, and technology collaborations.',
    },
  ],
})
</script>

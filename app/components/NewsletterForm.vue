<template>
  <div>
    <p v-if="done" class="text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
      {{ done }}
    </p>
    <form v-else class="space-y-2" @submit.prevent="subscribe">
      <div class="flex">
        <label for="newsletter-email" class="sr-only">Email address</label>
        <input
          id="newsletter-email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="appearance-none min-w-0 w-full bg-white border border-gray-300 rounded-l-md py-2 px-4 text-base text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
          placeholder="Enter your email"
        />
        <button
          type="submit"
          :disabled="sending"
          class="bg-[#002888] text-white px-5 py-2.5 rounded-r-md text-sm font-bold hover:bg-blue-900 transition-colors shadow-sm disabled:opacity-60"
        >
          {{ sending ? '…' : 'Subscribe' }}
        </button>
      </div>
      <label class="flex items-start gap-2 text-xs text-gray-500">
        <input v-model="consent" type="checkbox" required class="mt-0.5" />
        <span
          >I agree to receive news and offers by email. I can unsubscribe at any time. See our
          <NuxtLink to="/privacy" class="font-bold underline text-[#002888]">privacy policy</NuxtLink>.</span
        >
      </label>
      <p v-if="failure" class="text-xs text-red-600">{{ failure }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
const email = ref('')
const consent = ref(false)
const sending = ref(false)
const done = ref('')
const failure = ref('')

async function subscribe() {
  failure.value = ''
  sending.value = true
  try {
    const result = await useNuxtApp().$apiFetch<{ alreadySubscribed: boolean }>('/api/newsletter', {
      method: 'POST',
      body: { email: email.value, consent: consent.value },
    })
    done.value = result.alreadySubscribed ? 'You are already subscribed. Thank you!' : 'Thank you for subscribing!'
  } catch (err) {
    failure.value =
      (err as { data?: { statusMessage?: string } }).data?.statusMessage || 'Could not subscribe you. Please try again.'
  } finally {
    sending.value = false
  }
}
</script>

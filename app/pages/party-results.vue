<template>
  <div v-if="state === 'denied'" class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div class="max-w-md bg-white rounded-3xl border border-slate-200 p-8 text-center">
      <h1 class="text-xl font-black text-slate-900 mb-2">This link is not valid</h1>
      <p class="text-sm text-slate-500">Open the full results link exactly as you were sent it.</p>
    </div>
  </div>
  <PartyRsvpReport v-else :rsvps="rsvps" :pending="state === 'loading'" :error="loadError" @refresh="load" />
</template>

<script setup lang="ts">
import type { PartyReportRow } from '#shared/party'

/**
 * HR's view of the party RSVPs. No login: the link carries a secret after the
 * #, which the browser never sends to a server or puts in a referrer; the page
 * passes it to /api/party/results in a header.
 */
definePageMeta({ layout: false })
useHead({ title: 'Party RSVP results', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const rsvps = ref<PartyReportRow[]>([])
const state = ref<'loading' | 'ready' | 'denied'>('loading')
const loadError = ref<string | null>(null)

async function load() {
  const key = decodeURIComponent(window.location.hash.replace(/^#/, ''))
  if (!key) {
    rsvps.value = []
    state.value = 'denied'
    return
  }
  loadError.value = null
  try {
    const res = await $fetch<{ rsvps: PartyReportRow[] }>('/api/party/results', {
      headers: { 'x-results-key': key },
    })
    rsvps.value = res.rsvps
    state.value = 'ready'
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 404) {
      rsvps.value = []
      state.value = 'denied'
    } else {
      state.value = 'ready'
      loadError.value =
        status === 429 ? 'Too many refreshes. Wait a minute and try again.' : 'Could not load the results. Try again.'
    }
  }
}

onMounted(() => {
  load()
  window.addEventListener('hashchange', load)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', load))
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-10 sm:py-16 px-4">
    <div class="max-w-xl mx-auto">
      <header class="text-center mb-8">
        <img src="/images/logo.png" alt="Novel Solar" width="325" height="92" class="h-14 w-auto mx-auto mb-8" >
        <h1 class="text-3xl sm:text-4xl font-black text-[#0B1F6B] mb-3 text-balance">Welcome, partners</h1>
        <p class="text-slate-600 text-balance">
          Thank you for a great year working together. We would love you to join us at our
          {{ PARTY.name }} on {{ PARTY.partyDate }}, {{ hourLabel(PARTY.startHour) }} to
          {{ hourLabel(PARTY.endHour) }}. Please let us know you are coming.
        </p>
        <p
          class="mt-5 text-sm font-semibold rounded-2xl px-4 py-3 border"
          :class="closed ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-amber-50 border-amber-200 text-amber-900'"
        >
          <template v-if="closed">Registration closed at {{ PARTNER_CLOSES_LABEL }}.</template>
          <template v-else>Please register by {{ PARTNER_CLOSES_LABEL }}.</template>
        </p>
      </header>

      <form
        v-if="!done"
        class="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5 p-6 sm:p-8 flex flex-col gap-6"
        @submit.prevent="save"
      >
        <label class="flex flex-col gap-1.5" for="partner-name">
          <span class="text-sm font-bold text-slate-700">Full name</span>
          <input
            id="partner-name"
            v-model="form.fullName"
            autocomplete="name"
            placeholder="First name and surname"
            maxlength="80"
            class="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#0B1F6B]"
            required
          >
        </label>

        <label class="flex flex-col gap-1.5" for="partner-company">
          <span class="text-sm font-bold text-slate-700">Company</span>
          <input
            id="partner-company"
            v-model="form.company"
            autocomplete="organization"
            placeholder="Your company's name"
            maxlength="120"
            class="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#0B1F6B]"
            required
          >
        </label>

        <fieldset class="flex flex-col gap-2">
          <legend class="text-sm font-bold text-slate-700 mb-2">Will you bring a plus one?</legend>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="opt in plusOneOptions"
              :key="opt.label"
              type="button"
              class="px-4 py-3 rounded-xl border-2 text-sm font-bold transition"
              :class="
                form.plusOne === opt.value
                  ? 'border-[#0B1F6B] bg-[#0B1F6B] text-white'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              "
              :aria-pressed="form.plusOne === opt.value"
              @click="form.plusOne = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </fieldset>

        <section class="flex flex-col gap-3">
          <h2 class="text-sm font-bold text-slate-700">When will you be there?</h2>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1.5" for="partner-arrive">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Arriving</span>
              <select
                id="partner-arrive"
                v-model.number="form.arriveHour"
                class="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
              >
                <option v-for="hr in arriveHours" :key="hr" :value="hr">{{ hourLabel(hr) }}</option>
              </select>
            </label>
            <label class="flex flex-col gap-1.5" for="partner-leave">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Leaving</span>
              <select
                id="partner-leave"
                v-model.number="form.leaveHour"
                class="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
              >
                <option v-for="hr in leaveHours" :key="hr" :value="hr">{{ hourLabel(hr) }}</option>
              </select>
            </label>
          </div>
        </section>

        <p v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{{ error }}</p>
        <button
          type="submit"
          :disabled="busy || closed || form.plusOne === null"
          class="w-full py-4 rounded-2xl bg-[#0B1F6B] text-white font-bold hover:bg-[#08164d] disabled:opacity-60 transition"
        >
          {{ busy ? 'Sending…' : 'Send my RSVP' }}
        </button>
      </form>

      <div
        v-else
        class="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5 p-6 sm:p-8 flex flex-col gap-5 text-center"
      >
        <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
          <span class="material-symbols-outlined text-3xl" aria-hidden="true">check</span>
        </div>
        <div>
          <h2 class="text-xl font-black text-slate-900 mb-1">Thank you, {{ firstName }}. See you there!</h2>
          <p class="text-sm text-slate-500">
            {{ form.plusOne ? 'You and your plus one' : 'Just you' }}, {{ hourLabel(form.arriveHour) }} to
            {{ hourLabel(form.leaveHour) }} on {{ PARTY.partyDate }}.
          </p>
          <p v-if="!closed" class="text-sm text-slate-500 mt-2">
            Need to change something? Send the form again with the same name and company before
            {{ PARTNER_CLOSES_LABEL }}.
          </p>
        </div>
        <button
          v-if="!closed"
          type="button"
          class="w-full py-3 rounded-2xl border-2 border-slate-200 text-slate-800 font-bold hover:bg-slate-50 transition"
          @click="done = false"
        >
          Change my answers
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PARTY, hourLabel } from '#shared/party'
import { PARTNER_CLOSES_LABEL, parsePartnerRsvp, partnerRsvpClosed } from '#shared/partnerParty'

/**
 * Dealer and partner sign-up for the end-of-year party. A page on its own: no
 * site header, footer or links, because the rest of the site is not ready for
 * partners yet.
 */
definePageMeta({ layout: false })
useHead({ title: `${PARTY.name}: partners`, meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const { $apiFetch } = useNuxtApp()

const plusOneOptions = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No, just me' },
] as const

const form = reactive({
  fullName: '',
  company: '',
  plusOne: null as boolean | null,
  arriveHour: PARTY.startHour as number,
  leaveHour: PARTY.endHour as number,
})
const busy = ref(false)
const error = ref('')
const done = ref(false)
const firstName = ref('')
const closed = ref(partnerRsvpClosed())

const arriveHours = Array.from({ length: PARTY.endHour - PARTY.startHour }, (_, i) => PARTY.startHour + i)
const leaveHours = computed(() => {
  const from = form.arriveHour + 1
  return Array.from({ length: PARTY.endHour - from + 1 }, (_, i) => from + i)
})
watch(
  () => form.arriveHour,
  (arrive) => {
    if (form.leaveHour <= arrive) form.leaveHour = arrive + 1
  },
)

async function save() {
  error.value = ''
  // Same rules as the server, so a slip is caught before sending.
  const checked = parsePartnerRsvp(form)
  if ('error' in checked) {
    error.value = checked.error
    return
  }
  busy.value = true
  try {
    const res = await $apiFetch<{ firstName: string }>('/api/partner/rsvp', { method: 'POST', body: checked.rsvp })
    firstName.value = res.firstName
    done.value = true
  } catch (err) {
    const e = err as { statusCode?: number; data?: { statusMessage?: string; message?: string } }
    if (e?.statusCode === 403) closed.value = true
    error.value =
      e?.statusCode === 429
        ? 'Too many tries. Please wait a minute and try again.'
        : e?.data?.statusMessage || e?.data?.message || 'Could not send your RSVP. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

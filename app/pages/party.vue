<template>
  <div class="bg-slate-50 min-h-[80vh] py-10 sm:py-16 px-4">
    <div class="max-w-xl mx-auto">
      <header class="text-center mb-8">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-[#E0533C] mb-3">Staff only</p>
        <p
          class="mb-5 text-sm font-semibold rounded-2xl px-4 py-3 border bg-red-50 border-red-200 text-red-800 text-left flex gap-2"
        >
          <span class="material-symbols-outlined text-lg leading-5 shrink-0" aria-hidden="true">lock</span>
          <span>For internal use only. This page is for Novel Solar employees. Please do not share it with anyone who is not an employee.</span>
        </p>
        <h1 class="text-3xl sm:text-4xl font-black text-[#0B1F6B] mb-3 text-balance">{{ PARTY.name }}</h1>
        <div class="flex flex-wrap justify-center gap-2 text-sm">
          <span class="px-3 py-1.5 rounded-full bg-white border border-slate-200 font-semibold text-slate-700">
            Novelty match: {{ PARTY.matchDate }}, {{ PARTY.matchTime }}
          </span>
          <span class="px-3 py-1.5 rounded-full bg-white border border-slate-200 font-semibold text-slate-700">
            Party: {{ PARTY.partyDate }}, {{ hourLabel(PARTY.startHour) }} to {{ hourLabel(PARTY.endHour) }}
          </span>
        </div>
        <p
          class="mt-5 text-sm font-semibold rounded-2xl px-4 py-3 border"
          :class="closed ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-amber-50 border-amber-200 text-amber-900'"
        >
          <template v-if="closed">Registration closed at {{ PARTY.closesLabel }}.</template>
          <template v-else>
            Registration closes at {{ PARTY.closesLabel }}. If you need to change your answers, do it before then.
          </template>
        </p>
      </header>

      <!-- Step 1: who are you -->
      <form
        v-if="step === 'identify'"
        class="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5 p-6 sm:p-8 flex flex-col gap-5"
        @submit.prevent="identify"
      >
        <div>
          <h2 class="text-lg font-black text-slate-900 mb-1">Register for the party</h2>
          <p class="text-sm text-slate-500">
            {{
              closed
                ? 'Enter your full name to see what you registered.'
                : 'Enter your full name. Already registered? Enter it again to change your answers.'
            }}
          </p>
        </div>
        <label class="flex flex-col gap-1.5" for="party-name">
          <span class="text-sm font-bold text-slate-700">Full name</span>
          <input
            id="party-name"
            v-model="name"
            autocomplete="name"
            placeholder="First name and surname"
            class="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#0B1F6B]"
            required
          >
          <span class="text-xs text-slate-400">As it appears in Bitrix. Not on Bitrix? Enter your full name anyway.</span>
        </label>
        <p v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{{ error }}</p>
        <div v-if="notFound" class="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p class="text-sm text-amber-900">
            We could not find <strong>{{ notFound }}</strong> on the Bitrix staff list. Check the spelling, or if you
            are an employee who is not on Bitrix, register with this name.
          </p>
          <button
            type="button"
            :disabled="busy"
            class="w-full py-3 rounded-xl border-2 border-amber-300 bg-white text-amber-900 font-bold hover:bg-amber-100 disabled:opacity-60 transition"
            @click="identify(true)"
          >
            I'm not on Bitrix, continue as {{ notFound }}
          </button>
        </div>
        <button
          type="submit"
          :disabled="busy"
          class="w-full py-4 rounded-2xl bg-[#0B1F6B] text-white font-bold hover:bg-[#08164d] disabled:opacity-60 transition"
        >
          {{ busy ? 'Checking…' : 'Continue' }}
        </button>
      </form>

      <!-- Step 2: the RSVP -->
      <form
        v-else-if="step === 'form'"
        class="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5 p-6 sm:p-8 flex flex-col gap-7"
        @submit.prevent="save"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-black text-slate-900">Hi {{ firstName }}</h2>
            <p class="text-sm text-slate-500">
              {{ savedAt ? 'You have already registered. Change anything below and save again.' : 'Tell us your plans.' }}
            </p>
          </div>
          <button type="button" class="text-sm font-bold text-slate-400 hover:text-slate-700 shrink-0" @click="reset">
            Not you?
          </button>
        </div>

        <fieldset class="flex flex-col gap-3">
          <legend class="text-sm font-bold text-slate-700 mb-3">Are you coming?</legend>
          <div class="flex flex-col gap-2">
            <button
              v-for="opt in attendanceOptions"
              :key="opt.value"
              type="button"
              class="px-4 py-3 rounded-xl border-2 text-left transition"
              :class="
                choice === opt.value
                  ? 'border-[#0B1F6B] bg-[#0B1F6B] text-white'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              "
              :aria-pressed="choice === opt.value"
              @click="choice = opt.value"
            >
              <span class="block text-sm font-bold">{{ opt.label }}</span>
              <span class="block text-xs" :class="choice === opt.value ? 'text-blue-100' : 'text-slate-500'">{{
                opt.note
              }}</span>
            </button>
          </div>
        </fieldset>

        <template v-if="form.attending">
          <!-- Adults -->
          <section class="flex flex-col gap-3 border-t border-slate-100 pt-6">
            <h3 class="text-sm font-bold text-slate-700">Adult guests</h3>
            <p class="text-xs text-slate-500 -mt-2">Adults coming with you, not counting yourself.</p>
            <Stepper id="party-adults" v-model="form.adultGuests" :max="MAX_ADULT_GUESTS" label="adult guests" />
          </section>

          <!-- Children -->
          <section class="flex flex-col gap-3 border-t border-slate-100 pt-6">
            <h3 class="text-sm font-bold text-slate-700">Children</h3>
            <p class="text-xs text-slate-500 -mt-2">Register each child under 18 who is coming, with their age.</p>
            <div v-for="(child, i) in form.children" :key="i" class="flex items-center gap-3">
              <label :for="`party-child-${i}`" class="text-sm text-slate-600 w-20 shrink-0">Child {{ i + 1 }}</label>
              <select
                :id="`party-child-${i}`"
                v-model.number="child.age"
                class="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                required
              >
                <option :value="null" disabled>Age</option>
                <option v-for="age in 18" :key="age - 1" :value="age - 1">
                  {{ age - 1 === 0 ? 'Under 1' : `${age - 1} years` }}
                </option>
              </select>
              <button
                type="button"
                class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                :aria-label="`Remove child ${i + 1}`"
                @click="form.children.splice(i, 1)"
              >
                <span class="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <button
              v-if="form.children.length < MAX_CHILDREN"
              type="button"
              class="self-start px-4 py-2 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50"
              @click="form.children.push({ age: null })"
            >
              + Add a child
            </button>
          </section>

          <!-- Time -->
          <section v-if="!form.matchOnly" class="flex flex-col gap-3 border-t border-slate-100 pt-6">
            <h3 class="text-sm font-bold text-slate-700">When will you be there on {{ PARTY.partyDate }}?</h3>
            <p class="text-xs text-slate-500 -mt-2">
              The party runs from {{ hourLabel(PARTY.startHour) }} to {{ hourLabel(PARTY.endHour) }}.
            </p>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1.5" for="party-arrive">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">From</span>
                <select
                  id="party-arrive"
                  v-model.number="form.arriveHour"
                  class="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option v-for="hr in arriveHours" :key="hr" :value="hr">{{ hourLabel(hr) }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1.5" for="party-leave">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Until</span>
                <select
                  id="party-leave"
                  v-model.number="form.leaveHour"
                  class="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option v-for="hr in leaveHours" :key="hr" :value="hr">{{ hourLabel(hr) }}</option>
                </select>
              </label>
            </div>
          </section>

          <!-- Match -->
          <section v-if="!form.matchOnly" class="flex flex-col gap-3 border-t border-slate-100 pt-6">
            <h3 class="text-sm font-bold text-slate-700">Novelty match, {{ PARTY.matchDate }} at {{ PARTY.matchTime }}</h3>
            <label class="flex items-center gap-3 text-sm text-slate-700" for="party-match">
              <input id="party-match" v-model="form.noveltyMatch" type="checkbox" class="w-5 h-5 accent-[#0B1F6B]" >
              I'll be at the match
            </label>
          </section>

          <!-- Apartment -->
          <section class="flex flex-col gap-3 border-t border-slate-100 pt-6">
            <h3 class="text-sm font-bold text-slate-700">Staying at {{ PARTY.apartment }}?</h3>
            <div class="flex flex-col gap-2">
              <label
                v-for="opt in lane4Options"
                :key="String(opt.value)"
                :for="`party-lane4-${opt.value ?? 'no'}`"
                class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm cursor-pointer transition"
                :class="form.lane4Stay === opt.value ? 'border-[#0B1F6B] bg-blue-50/60' : 'border-slate-200'"
              >
                <input
                  :id="`party-lane4-${opt.value ?? 'no'}`"
                  v-model="form.lane4Stay"
                  type="radio"
                  name="lane4"
                  :value="opt.value"
                  class="accent-[#0B1F6B]"
                >
                <span class="font-semibold text-slate-800">{{ opt.label }}</span>
              </label>
            </div>
          </section>
        </template>

        <p v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{{ error }}</p>
        <button
          type="submit"
          :disabled="busy || form.attending === null"
          class="w-full py-4 rounded-2xl bg-[#0B1F6B] text-white font-bold hover:bg-[#08164d] disabled:opacity-60 transition"
        >
          {{ busy ? 'Saving…' : savedAt ? 'Save changes' : 'Send my RSVP' }}
        </button>
      </form>

      <!-- Step 3: done -->
      <div
        v-else
        class="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5 p-6 sm:p-8 flex flex-col gap-5"
      >
        <div class="text-center">
          <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-3xl">check</span>
          </div>
          <h2 class="text-xl font-black text-slate-900 mb-1">
            {{ form.attending ? `See you there, ${firstName}` : `Thanks for letting us know, ${firstName}` }}
          </h2>
          <p class="text-sm text-slate-500">
            {{
              closed
                ? 'Your RSVP is saved. Registration has closed, so it can no longer be changed.'
                : `Your RSVP is saved. You can come back to this page to change it until ${PARTY.closesLabel}.`
            }}
          </p>
        </div>
        <dl v-if="form.attending" class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm bg-slate-50 rounded-2xl p-5">
          <dt class="text-slate-500">Coming</dt>
          <dd class="font-semibold text-slate-900">{{ partySummary }}</dd>
          <template v-if="form.matchOnly">
            <dt class="text-slate-500">Event</dt>
            <dd class="font-semibold text-slate-900">Sports only: {{ PARTY.matchDate }}, {{ PARTY.matchTime }}</dd>
          </template>
          <template v-else>
            <dt class="text-slate-500">Party</dt>
            <dd class="font-semibold text-slate-900">
              {{ hourLabel(form.arriveHour ?? PARTY.startHour) }} to {{ hourLabel(form.leaveHour ?? PARTY.endHour) }}
            </dd>
            <dt class="text-slate-500">Match</dt>
            <dd class="font-semibold text-slate-900">{{ form.noveltyMatch ? 'Yes' : 'No' }}</dd>
          </template>
          <dt class="text-slate-500">{{ PARTY.apartment }}</dt>
          <dd class="font-semibold text-slate-900">{{ form.lane4Stay ? LANE4_STAYS[form.lane4Stay] : 'Not staying' }}</dd>
        </dl>
        <button
          v-if="!closed"
          type="button"
          class="w-full py-3 rounded-2xl border-2 border-slate-200 text-slate-800 font-bold hover:bg-slate-50 transition"
          @click="step = 'form'"
        >
          Change my answers
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h } from 'vue'
import {
  LANE4_STAYS,
  MAX_ADULT_GUESTS,
  MAX_CHILDREN,
  PARTY,
  hourLabel,
  partyRsvpClosed,
  type Lane4Stay,
  type PartyRsvp,
} from '#shared/party'

useHead({ title: PARTY.name, meta: [{ name: 'robots', content: 'noindex' }] })

const { $apiFetch } = useNuxtApp()

const Stepper = defineComponent({
  props: {
    modelValue: { type: Number, required: true },
    max: { type: Number, required: true },
    label: { type: String, required: true },
    id: { type: String, required: true },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const btn = 'w-11 h-11 rounded-xl border border-slate-200 text-xl font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40'
    return () =>
      h('div', { class: 'flex items-center gap-3' }, [
        h(
          'button',
          {
            type: 'button',
            class: btn,
            disabled: props.modelValue <= 0,
            'aria-label': `Fewer ${props.label}`,
            onClick: () => emit('update:modelValue', props.modelValue - 1),
          },
          '−',
        ),
        h('output', { id: props.id, class: 'w-10 text-center text-lg font-black tabular-nums' }, String(props.modelValue)),
        h(
          'button',
          {
            type: 'button',
            class: btn,
            disabled: props.modelValue >= props.max,
            'aria-label': `More ${props.label}`,
            onClick: () => emit('update:modelValue', props.modelValue + 1),
          },
          '+',
        ),
      ])
  },
})

interface FormState {
  attending: boolean | null
  matchOnly: boolean
  adultGuests: number
  children: { age: number | null }[]
  arriveHour: number | null
  leaveHour: number | null
  noveltyMatch: boolean
  lane4Stay: Lane4Stay | null
}

const blankForm = (): FormState => ({
  attending: null,
  matchOnly: false,
  adultGuests: 0,
  children: [],
  arriveHour: PARTY.startHour,
  leaveHour: PARTY.endHour,
  noveltyMatch: false,
  lane4Stay: null,
})

const step = ref<'identify' | 'form' | 'done'>('identify')
const name = ref('')
const firstName = ref('')
const savedAt = ref<string | null>(null)
const busy = ref(false)
const error = ref('')
const form = reactive<FormState>(blankForm())
const closed = ref(partyRsvpClosed())
// Set when the name is not on the Bitrix staff list: the name to offer "continue as".
const notFound = ref<string | null>(null)
// The person said they are not on Bitrix; every request then says so too.
const notOnBitrix = ref(false)
watch(name, () => {
  notFound.value = null
  notOnBitrix.value = false
})

type Choice = 'party' | 'match' | 'no'

const attendanceOptions: { value: Choice; label: string; note: string }[] = [
  {
    value: 'party',
    label: "Yes, I'll be at the party",
    note: `${PARTY.partyDate}, and the match on ${PARTY.matchDate} if you like`,
  },
  { value: 'match', label: 'Sports only', note: `Just the novelty match: ${PARTY.matchDate}, ${PARTY.matchTime}` },
  { value: 'no', label: "No, I can't make it", note: 'Not coming to either' },
]

const choice = computed<Choice | null>({
  get: () => (form.attending === null ? null : !form.attending ? 'no' : form.matchOnly ? 'match' : 'party'),
  set: (value) => {
    form.attending = value !== 'no'
    form.matchOnly = value === 'match'
    if (value === 'match') form.noveltyMatch = true
  },
})

const lane4Options: { value: Lane4Stay | null; label: string }[] = [
  { value: null, label: 'No, not staying' },
  { value: 'fri_sat', label: `Yes, ${LANE4_STAYS.fri_sat}` },
  { value: 'fri_sun', label: `Yes, ${LANE4_STAYS.fri_sun}` },
]

const arriveHours = computed(() =>
  Array.from({ length: PARTY.endHour - PARTY.startHour }, (_, i) => PARTY.startHour + i),
)
const leaveHours = computed(() => {
  const from = (form.arriveHour ?? PARTY.startHour) + 1
  return Array.from({ length: PARTY.endHour - from + 1 }, (_, i) => from + i)
})
watch(
  () => form.arriveHour,
  (arrive) => {
    if (arrive !== null && (form.leaveHour === null || form.leaveHour <= arrive)) form.leaveHour = arrive + 1
  },
)

const partySummary = computed(() => {
  const parts = ['You']
  if (form.adultGuests) parts.push(`${form.adultGuests} adult${form.adultGuests === 1 ? '' : 's'}`)
  if (form.children.length) parts.push(`${form.children.length} child${form.children.length === 1 ? '' : 'ren'}`)
  return parts.join(' + ')
})

function fill(rsvp: (PartyRsvp & { updatedAt: string }) | null) {
  Object.assign(form, blankForm())
  savedAt.value = rsvp?.updatedAt ?? null
  if (!rsvp) return
  Object.assign(form, {
    attending: rsvp.attending,
    matchOnly: rsvp.matchOnly ?? false,
    adultGuests: rsvp.adultGuests,
    children: rsvp.children.map((c) => ({ age: c.age })),
    arriveHour: rsvp.arriveHour ?? PARTY.startHour,
    leaveHour: rsvp.leaveHour ?? PARTY.endHour,
    noveltyMatch: rsvp.noveltyMatch,
    lane4Stay: rsvp.lane4Stay,
  })
}

function messageOf(err: unknown, fallback: string): string {
  const e = err as { data?: { statusMessage?: string; message?: string }; statusCode?: number }
  if (e?.statusCode === 429) return 'Too many tries. Please wait a minute and try again.'
  return e?.data?.statusMessage || e?.data?.message || fallback
}

interface PartyResponse {
  firstName: string
  onBitrix: boolean
  rsvp: (PartyRsvp & { updatedAt: string }) | null
}

// Called from the form's submit (with an Event) or the "not on Bitrix" button (with true).
async function identify(asNotOnBitrix?: unknown) {
  busy.value = true
  error.value = ''
  const unlisted = asNotOnBitrix === true
  try {
    const res = await $apiFetch<PartyResponse>('/api/party/lookup', {
      method: 'POST',
      body: { name: name.value, notOnBitrix: unlisted },
    })
    notFound.value = null
    notOnBitrix.value = unlisted && !res.onBitrix
    closed.value = partyRsvpClosed()
    if (closed.value && !res.rsvp) {
      error.value = `Registration closed at ${PARTY.closesLabel}, and we have no RSVP from you.`
      return
    }
    firstName.value = res.firstName
    fill(res.rsvp)
    step.value = res.rsvp ? 'done' : 'form'
  } catch (err) {
    const data = (err as { data?: { data?: { code?: string } } })?.data?.data
    if (!unlisted && data?.code === 'NOT_ON_STAFF_LIST') {
      notFound.value = name.value.replace(/\s+/g, ' ').trim()
      return
    }
    error.value = messageOf(err, 'Could not check your name. Please try again.')
  } finally {
    busy.value = false
  }
}

async function save() {
  if (form.attending && form.children.some((c) => c.age === null)) {
    error.value = "Please choose each child's age."
    return
  }
  busy.value = true
  error.value = ''
  try {
    const res = await $apiFetch<PartyResponse>('/api/party/rsvp', {
      method: 'POST',
      body: { name: name.value, notOnBitrix: notOnBitrix.value, ...form },
    })
    fill(res.rsvp)
    step.value = 'done'
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode === 403) closed.value = true
    error.value = messageOf(err, 'Could not save your RSVP. Please try again.')
  } finally {
    busy.value = false
  }
}

function reset() {
  name.value = ''
  notFound.value = null
  notOnBitrix.value = false
  firstName.value = ''
  error.value = ''
  fill(null)
  step.value = 'identify'
}
</script>

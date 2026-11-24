<template>
  <div class="min-h-screen bg-slate-50">
    <header class="bg-white border-b border-slate-200">
      <div class="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-4">
          <NuxtLink v-if="backTo" :to="backTo" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl" title="Dashboard">
            <span class="material-symbols-outlined">arrow_back</span>
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">{{ PARTY.name }}</h1>
            <p class="text-sm text-slate-500 font-medium">
              {{ partners ? 'Staff, dealer and partner RSVPs' : 'Staff RSVPs' }}. Party {{ PARTY.partyDate }},
              {{ hourLabel(PARTY.startHour) }} to {{ hourLabel(PARTY.endHour) }}; match {{ PARTY.matchDate }},
              {{ PARTY.matchTime }}.
            </p>
            <p class="text-xs font-bold text-red-700 mt-1">
              Internal use only. Do not share this page or its data with anyone who is not an employee.
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            @click="emit('refresh')"
          >
            Refresh
          </button>
          <button
            v-if="showCopyLink"
            class="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            @click="copyLink"
          >
            {{ copied ? 'Link copied' : 'Copy RSVP link' }}
          </button>
          <button
            class="px-4 py-2 rounded-xl text-sm font-bold bg-slate-900 text-white disabled:opacity-50"
            :disabled="!rsvps.length"
            @click="downloadCsv"
          >
            Download CSV
          </button>
          <button
            v-if="partners"
            class="px-4 py-2 rounded-xl text-sm font-bold bg-slate-900 text-white disabled:opacity-50"
            :disabled="!partners.length"
            @click="downloadPartnersCsv"
          >
            Partners CSV
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div v-if="error" class="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100">
        {{ error }}
      </div>

      <!-- Totals -->
      <section class="grid grid-cols-2 gap-4" :class="partners ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-5'">
        <div v-for="tile in tiles" :key="tile.label" class="bg-white rounded-2xl border border-slate-200 p-5">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">{{ tile.label }}</p>
          <p class="text-3xl font-black text-slate-900 tabular-nums mt-1">{{ tile.value }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ tile.note }}</p>
        </div>
      </section>

      <section class="grid lg:grid-cols-[2fr_1fr] gap-6">
        <!-- People present each hour -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 min-w-0">
          <h2 class="text-sm font-black text-slate-900">People at the party, hour by hour</h2>
          <p class="text-xs text-slate-500 mb-4">
            {{ partners ? 'Staff, guests, children, partners and their plus ones together.' : 'Staff, adult guests and children together.' }}
          </p>
          <div class="flex items-end gap-2 h-40">
            <div v-for="slot in hourly" :key="slot.hour" class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <span class="text-xs font-bold text-slate-700 tabular-nums">{{ slot.count }}</span>
              <div
                class="w-full rounded-t-md bg-[#0B1F6B]"
                :style="{ height: `${maxHourly ? (slot.count / maxHourly) * 100 : 0}%`, minHeight: slot.count ? '4px' : '0' }"
              />
              <span class="text-[11px] text-slate-500 whitespace-nowrap">{{ hourLabel(slot.hour) }}</span>
            </div>
          </div>
        </div>

        <!-- Lane 4 + children ages -->
        <div class="flex flex-col gap-4">
          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 class="text-sm font-black text-slate-900 mb-3">{{ PARTY.apartment }} apartment</h2>
            <dl class="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
              <template v-for="(label, key) in LANE4_STAYS" :key="key">
                <dt class="text-slate-600">{{ label }}</dt>
                <dd class="font-black tabular-nums text-right">{{ lane4Count(key) }}</dd>
              </template>
            </dl>
            <p class="text-xs text-slate-400 mt-3">Staff members staying; their guests are not counted here.</p>
          </div>
          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 class="text-sm font-black text-slate-900 mb-3">Children by age</h2>
            <dl class="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
              <template v-for="band in childBands" :key="band.label">
                <dt class="text-slate-600">{{ band.label }}</dt>
                <dd class="font-black tabular-nums text-right">{{ band.count }}</dd>
              </template>
            </dl>
          </div>
        </div>
      </section>

      <!-- Search and filters -->
      <div class="flex flex-col gap-3 bg-white rounded-2xl border border-slate-200 p-4">
        <input
          id="party-search"
          v-model="search"
          type="search"
          placeholder="Search by name, staff code or job title"
          class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400"
        >
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <label class="flex flex-col gap-1 min-w-0" for="party-filter-coming">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Coming</span>
            <select id="party-filter-coming" v-model="comingFilter" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
              <option value="all">Everyone</option>
              <option value="party">Party</option>
              <option value="sports">Sports only</option>
              <option value="no">Can't make it</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 min-w-0" for="party-filter-match">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Novelty match</span>
            <select id="party-filter-match" v-model="matchFilter" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
              <option value="all">Any</option>
              <option value="yes">At the match</option>
              <option value="no">Not at the match</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 min-w-0" for="party-filter-lane4">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">{{ PARTY.apartment }}</span>
            <select id="party-filter-lane4" v-model="lane4Filter" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
              <option value="all">Any</option>
              <option value="staying">Staying</option>
              <option v-for="(label, key) in LANE4_STAYS" :key="key" :value="key">{{ label }}</option>
              <option value="none">Not staying</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 min-w-0" for="party-filter-guests">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Guests and children</span>
            <select id="party-filter-guests" v-model="guestsFilter" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
              <option value="all">Any</option>
              <option value="with">Bringing someone</option>
              <option value="without">Coming alone</option>
            </select>
          </label>
        </div>
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="text-slate-500 tabular-nums">Showing {{ filtered.length }} of {{ rsvps.length }} RSVPs</span>
          <button
            v-if="filtersActive"
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100"
            @click="clearFilters"
          >
            Clear filters
          </button>
        </div>
        <p v-if="deleteError" class="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">{{ deleteError }}</p>
      </div>

      <!-- One table for Bitrix staff, one for people not on Bitrix -->
      <section
        v-for="group in groups"
        :key="group.id"
        class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
      >
        <div class="px-5 py-4 border-b border-slate-100">
          <h2 class="text-sm font-black text-slate-900">{{ group.title }} ({{ group.all.length }})</h2>
          <p class="text-xs text-slate-500">{{ group.note }}</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th class="px-5 py-3">Name</th>
                <th class="px-5 py-3">Coming</th>
                <th class="px-5 py-3 text-right">Adults</th>
                <th class="px-5 py-3">Children</th>
                <th class="px-5 py-3">Time</th>
                <th class="px-5 py-3">Match</th>
                <th class="px-5 py-3">{{ PARTY.apartment }}</th>
                <th class="px-5 py-3">Updated</th>
                <th v-if="deleteRsvp" class="px-5 py-3"><span class="sr-only">Delete</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="pending && !rsvps.length">
                <td :colspan="columns" class="px-5 py-10 text-center text-slate-400">Loading…</td>
              </tr>
              <tr v-else-if="!group.shown.length">
                <td :colspan="columns" class="px-5 py-8 text-center text-slate-400">
                  {{ group.all.length ? 'No RSVPs match.' : group.empty }}
                </td>
              </tr>
              <tr v-for="r in group.shown" :key="r.id" :class="r.attending ? '' : 'text-slate-400'">
                <td class="px-5 py-3">
                  <p class="font-bold text-slate-900">{{ r.name }}</p>
                  <p class="text-xs text-slate-500">
                    {{ r.staffCode ?? 'Not on Bitrix' }}<span v-if="r.jobTitle"> · {{ r.jobTitle }}</span>
                  </p>
                </td>
                <td class="px-5 py-3">
                  <span
                    class="px-2 py-0.5 rounded-full text-xs font-bold"
                    :class="
                      !r.attending
                        ? 'bg-slate-100 text-slate-500'
                        : r.matchOnly
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-emerald-100 text-emerald-700'
                    "
                    >{{ comingLabel(r) }}</span
                  >
                </td>
                <td class="px-5 py-3 text-right tabular-nums">{{ r.attending ? r.adultGuests : '' }}</td>
                <td class="px-5 py-3">{{ childrenText(r) }}</td>
                <td class="px-5 py-3 whitespace-nowrap">
                  {{ r.arriveHour !== null && r.leaveHour !== null ? `${hourLabel(r.arriveHour)}–${hourLabel(r.leaveHour)}` : '' }}
                </td>
                <td class="px-5 py-3">{{ r.attending ? (r.noveltyMatch ? 'Yes' : 'No') : '' }}</td>
                <td class="px-5 py-3 whitespace-nowrap">{{ r.lane4Stay ? LANE4_STAYS[r.lane4Stay] : '' }}</td>
                <td class="px-5 py-3 whitespace-nowrap text-slate-500">{{ formatDate(r.updatedAt) }}</td>
                <td v-if="deleteRsvp" class="px-5 py-3 whitespace-nowrap text-right">
                  <template v-if="confirming === r.id">
                    <button
                      class="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50"
                      :disabled="deleting"
                      @click="confirmDelete(r.id)"
                    >
                      {{ deleting ? 'Deleting…' : 'Delete for good' }}
                    </button>
                    <button
                      class="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100"
                      :disabled="deleting"
                      @click="confirming = null"
                    >
                      Cancel
                    </button>
                  </template>
                  <button
                    v-else
                    class="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50"
                    :aria-label="`Delete ${r.name}'s RSVP`"
                    @click="confirming = r.id"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Dealers and partners: their own sign-up form and table -->
      <section v-if="partners" class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div class="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 class="text-sm font-black text-slate-900">Dealers and partners ({{ partners.length }})</h2>
            <p class="text-xs text-slate-500">
              From the partner sign-up form. {{ partnerPlusOnes }} plus one{{ partnerPlusOnes === 1 ? '' : 's' }},
              {{ partners.length + partnerPlusOnes }} people in all.
            </p>
          </div>
          <input
            id="partner-search"
            v-model="partnerSearch"
            type="search"
            placeholder="Search by name or company"
            class="w-full sm:w-72 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400"
          >
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th class="px-5 py-3">Name</th>
                <th class="px-5 py-3">Company</th>
                <th class="px-5 py-3">Plus one</th>
                <th class="px-5 py-3">Time</th>
                <th class="px-5 py-3">Updated</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="pending && !partners.length">
                <td colspan="5" class="px-5 py-10 text-center text-slate-400">Loading…</td>
              </tr>
              <tr v-else-if="!partnersShown.length">
                <td colspan="5" class="px-5 py-8 text-center text-slate-400">
                  {{ partners.length ? 'No partners match.' : 'No dealers or partners have registered yet.' }}
                </td>
              </tr>
              <tr v-for="p in partnersShown" :key="p.id">
                <td class="px-5 py-3 font-bold text-slate-900">{{ p.fullName }}</td>
                <td class="px-5 py-3">{{ p.company }}</td>
                <td class="px-5 py-3">{{ p.plusOne ? 'Yes' : 'No' }}</td>
                <td class="px-5 py-3 whitespace-nowrap">{{ hourLabel(p.arriveHour) }}–{{ hourLabel(p.leaveHour) }}</td>
                <td class="px-5 py-3 whitespace-nowrap text-slate-500">{{ formatDate(p.updatedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { LANE4_STAYS, PARTY, hourLabel, type Lane4Stay, type PartyReportRow } from '#shared/party'
import type { PartnerReportRow } from '#shared/partnerParty'

type AdminRsvp = PartyReportRow

const props = defineProps<{
  rsvps: PartyReportRow[]
  pending: boolean
  error: string | null
  backTo?: string
  showCopyLink?: boolean
  /** Given only on the admin page; without it the report is view-only. */
  deleteRsvp?: (id: string) => Promise<void>
  /** Dealer and partner RSVPs. Left out, the report has no partner section. */
  partners?: PartnerReportRow[]
}>()
const emit = defineEmits<{ refresh: [] }>()

const columns = computed(() => (props.deleteRsvp ? 9 : 8))
const confirming = ref<string | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

async function confirmDelete(id: string) {
  if (!props.deleteRsvp) return
  deleting.value = true
  deleteError.value = null
  try {
    await props.deleteRsvp(id)
    confirming.value = null
  } catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    deleteError.value = e?.data?.statusMessage || 'Could not delete the RSVP. Try again.'
  } finally {
    deleting.value = false
  }
}

const rsvps = computed(() => props.rsvps)
const coming = computed(() => rsvps.value.filter((r) => r.attending))
const search = ref('')
const comingFilter = ref<'all' | 'party' | 'sports' | 'no'>('all')
const matchFilter = ref<'all' | 'yes' | 'no'>('all')
const lane4Filter = ref<'all' | 'staying' | 'none' | Lane4Stay>('all')
const guestsFilter = ref<'all' | 'with' | 'without'>('all')

const filtersActive = computed(
  () =>
    Boolean(search.value.trim()) ||
    comingFilter.value !== 'all' ||
    matchFilter.value !== 'all' ||
    lane4Filter.value !== 'all' ||
    guestsFilter.value !== 'all',
)

function clearFilters() {
  search.value = ''
  comingFilter.value = 'all'
  matchFilter.value = 'all'
  lane4Filter.value = 'all'
  guestsFilter.value = 'all'
}

const filtered = computed(() => {
  const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return rsvps.value.filter((r) => {
    // Every word typed must appear somewhere in the name, staff code or job title.
    const haystack = `${r.name} ${r.staffCode ?? ''} ${r.jobTitle ?? ''}`.toLowerCase()
    if (!words.every((w) => haystack.includes(w))) return false

    const kind = !r.attending ? 'no' : r.matchOnly ? 'sports' : 'party'
    if (comingFilter.value !== 'all' && comingFilter.value !== kind) return false
    if (matchFilter.value !== 'all' && (r.attending && r.noveltyMatch) !== (matchFilter.value === 'yes')) return false

    if (lane4Filter.value === 'staying' && !r.lane4Stay) return false
    if (lane4Filter.value === 'none' && r.lane4Stay) return false
    if ((lane4Filter.value === 'fri_sat' || lane4Filter.value === 'fri_sun') && r.lane4Stay !== lane4Filter.value) return false

    const bringsSomeone = r.adultGuests > 0 || r.children.length > 0
    if (guestsFilter.value === 'with' && !bringsSomeone) return false
    if (guestsFilter.value === 'without' && bringsSomeone) return false
    return true
  })
})

const groups = computed(() => [
  {
    id: 'bitrix',
    title: 'On Bitrix',
    note: 'Matched to the Bitrix staff list.',
    empty: 'No RSVPs from Bitrix staff yet.',
    all: rsvps.value.filter((r) => r.onBitrix),
    shown: filtered.value.filter((r) => r.onBitrix),
  },
  {
    id: 'not-on-bitrix',
    title: 'Not on Bitrix',
    note: 'Registered by name only. Check these are real employees.',
    empty: 'Nobody has registered without a Bitrix account.',
    all: rsvps.value.filter((r) => !r.onBitrix),
    shown: filtered.value.filter((r) => !r.onBitrix),
  },
])

const sum = (rows: AdminRsvp[], pick: (r: AdminRsvp) => number) => rows.reduce((n, r) => n + pick(r), 0)

const groupSize = (r: AdminRsvp) => 1 + r.adultGuests + r.children.length
const atParty = computed(() => coming.value.filter((r) => !r.matchOnly))
const atMatch = computed(() => coming.value.filter((r) => r.noveltyMatch))

const comingLabel = (r: AdminRsvp) => (!r.attending ? 'No' : r.matchOnly ? 'Sports only' : 'Party')

const tiles = computed(() => {
  const staff = coming.value.length
  const sportsOnly = staff - atParty.value.length
  const declined = rsvps.value.length - staff
  return [
    {
      label: 'Staff coming',
      value: staff,
      note: `${atParty.value.length} party, ${sportsOnly} sports only, ${declined} can't make it`,
    },
    // Guests and children come to the party only; the match is staff only.
    { label: 'Adult guests', value: sum(atParty.value, (r) => r.adultGuests), note: 'Visitors, party only' },
    { label: 'Children', value: sum(atParty.value, (r) => r.children.length), note: 'Party only' },
    {
      label: 'At the party',
      value: sum(atParty.value, groupSize),
      note: `Staff, guests and children, ${PARTY.partyDate}`,
    },
    {
      label: 'At the match',
      value: atMatch.value.length,
      note: `Staff only, ${PARTY.matchDate}`,
    },
    ...(props.partners
      ? [
          {
            label: 'Dealers and partners coming',
            value: props.partners.length,
            note: `${partnerPlusOnes.value} plus ones, ${props.partners.length + partnerPlusOnes.value} people in all`,
          },
        ]
      : []),
  ]
})

const partnerPlusOnes = computed(() => (props.partners ?? []).filter((p) => p.plusOne).length)
const partnerSearch = ref('')
const partnersShown = computed(() => {
  const words = partnerSearch.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return (props.partners ?? []).filter((p) => {
    const haystack = `${p.fullName} ${p.company}`.toLowerCase()
    return words.every((w) => haystack.includes(w))
  })
})

const hourly = computed(() =>
  Array.from({ length: PARTY.endHour - PARTY.startHour }, (_, i) => {
    const hour = PARTY.startHour + i
    const staff = sum(coming.value, (r) =>
      r.arriveHour !== null && r.leaveHour !== null && r.arriveHour <= hour && r.leaveHour > hour ? groupSize(r) : 0,
    )
    const partners = (props.partners ?? []).reduce(
      (n, p) => n + (p.arriveHour <= hour && p.leaveHour > hour ? (p.plusOne ? 2 : 1) : 0),
      0,
    )
    return { hour, count: staff + partners }
  }),
)
const maxHourly = computed(() => Math.max(0, ...hourly.value.map((s) => s.count)))

const lane4Count = (key: Lane4Stay) => coming.value.filter((r) => r.lane4Stay === key).length

const childBands = computed(() => {
  const ages = atParty.value.flatMap((r) => r.children.map((c) => c.age))
  return [
    { label: 'Under 5', count: ages.filter((a) => a < 5).length },
    { label: '5 to 12', count: ages.filter((a) => a >= 5 && a <= 12).length },
    { label: '13 to 17', count: ages.filter((a) => a >= 13).length },
  ]
})

const childrenText = (r: AdminRsvp) =>
  r.children.length ? `${r.children.length} (ages ${r.children.map((c) => c.age).join(', ')})` : ''

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/party`)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}

function downloadCsv() {
  const header = ['Name', 'On Bitrix', 'Staff code', 'Job title', 'Coming', 'Adult guests', 'Children', 'Children ages', 'From', 'Until', 'Novelty match', PARTY.apartment, 'Updated']
  const rows = rsvps.value.map((r) => [
    r.name,
    r.onBitrix ? 'Yes' : 'No',
    r.staffCode ?? '',
    r.jobTitle ?? '',
    comingLabel(r),
    r.attending ? r.adultGuests : '',
    r.attending ? r.children.length : '',
    r.children.map((c) => c.age).join(' '),
    r.arriveHour !== null ? hourLabel(r.arriveHour) : '',
    r.leaveHour !== null ? hourLabel(r.leaveHour) : '',
    r.attending ? (r.noveltyMatch ? 'Yes' : 'No') : '',
    r.lane4Stay ? LANE4_STAYS[r.lane4Stay] : '',
    r.updatedAt,
  ])
  saveCsv('party-rsvps.csv', [header, ...rows])
}

function downloadPartnersCsv() {
  const header = ['Name', 'Company', 'Plus one', 'Arriving', 'Leaving', 'Updated']
  const rows = (props.partners ?? []).map((p) => [
    p.fullName,
    p.company,
    p.plusOne ? 'Yes' : 'No',
    hourLabel(p.arriveHour),
    hourLabel(p.leaveHour),
    p.updatedAt,
  ])
  saveCsv('partner-rsvps.csv', [header, ...rows])
}

// Some names are typed by the public: a cell starting = + - @ would run as a
// formula when the file is opened in Excel, so it gets a leading quote.
const csvCell = (value: unknown) => {
  const text = String(value)
  return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`
}

function saveCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

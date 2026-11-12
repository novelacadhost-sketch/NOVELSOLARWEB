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
              Staff RSVPs. Party {{ PARTY.partyDate }},
              {{ hourLabel(PARTY.startHour) }} to {{ hourLabel(PARTY.endHour) }}; match {{ PARTY.matchDate }},
              {{ PARTY.matchTime }}.
            </p>
          </div>
        </div>
        <div class="flex gap-2">
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
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div v-if="error" class="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100">
        {{ error }}
      </div>

      <!-- Totals -->
      <section class="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          <p class="text-xs text-slate-500 mb-4">Staff, adult guests and children together.</p>
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

      <!-- Table -->
      <section class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div class="p-4 border-b border-slate-100">
          <input
            id="party-search"
            v-model="search"
            type="search"
            placeholder="Search by name or staff code"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
          >
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th class="px-5 py-3">Staff</th>
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
              <tr v-if="deleteError">
                <td :colspan="columns" class="px-5 py-3 bg-red-50 text-red-600 text-sm">{{ deleteError }}</td>
              </tr>
              <tr v-if="pending && !rsvps.length">
                <td :colspan="columns" class="px-5 py-10 text-center text-slate-400">Loading…</td>
              </tr>
              <tr v-else-if="!filtered.length">
                <td :colspan="columns" class="px-5 py-10 text-center text-slate-400">
                  {{ rsvps.length ? 'No RSVPs match.' : 'No RSVPs yet. Share the link with staff.' }}
                </td>
              </tr>
              <tr v-for="r in filtered" :key="r.staffCode" :class="r.attending ? '' : 'text-slate-400'">
                <td class="px-5 py-3">
                  <p class="font-bold text-slate-900">{{ r.name }}</p>
                  <p class="text-xs text-slate-500">{{ r.staffCode }}<span v-if="r.jobTitle"> · {{ r.jobTitle }}</span></p>
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
                  <template v-if="confirming === r.staffCode">
                    <button
                      class="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50"
                      :disabled="deleting"
                      @click="confirmDelete(r.staffCode)"
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
                    @click="confirming = r.staffCode"
                  >
                    Delete
                  </button>
                </td>
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

type AdminRsvp = PartyReportRow

const props = defineProps<{
  rsvps: PartyReportRow[]
  pending: boolean
  error: string | null
  backTo?: string
  showCopyLink?: boolean
  /** Given only on the admin page; without it the report is view-only. */
  deleteRsvp?: (staffCode: string) => Promise<void>
}>()
const emit = defineEmits<{ refresh: [] }>()

const columns = computed(() => (props.deleteRsvp ? 9 : 8))
const confirming = ref<string | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

async function confirmDelete(staffCode: string) {
  if (!props.deleteRsvp) return
  deleting.value = true
  deleteError.value = null
  try {
    await props.deleteRsvp(staffCode)
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
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rsvps.value
  return rsvps.value.filter((r) => r.name.toLowerCase().includes(q) || r.staffCode.toLowerCase().includes(q))
})

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
    { label: 'Adult guests', value: sum(coming.value, (r) => r.adultGuests), note: 'Not counting staff' },
    { label: 'Children', value: sum(coming.value, (r) => r.children.length), note: 'Registered separately' },
    {
      label: 'At the party',
      value: sum(atParty.value, groupSize),
      note: `People on ${PARTY.partyDate}`,
    },
    {
      label: 'At the match',
      value: sum(atMatch.value, groupSize),
      note: `People on ${PARTY.matchDate}`,
    },
  ]
})

const hourly = computed(() =>
  Array.from({ length: PARTY.endHour - PARTY.startHour }, (_, i) => {
    const hour = PARTY.startHour + i
    const count = sum(coming.value, (r) =>
      r.arriveHour !== null && r.leaveHour !== null && r.arriveHour <= hour && r.leaveHour > hour ? groupSize(r) : 0,
    )
    return { hour, count }
  }),
)
const maxHourly = computed(() => Math.max(0, ...hourly.value.map((s) => s.count)))

const lane4Count = (key: Lane4Stay) => coming.value.filter((r) => r.lane4Stay === key).length

const childBands = computed(() => {
  const ages = coming.value.flatMap((r) => r.children.map((c) => c.age))
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
  const header = ['Name', 'Staff code', 'Job title', 'Coming', 'Adult guests', 'Children', 'Children ages', 'From', 'Until', 'Novelty match', PARTY.apartment, 'Updated']
  const rows = rsvps.value.map((r) => [
    r.name,
    r.staffCode,
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
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'party-rsvps.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-8 px-4">
    <div class="max-w-5xl mx-auto flex flex-col gap-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NuxtLink to="/admin" class="text-sm font-bold text-slate-500 hover:text-slate-800">&larr; Admin</NuxtLink>
          <h1 class="text-2xl font-black text-[#0B1F6B]">Partner RSVPs</h1>
          <p class="text-sm text-slate-500">Dealers and partners coming to the {{ PARTY.name }}, {{ PARTY.partyDate }}.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold" @click="copyLink">
            {{ copied ? 'Copied' : 'Copy form link' }}
          </button>
          <button type="button" class="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold" @click="refresh()">
            Refresh
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-[#0B1F6B] text-white text-sm font-bold disabled:opacity-60"
            :disabled="!rsvps.length"
            @click="downloadCsv"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div v-for="tile in tiles" :key="tile.label" class="bg-white rounded-2xl border border-slate-100 p-4">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">{{ tile.label }}</p>
          <p class="text-3xl font-black text-slate-900 tabular-nums">{{ tile.value }}</p>
        </div>
      </div>

      <input
        v-model="search"
        type="search"
        placeholder="Search by name or company"
        class="px-4 py-3 rounded-xl border border-slate-200 bg-white"
      >

      <p v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">Could not load RSVPs.</p>
      <p v-if="deleteError" class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{{ deleteError }}</p>

      <div class="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
            <tr>
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Company</th>
              <th class="px-4 py-3">Plus one</th>
              <th class="px-4 py-3">Time</th>
              <th class="px-4 py-3">Updated</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending && !rsvps.length"><td colspan="6" class="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
            <tr v-else-if="!shown.length">
              <td colspan="6" class="px-4 py-6 text-center text-slate-400">
                {{ rsvps.length ? 'Nobody matches that search.' : 'No partner RSVPs yet.' }}
              </td>
            </tr>
            <tr v-for="r in shown" :key="r.id" class="border-b border-slate-50 last:border-0">
              <td class="px-4 py-3 font-semibold text-slate-900">{{ r.fullName }}</td>
              <td class="px-4 py-3 text-slate-700">{{ r.company }}</td>
              <td class="px-4 py-3">{{ r.plusOne ? 'Yes' : 'No' }}</td>
              <td class="px-4 py-3 whitespace-nowrap">{{ hourLabel(r.arriveHour) }} to {{ hourLabel(r.leaveHour) }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-slate-500">{{ formatDate(r.updatedAt) }}</td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <template v-if="confirming === r.id">
                  <button type="button" class="text-xs font-bold text-red-600 mr-3" :disabled="deleting" @click="remove(r.id)">
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                  </button>
                  <button type="button" class="text-xs font-bold text-slate-500" @click="confirming = null">Cancel</button>
                </template>
                <button v-else type="button" class="text-xs font-bold text-slate-400 hover:text-red-600" @click="confirming = r.id">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PARTY, hourLabel } from '#shared/party'
import type { PartnerReportRow } from '#shared/partnerParty'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Partner RSVPs | Novel Solar Admin' })

const { $apiFetch } = useNuxtApp()
const { data, pending, error, refresh } = await useFetch<{ rsvps: PartnerReportRow[] }>('/api/admin/partner-rsvps', {
  headers: useRequestHeaders(['cookie']),
})

const rsvps = computed(() => data.value?.rsvps ?? [])
const search = ref('')
const shown = computed(() => {
  const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return rsvps.value.filter((r) => {
    const haystack = `${r.fullName} ${r.company}`.toLowerCase()
    return words.every((w) => haystack.includes(w))
  })
})

const tiles = computed(() => {
  const plusOnes = rsvps.value.filter((r) => r.plusOne).length
  return [
    { label: 'Partners', value: rsvps.value.length },
    { label: 'Plus ones', value: plusOnes },
    { label: 'People in all', value: rsvps.value.length + plusOnes },
  ]
})

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const confirming = ref<string | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)
async function remove(id: string) {
  deleting.value = true
  deleteError.value = null
  try {
    await $apiFetch('/api/admin/partner-rsvps/delete', { method: 'POST', body: { id } })
    confirming.value = null
    await refresh()
  } catch (err) {
    deleteError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Could not delete the RSVP.'
  } finally {
    deleting.value = false
  }
}

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/partner-rsvp`)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}

// Names and companies are typed by the public: a leading = + - @ would run as a
// formula when the file is opened in Excel, so such cells get a leading quote.
const safeCell = (value: unknown) => {
  const text = String(value)
  return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`
}

function downloadCsv() {
  const header = ['Name', 'Company', 'Plus one', 'Arriving', 'Leaving', 'Updated']
  const rows = rsvps.value.map((r) => [
    r.fullName,
    r.company,
    r.plusOne ? 'Yes' : 'No',
    hourLabel(r.arriveHour),
    hourLabel(r.leaveHour),
    r.updatedAt,
  ])
  const csv = [header, ...rows].map((row) => row.map(safeCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'partner-rsvps.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Promotions | Novel Solar Admin' })

const { addToast } = useToast()

interface StaffCodeRow {
  code: string
  bitrix_user_id: number
  first_name: string
  last_name: string
  job_title: string | null
  in_bitrix: boolean
  enabled: boolean
}

interface ChangeRow {
  created_at: string
  admin_email: string | null
  action: string
  details: Record<string, unknown>
}

interface ReportRow {
  staffBitrixId: number
  code: string | null
  name: string | null
  paidOnline: { orders: number; value: number }
  payAtStore: { orders: number; value: number }
  unpaid: { orders: number; value: number }
  discountGiven: number
}

const isLoading = ref(true)
const maxPercent = ref(20)
const saved = reactive({ discountEnabled: false, discountPercent: 1, minOrderAmount: 0, maxDiscountAmount: 0 })
const form = reactive({ discountEnabled: false, discountPercent: 1, minOrderAmount: 0, maxDiscountAmount: 0 })
const isSaving = ref(false)
const codes = ref<StaffCodeRow[]>([])
const changes = ref<ChangeRow[]>([])
const search = ref('')
const isRefreshing = ref(false)
const togglingCode = ref<string | null>(null)

const settingsChanged = computed(
  () =>
    form.discountEnabled !== saved.discountEnabled ||
    Number(form.discountPercent) !== saved.discountPercent ||
    Number(form.minOrderAmount) !== saved.minOrderAmount ||
    Number(form.maxDiscountAmount) !== saved.maxDiscountAmount,
)

/** "1% off orders of ₦50,000 or more, up to ₦10,000 each" — the rule as a customer would read it. */
function describeTerms(t: { discountEnabled: boolean; discountPercent: number; minOrderAmount: number; maxDiscountAmount: number }) {
  if (!t.discountEnabled) return 'no discount'
  const min = Number(t.minOrderAmount) > 0 ? ` of ${naira(t.minOrderAmount)} or more` : ''
  const cap = Number(t.maxDiscountAmount) > 0 ? `, up to ${naira(t.maxDiscountAmount)} each` : ''
  return `${t.discountPercent}% off orders${min}${cap}`
}

const filteredCodes = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return codes.value
  return codes.value.filter((c) =>
    `${c.code} ${c.first_name} ${c.last_name} ${c.job_title ?? ''}`.toLowerCase().includes(term),
  )
})

const naira = (n: number) => `₦${Math.round(Number(n) || 0).toLocaleString()}`

async function load() {
  isLoading.value = true
  try {
    const res = await useNuxtApp().$apiFetch<{
      settings: { discountEnabled: boolean; discountPercent: number; minOrderAmount: number; maxDiscountAmount: number }
      maxDiscountPercent: number
      codes: StaffCodeRow[]
      changes: ChangeRow[]
    }>('/api/admin/promotions')
    Object.assign(saved, res.settings)
    Object.assign(form, res.settings)
    maxPercent.value = res.maxDiscountPercent
    codes.value = res.codes
    changes.value = res.changes
  } catch {
    addToast('Load failed', 'Could not load the promotion settings.', 'error')
  } finally {
    isLoading.value = false
  }
}
onMounted(() => {
  load()
  loadReport()
})

async function saveSettings() {
  const percent = Number(form.discountPercent)
  const minOrderAmount = Number(form.minOrderAmount) || 0
  const maxDiscountAmount = Number(form.maxDiscountAmount) || 0
  if (!Number.isFinite(percent) || percent < 0 || percent > maxPercent.value) {
    addToast('Not saved', `The rate must be between 0 and ${maxPercent.value}%.`, 'error')
    return
  }
  if (![minOrderAmount, maxDiscountAmount].every((n) => Number.isInteger(n) && n >= 0)) {
    addToast('Not saved', 'The minimum order and maximum discount must be whole naira, 0 or more.', 'error')
    return
  }
  const summary = form.discountEnabled
    ? `Customers with a staff code will get ${describeTerms({ ...form, discountPercent: percent, minOrderAmount, maxDiscountAmount })} from now on.`
    : 'No customer will get a discount. Staff are still credited for their codes.'
  if (!confirm(`${summary}\n\nSave this change?`)) return

  isSaving.value = true
  try {
    await useNuxtApp().$apiFetch('/api/admin/promotions/settings', {
      method: 'POST',
      body: { discountEnabled: form.discountEnabled, discountPercent: percent, minOrderAmount, maxDiscountAmount },
    })
    addToast('Saved', 'New checkouts use this within about a minute.', 'success')
    await load()
  } catch (err) {
    const e = err as { statusMessage?: string }
    addToast('Not saved', e.statusMessage || 'The settings could not be saved.', 'error')
  } finally {
    isSaving.value = false
  }
}

async function toggleCode(row: StaffCodeRow) {
  const enabling = !row.enabled
  if (!enabling && !confirm(`Switch off ${row.code} (${row.first_name} ${row.last_name})? It will stop working at checkout.`)) {
    return
  }
  togglingCode.value = row.code
  try {
    await useNuxtApp().$apiFetch('/api/admin/promotions/code', { method: 'POST', body: { code: row.code, enabled: enabling } })
    row.enabled = enabling
    addToast('Saved', `${row.code} is now ${enabling ? 'on' : 'off'}.`, 'success')
    await load()
  } catch {
    addToast('Not saved', 'The code could not be updated.', 'error')
  } finally {
    togglingCode.value = null
  }
}

async function refreshCodes() {
  isRefreshing.value = true
  try {
    const res = await useNuxtApp().$apiFetch<{ employees: number; created: number; deactivated: number }>(
      '/api/admin/promotions/refresh',
      { method: 'POST' },
    )
    addToast(
      'Codes refreshed',
      `${res.employees} staff in Bitrix. ${res.created} new code(s), ${res.deactivated} switched off for leavers.`,
      'success',
    )
    await load()
  } catch (err) {
    const e = err as { statusMessage?: string }
    addToast('Refresh failed', e.statusMessage || 'Could not read the staff list from Bitrix.', 'error')
  } finally {
    isRefreshing.value = false
  }
}

function referralLink(code: string) {
  return `${window.location.origin}/?ref=${code}`
}

async function copyLink(code: string) {
  try {
    await navigator.clipboard.writeText(referralLink(code))
    addToast('Copied', referralLink(code), 'success')
  } catch {
    addToast('Copy failed', referralLink(code), 'error')
  }
}

// Sales report, this month by default.
const today = new Date()
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const reportFrom = ref(isoDay(new Date(today.getFullYear(), today.getMonth(), 1)))
const reportTo = ref(isoDay(today))
const report = ref<ReportRow[]>([])
const isReportLoading = ref(false)

const reportTotals = computed(() =>
  report.value.reduce(
    (t, r) => ({
      paidOnline: t.paidOnline + r.paidOnline.value,
      payAtStore: t.payAtStore + r.payAtStore.value,
      discount: t.discount + r.discountGiven,
    }),
    { paidOnline: 0, payAtStore: 0, discount: 0 },
  ),
)

async function loadReport() {
  isReportLoading.value = true
  try {
    const res = await useNuxtApp().$apiFetch<{ rows: ReportRow[] }>('/api/admin/promotions/report', {
      query: { from: reportFrom.value, to: reportTo.value },
    })
    report.value = res.rows
  } catch (err) {
    const e = err as { statusMessage?: string }
    addToast('Report failed', e.statusMessage || 'Could not build the report.', 'error')
  } finally {
    isReportLoading.value = false
  }
}

function exportCsv() {
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = [
    'Staff',
    'Code',
    'Paid online (orders)',
    'Paid online (NGN)',
    'Pay at store (orders)',
    'Pay at store (NGN)',
    'Unpaid online (orders)',
    'Discount given (NGN)',
  ]
  const lines = report.value.map((r) =>
    [
      r.name ?? `Bitrix user ${r.staffBitrixId}`,
      r.code,
      r.paidOnline.orders,
      Math.round(r.paidOnline.value),
      r.payAtStore.orders,
      Math.round(r.payAtStore.value),
      r.unpaid.orders,
      Math.round(r.discountGiven),
    ]
      .map(cell)
      .join(','),
  )
  const blob = new Blob([[header.map(cell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `staff-code-sales-${reportFrom.value}-to-${reportTo.value}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

function describeChange(change: ChangeRow): string {
  const d = change.details as {
    to?: { discountEnabled?: boolean; discountPercent?: number; minOrderAmount?: number; maxDiscountAmount?: number }
    code?: string
    staff?: string
    created?: number
    deactivated?: number
  }
  switch (change.action) {
    case 'settings': {
      const to = d.to ?? {}
      return to.discountEnabled
        ? `Discount on: ${describeTerms({ discountEnabled: true, discountPercent: to.discountPercent ?? 0, minOrderAmount: to.minOrderAmount ?? 0, maxDiscountAmount: to.maxDiscountAmount ?? 0 })}`
        : 'Discount switched off'
    }
    case 'code_enabled':
      return `Switched on ${d.code} (${d.staff})`
    case 'code_disabled':
      return `Switched off ${d.code} (${d.staff})`
    case 'codes_refreshed':
      return `Refreshed from Bitrix: ${d.created} new, ${d.deactivated} leavers`
    default:
      return change.action
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10">
    <header class="mb-8">
      <NuxtLink to="/admin" class="text-xs font-bold text-slate-500">&larr; Control Center</NuxtLink>
      <h1 class="mt-2 text-2xl font-black uppercase tracking-tight text-[#002888]">Promotions</h1>
      <p class="mt-2 max-w-3xl text-sm text-slate-600">
        Every member of staff has a code. A customer who uses one at checkout, or arrives through a staff link, is
        credited to that person. Retail customers also get the discount below. Dealers are credited but never discounted.
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Loading…</p>

    <template v-else>
      <!-- Discount settings -->
      <section class="mb-10 rounded-2xl border border-slate-200 p-6">
        <h2 class="mb-4 text-lg font-bold text-slate-900">Discount</h2>
        <div class="flex flex-wrap items-end gap-6">
          <label class="flex items-center gap-3 text-sm font-bold text-slate-700">
            <input v-model="form.discountEnabled" type="checkbox" class="h-5 w-5">
            Give customers a discount with staff codes
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Rate (%)</span>
            <input
              v-model.number="form.discountPercent"
              type="number"
              min="0"
              :max="maxPercent"
              step="0.5"
              class="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Minimum order (₦)</span>
            <input
              v-model.number="form.minOrderAmount"
              type="number"
              min="0"
              step="1000"
              class="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-bold uppercase text-slate-500">Maximum discount (₦)</span>
            <input
              v-model.number="form.maxDiscountAmount"
              type="number"
              min="0"
              step="1000"
              class="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
          </label>
          <button
            type="button"
            class="rounded-xl bg-[#002888] px-5 py-2 text-xs font-bold uppercase text-white disabled:opacity-40"
            :disabled="isSaving || !settingsChanged"
            @click="saveSettings"
          >
            {{ isSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
        <p class="mt-4 text-xs text-slate-500">
          Currently:
          <strong :class="saved.discountEnabled ? 'text-emerald-700' : 'text-slate-700'">{{ describeTerms(saved) }}</strong>
          for retail customers. Leave the minimum or maximum at 0 for no limit. Staff are credited either way, including
          on orders below the minimum. Changes reach new checkouts within about a minute; orders already placed keep the
          terms they were given. Rate at most {{ maxPercent }}%.
        </p>
      </section>

      <!-- Sales report -->
      <section class="mb-10 rounded-2xl border border-slate-200 p-6">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
          <h2 class="text-lg font-bold text-slate-900">Sales by staff code</h2>
          <div class="flex flex-wrap items-end gap-3">
            <label class="block">
              <span class="mb-1 block text-xs font-bold uppercase text-slate-500">From</span>
              <input v-model="reportFrom" type="date" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold uppercase text-slate-500">To</span>
              <input v-model="reportTo" type="date" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            </label>
            <button
              type="button"
              class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-40"
              :disabled="isReportLoading"
              @click="loadReport"
            >
              {{ isReportLoading ? 'Loading…' : 'Show' }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold uppercase text-slate-700 disabled:opacity-40"
              :disabled="!report.length"
              @click="exportCsv"
            >
              Export CSV
            </button>
          </div>
        </div>

        <p v-if="!report.length && !isReportLoading" class="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
          No orders used a staff code in this period.
        </p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th class="py-2 pr-4">Staff</th>
                <th class="py-2 pr-4">Code</th>
                <th class="py-2 pr-4 text-right">Paid online</th>
                <th class="py-2 pr-4 text-right">Pay at store</th>
                <th class="py-2 pr-4 text-right">Discount given</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in report" :key="r.staffBitrixId" class="border-b border-slate-100">
                <td class="py-2 pr-4 font-bold text-slate-900">{{ r.name ?? `Bitrix user ${r.staffBitrixId}` }}</td>
                <td class="py-2 pr-4 font-mono text-xs">{{ r.code }}</td>
                <td class="py-2 pr-4 text-right">
                  {{ naira(r.paidOnline.value) }} <span class="text-xs text-slate-400">({{ r.paidOnline.orders }})</span>
                </td>
                <td class="py-2 pr-4 text-right">
                  {{ naira(r.payAtStore.value) }} <span class="text-xs text-slate-400">({{ r.payAtStore.orders }})</span>
                </td>
                <td class="py-2 pr-4 text-right">{{ naira(r.discountGiven) }}</td>
              </tr>
              <tr class="font-bold">
                <td class="py-2 pr-4" colspan="2">Total</td>
                <td class="py-2 pr-4 text-right">{{ naira(reportTotals.paidOnline) }}</td>
                <td class="py-2 pr-4 text-right">{{ naira(reportTotals.payAtStore) }}</td>
                <td class="py-2 pr-4 text-right">{{ naira(reportTotals.discount) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="mt-3 text-xs text-slate-500">
            Paid online counts only orders Paystack confirmed. Pay at store orders are settled at the branch, so check
            those in Bitrix by filtering deals on "Referred by (staff code)". Card payments that were started but never
            completed are not counted.
          </p>
        </div>
      </section>

      <!-- Staff codes -->
      <section class="mb-10 rounded-2xl border border-slate-200 p-6">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Staff codes</h2>
            <p class="text-xs text-slate-500">
              {{ codes.length }} codes. New staff get one overnight, or now with Refresh.
            </p>
          </div>
          <div class="flex gap-3">
            <input
              v-model="search"
              placeholder="Search name, code or role"
              class="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold uppercase text-slate-700 disabled:opacity-40"
              :disabled="isRefreshing"
              @click="refreshCodes"
            >
              {{ isRefreshing ? 'Refreshing…' : 'Refresh from Bitrix' }}
            </button>
          </div>
        </div>

        <p v-if="!codes.length" class="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
          No codes yet. Click "Refresh from Bitrix" to create them.
        </p>
        <div v-else class="max-h-[560px] overflow-y-auto">
          <div
            v-for="c in filteredCodes"
            :key="c.code"
            class="flex flex-wrap items-center gap-4 border-b border-slate-100 py-3"
          >
            <span class="w-24 font-mono text-sm font-bold text-[#002888]">{{ c.code }}</span>
            <div class="min-w-[12rem] flex-1">
              <p class="text-sm font-bold text-slate-900">{{ c.first_name }} {{ c.last_name }}</p>
              <p class="text-xs text-slate-500">{{ c.job_title || '—' }}</p>
            </div>
            <span
              class="rounded-full px-3 py-1 text-[11px] font-bold uppercase"
              :class="
                !c.in_bitrix
                  ? 'bg-slate-100 text-slate-500'
                  : c.enabled
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
              "
            >
              {{ !c.in_bitrix ? 'Left Bitrix' : c.enabled ? 'On' : 'Off' }}
            </span>
            <button type="button" class="text-xs font-bold text-slate-600" @click="copyLink(c.code)">Copy link</button>
            <button
              type="button"
              class="w-20 text-xs font-bold disabled:opacity-40"
              :class="c.enabled ? 'text-red-600' : 'text-[#002888]'"
              :disabled="togglingCode === c.code"
              @click="toggleCode(c)"
            >
              {{ c.enabled ? 'Switch off' : 'Switch on' }}
            </button>
          </div>
          <p v-if="!filteredCodes.length" class="py-6 text-center text-sm text-slate-500">No match.</p>
        </div>
      </section>

      <!-- History -->
      <section class="rounded-2xl border border-slate-200 p-6">
        <h2 class="mb-4 text-lg font-bold text-slate-900">Change history</h2>
        <p v-if="!changes.length" class="text-sm text-slate-500">Nothing changed yet.</p>
        <ul v-else class="space-y-2 text-sm">
          <li v-for="(ch, i) in changes" :key="i" class="flex flex-wrap gap-x-3 text-slate-700">
            <span class="text-xs text-slate-400">{{ new Date(ch.created_at).toLocaleString() }}</span>
            <span class="font-bold">{{ ch.admin_email || 'system' }}</span>
            <span>{{ describeChange(ch) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

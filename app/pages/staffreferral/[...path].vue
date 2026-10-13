<template>
  <div class="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50">
    <div class="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5 p-8 text-center">
      <div class="w-16 h-16 rounded-full bg-orange-50 text-3xl flex items-center justify-center mx-auto mb-5">☀️</div>
      <h1 class="text-2xl font-black text-[#0B1F6B] mb-2">Welcome to {{ site.name }}</h1>

      <p v-if="state === 'checking'" class="text-sm text-slate-500 mb-6">Checking your referral…</p>

      <template v-else-if="state === 'valid'">
        <p class="text-sm text-slate-500 leading-relaxed mb-6">
          A member of our team referred you. Your order will be credited to them{{ discountLine }}.
        </p>
        <div class="flex items-center gap-3 text-left bg-slate-100 border border-dashed border-slate-300 rounded-2xl p-4 mb-7">
          <div class="w-11 h-11 rounded-full bg-[#0B1F6B] text-white font-bold flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined">badge</span>
          </div>
          <div>
            <p class="text-sm font-bold text-slate-900">{{ site.name }} staff referral</p>
            <span class="inline-block mt-1 text-xs font-bold text-[#E0533C] bg-[#E0533C]/10 px-2 py-0.5 rounded-md"
              >CODE: {{ code }}</span
            >
          </div>
        </div>
      </template>

      <p v-else class="text-sm text-slate-500 leading-relaxed mb-6">
        {{
          code
            ? 'This referral code is not active. You can still shop as normal.'
            : 'This link has no referral code. You can still shop as normal.'
        }}
      </p>

      <div class="flex flex-col gap-3">
        <a
          v-if="state === 'valid'"
          :href="deepLink"
          class="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-[#0B1F6B] text-white font-bold shadow-lg shadow-blue-900/20 hover:bg-[#08164d] transition"
        >
          Open in the mobile app
          <span class="material-symbols-outlined text-lg">arrow_forward</span>
        </a>
        <NuxtLink
          to="/shop"
          class="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-slate-200 text-slate-800 font-bold hover:bg-slate-50 transition"
        >
          Continue on the website
        </NuxtLink>
        <a
          :href="playStoreUrl"
          target="_blank"
          rel="noopener"
          class="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-slate-500 hover:text-slate-800"
        >
          Get the app on Google Play
        </a>
      </div>

      <p class="text-xs text-slate-400 mt-6">
        No app? The website works the same way: your referral is remembered for 30 days on this device.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Landing page for a staff member's share link. Accepts every shape the app
 * team's first version did:
 *
 *   /staffreferral/DAFO12
 *   /staffreferral/code/DAFO12/Davies/Folorunso
 *   /staffreferral?staff_code=DAFO12   (also ?staffCode= and ?ref=)
 *
 * The code is checked with /api/promo-code before anything is shown, and the
 * names in the link are never displayed: anyone can type a link, so showing
 * them would let a made-up name appear as an official consultant. They are
 * only passed on to the app, whose deep link expects them.
 *
 * Valid codes are saved exactly as a ?ref= link would be (useStaffRef), so a
 * customer who buys on the website instead of the app still credits the staff
 * member. Opening the app is a button, not an automatic redirect: without the
 * app installed, a custom-scheme redirect fails with an error or nothing.
 */
useHead({ title: 'Staff referral', meta: [{ name: 'robots', content: 'noindex' }] })

const site = useSite()
const route = useRoute()
const config = useRuntimeConfig().public
const { save } = useStaffRef()

const segments = computed(() => {
  const raw = route.params.path
  // Already decoded by the router; kept as strings, never decoded again (a
  // stray % in a hand-typed link would throw).
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((s) => String(s))
})

function fromLink(): { code: string | null; firstName: string; lastName: string } {
  const parts = segments.value
  const marker = parts.findIndex((p) => ['code', 'staff'].includes(p.toLowerCase()))
  const at = marker >= 0 ? marker + 1 : 0
  const fromPath = parts[at]
  const query = route.query
  const fromQuery = [query.staff_code, query.staffCode, query.ref].find((v) => typeof v === 'string') as
    | string
    | undefined
  return {
    code: normaliseStaffCode(fromPath ?? fromQuery),
    firstName: parts[at + 1] ?? (typeof query.first_name === 'string' ? query.first_name : ''),
    lastName: parts[at + 2] ?? (typeof query.last_name === 'string' ? query.last_name : ''),
  }
}

const link = fromLink()
const code = link.code

const deepLink = computed(
  () =>
    `${config.appDeepLinkScheme}://code/${encodeURIComponent(code ?? '')}/${encodeURIComponent(link.firstName)}/${encodeURIComponent(link.lastName)}`,
)
const playStoreUrl = config.appPlayStoreUrl

interface CodeCheck {
  valid: boolean
  kind: 'staff' | 'promo' | null
  discountType: 'percent' | 'fixed' | null
  discountValue: number
  noDiscountReason: string | null
}

const { data: check, pending } = await useFetch<CodeCheck>('/api/promo-code', {
  query: { code: code ?? '' },
  immediate: Boolean(code),
  server: false,
})

const state = computed<'checking' | 'valid' | 'invalid'>(() => {
  if (!code) return 'invalid'
  if (pending.value) return 'checking'
  return check.value?.valid && check.value.kind === 'staff' ? 'valid' : 'invalid'
})

// Only claim a discount while one is actually switched on for this customer.
const discountLine = computed(() => {
  const c = check.value
  if (!c?.valid || c.noDiscountReason || !c.discountValue) return ''
  return c.discountType === 'percent'
    ? `, and you get ${c.discountValue}% off at checkout (terms apply)`
    : `, and you get ₦${Math.round(c.discountValue).toLocaleString('en-NG')} off at checkout (terms apply)`
})

watch(state, (now) => {
  if (now === 'valid' && code) save(code)
})
</script>

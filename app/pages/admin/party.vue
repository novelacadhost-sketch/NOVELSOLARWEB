<template>
  <PartyRsvpReport
    :rsvps="data?.rsvps ?? []"
    :partners="partnerData?.rsvps ?? []"
    :pending="pending || partnersPending"
    :error="error || partnersError ? 'Could not load RSVPs.' : null"
    :delete-rsvp="deleteRsvp"
    back-to="/admin"
    show-copy-link
    @refresh="refreshAll"
  />
</template>

<script setup lang="ts">
import type { PartyReportRow } from '#shared/party'
import type { PartnerReportRow } from '#shared/partnerParty'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Party RSVPs | Novel Solar Admin' })

const { $apiFetch } = useNuxtApp()

const { data, pending, error, refresh } = await useFetch<{ rsvps: PartyReportRow[] }>('/api/admin/party-rsvps', {
  headers: useRequestHeaders(['cookie']),
})

const {
  data: partnerData,
  pending: partnersPending,
  error: partnersError,
  refresh: refreshPartners,
} = await useFetch<{ rsvps: PartnerReportRow[] }>('/api/admin/partner-rsvps', {
  headers: useRequestHeaders(['cookie']),
})

const refreshAll = () => Promise.all([refresh(), refreshPartners()])

async function deleteRsvp(id: string) {
  await $apiFetch('/api/admin/party-rsvps/delete', { method: 'POST', body: { id } })
  await refresh()
}
</script>

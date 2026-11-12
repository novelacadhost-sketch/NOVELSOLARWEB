<template>
  <PartyRsvpReport
    :rsvps="data?.rsvps ?? []"
    :pending="pending"
    :error="error ? 'Could not load RSVPs.' : null"
    :delete-rsvp="deleteRsvp"
    back-to="/admin"
    show-copy-link
    @refresh="refresh()"
  />
</template>

<script setup lang="ts">
import type { PartyReportRow } from '#shared/party'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Party RSVPs | Novel Solar Admin' })

const { $apiFetch } = useNuxtApp()

const { data, pending, error, refresh } = await useFetch<{ rsvps: PartyReportRow[] }>('/api/admin/party-rsvps', {
  headers: useRequestHeaders(['cookie']),
})

async function deleteRsvp(staffCode: string) {
  await $apiFetch('/api/admin/party-rsvps/delete', { method: 'POST', body: { staffCode } })
  await refresh()
}
</script>

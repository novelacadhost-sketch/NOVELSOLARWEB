<template>
  <p class="text-xs text-slate-500 leading-relaxed" :class="dark ? 'text-white/70' : ''">
    {{ action }}, you agree to our
    <template v-if="withTerms">
      <NuxtLink to="/terms" class="font-bold underline" :class="linkClass">terms of sale</NuxtLink>
      and
    </template>
    <NuxtLink to="/privacy" class="font-bold underline" :class="linkClass">privacy policy</NuxtLink>.
  </p>
</template>

<script setup lang="ts">
// Shown next to every form that collects personal data, as the NDPA notice.
const props = withDefaults(defineProps<{ action?: string; withTerms?: boolean; dark?: boolean }>(), {
  action: 'By sending this form',
  withTerms: false,
  dark: false,
})
const linkClass = computed(() => (props.dark ? 'text-white' : 'text-[#002888]'))
</script>

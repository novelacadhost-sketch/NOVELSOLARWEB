<template>
  <HomesHome v-if="site.id === 'homes'" />
  <SolarHome v-else />
</template>

<script setup lang="ts">
const site = useSite()
</script>

<template>
  <ErrorBoundary>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ToastContainer />
  </ErrorBoundary>
</template>

<script setup lang="ts">
const siteUrl = useRuntimeConfig().public.baseUrl.replace(/\/$/, '')

useSeoMeta({
  titleTemplate: (titleChunk) => {
    return titleChunk
      ? `${titleChunk} - novelsolar`
      : 'Novel Solar: Leading Solar Energy Company in Nigeria - novelsolar'
  },
  ogType: 'website',
  description:
    "Sourcing the world's best solar components for residential and commercial projects. Instant quotes, high-efficiency panels, and same-day logistics in Nigeria.",
  ogDescription:
    "Sourcing the world's best solar components for residential and commercial projects. Instant quotes, high-efficiency panels, and same-day logistics in Nigeria.",
  ogImage: `${siteUrl}/images/fallback-post.png`, // Fallback social sharing image
  twitterCard: 'summary_large_image',
})
</script>

<style>
body {
  background-color: #f8f6f6;
}
</style>

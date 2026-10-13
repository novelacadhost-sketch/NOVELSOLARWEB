<template>
  <ErrorBoundary>
    <NuxtLayout :name="site.id === 'homes' ? 'homes' : undefined">
      <NuxtPage />
    </NuxtLayout>
    <ToastContainer />
  </ErrorBoundary>
</template>

<script setup lang="ts">
const site = useSite()
const siteUrl = site.id === 'homes' ? useRequestURL().origin : useRuntimeConfig().public.baseUrl.replace(/\/$/, '')

const description =
  site.id === 'homes'
    ? 'Home appliances, fans and voltage stabilizers from Novel Home Essentials, Oyo. Freezers, fridges, air conditioners, TVs and more, with pickup or delivery.'
    : "Sourcing the world's best solar components for residential and commercial projects. Instant quotes, high-efficiency panels, and same-day logistics in Nigeria."

// nuxt.config's app.head.title is Novel Solar's; replace it as the fallback
// chunk here, which any page's own title still overrides.
if (site.id === 'homes') useHead({ title: 'Home Appliances in Oyo' })

useSeoMeta({
  titleTemplate: (titleChunk) => {
    if (site.id === 'homes') {
      return titleChunk ? `${titleChunk} - Novel Home Essentials` : 'Novel Home Essentials'
    }
    return titleChunk
      ? `${titleChunk} - novelsolar`
      : 'Novel Solar: Leading Solar Energy Company in Nigeria - novelsolar'
  },
  ogType: 'website',
  ogSiteName: site.name,
  description,
  ogDescription: description,
  ogImage: `${siteUrl}/images/fallback-post.png`, // Fallback social sharing image
  twitterCard: 'summary_large_image',
})
</script>

<style>
body {
  background-color: #f8f6f6;
}
</style>

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
    : "Sourcing the world's best solar components for residential and commercial projects. Instant quotes, high-efficiency panels, and pickup or delivery from branches across Nigeria."

// nuxt.config's app.head.title is Novel Solar's; replace it as the fallback
// chunk here, which any page's own title still overrides.
if (site.id === 'homes') useHead({ title: 'Home Appliances in Oyo' })

// A title that already names the site is used as is: the homepage and several
// pages carry their own brand suffix, and the template used to add a second.
const namesSite = (title: string) =>
  site.id === 'homes' ? /novel home essentials/i.test(title) : /novel\s?solar/i.test(title)

useSeoMeta({
  titleTemplate: (titleChunk) => {
    if (!titleChunk) {
      return site.id === 'homes' ? 'Novel Home Essentials' : 'Novel Solar: Leading Solar Energy Company in Nigeria'
    }
    if (namesSite(titleChunk)) return titleChunk
    return `${titleChunk} | ${site.name}`
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

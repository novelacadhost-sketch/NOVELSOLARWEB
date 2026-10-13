<template>
  <div class="min-h-screen bg-gray-50">
    <div class="bg-[#002888] py-16 px-4 text-center">
      <h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-3">{{ title }}</h1>
      <p class="text-white/70 text-sm">Last updated {{ updated }}</p>
    </div>

    <div class="max-w-3xl mx-auto px-4 py-12">
      <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10">
        <p v-if="intro" class="text-slate-600 leading-relaxed mb-8">{{ intro }}</p>
        <section v-for="section in sections" :key="section.heading" class="mb-8 last:mb-0">
          <h2 class="text-lg font-black text-slate-900 mb-3">{{ section.heading }}</h2>
          <!-- Static text authored in the page files, not user content. -->
          <div class="legal-body text-slate-600 leading-relaxed space-y-3" v-html="section.html" />
        </section>
      </div>

      <nav class="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-bold">
        <NuxtLink
          v-for="link in LEGAL_LINKS"
          :key="link.to"
          :to="link.to"
          class="text-slate-500 hover:text-[#002888]"
          active-class="text-[#002888]"
          >{{ link.label }}</NuxtLink
        >
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LEGAL_LINKS } from '~/utils/legal'

export interface LegalSection {
  heading: string
  html: string
}

const props = defineProps<{
  title: string
  updated: string
  intro?: string
  sections: LegalSection[]
  description: string
}>()

useHead({
  title: props.title,
  meta: [{ name: 'description', content: props.description }],
})
</script>

<style scoped>
.legal-body :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
}
.legal-body :deep(li) {
  margin-top: 0.25rem;
}
.legal-body :deep(a) {
  color: #002888;
  font-weight: 700;
  text-decoration: underline;
}
</style>

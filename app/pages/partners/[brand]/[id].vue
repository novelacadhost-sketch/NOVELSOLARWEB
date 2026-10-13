<script setup lang="ts">
// Partner products are ordinary Bitrix products: the shop's product page has
// the photos, stock, dealer pricing and a working Add to Cart. This address
// used to render its own copy with boilerplate text and a dead button.
definePageMeta({
  redirect: (to) => {
    const id = String(to.params.id ?? '')
    return /^\d+$/.test(id) ? `/shop/${id}` : `/partners/${String(to.params.brand ?? '')}`
  },
})
</script>

<template>
  <div />
</template>

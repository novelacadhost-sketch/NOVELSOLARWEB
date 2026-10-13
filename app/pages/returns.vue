<template>
  <LegalDocument
    title="Returns & refunds"
    :updated="LEGAL_UPDATED"
    :sections="sections"
    description="When and how you can return a product, and how refunds are paid."
  />
</template>

<script setup lang="ts">
import { LEGAL_CONTACT as C, LEGAL_UPDATED } from '~/utils/legal'

const sections = [
  {
    heading: 'Faulty or wrong items',
    html: `<p>If a product arrives damaged, faulty, or is not what you ordered, tell us within 7 days of delivery or collection. We will repair, replace or refund it at no cost to you. Please keep the packaging and your receipt.</p>`,
  },
  {
    heading: 'Changing your mind',
    html: `<p>You may return a product you no longer want within 7 days of delivery or collection if it is unused, unopened and in its original packaging, with your receipt. Bring it to the branch where you collected it, or contact us to arrange the return of a delivered order. Return delivery costs are yours unless the item was faulty or wrong.</p>`,
  },
  {
    heading: 'Items that cannot be returned',
    html: `<ul>
      <li>Products that have been installed, connected or used, unless faulty.</li>
      <li>Cable and other items cut to a length you chose.</li>
      <li>Products ordered specially for you.</li>
    </ul>`,
  },
  {
    heading: 'Cancelling an order',
    html: `<p>You can cancel an order at no cost before it is collected or dispatched for delivery. Contact us as soon as possible with your order number.</p>`,
  },
  {
    heading: 'How refunds are paid',
    html: `<p>We refund to the method you paid with: card and bank transfer payments back through Paystack, and store payments at the branch or by bank transfer. We aim to process refunds within 7 working days of accepting a return. Your bank may take a few more days to show the money.</p>`,
  },
  {
    heading: 'How to start a return',
    html: `<p>Email <a href="mailto:${C.salesEmail}">${C.salesEmail}</a> or call ${C.phone} with your order number, the product and the reason. Your rights under Nigerian consumer law are not affected by this policy.</p>`,
  },
]
</script>

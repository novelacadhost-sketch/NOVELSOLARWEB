<template>
  <LegalDocument
    title="Delivery & pickup"
    :updated="LEGAL_UPDATED"
    :sections="sections"
    description="How pickup from our branches and delivery work, including delivery charges."
  />
</template>

<script setup lang="ts">
import { LEGAL_CONTACT as C, LEGAL_UPDATED } from '~/utils/legal'

const site = useSite()

const sections = [
  {
    heading: 'Pickup from a branch',
    html: `<p>Pickup is free. Choose the branch at checkout and we will contact you when your order is ready. Bring your order number and, if you have not paid online, payment. ${
      site.id === 'solar'
        ? 'See <a href="/branch-outlets">our branches</a> for addresses and opening hours.'
        : 'Our branch addresses are listed at the foot of every page.'
    }</p>`,
  },
  {
    heading: 'Delivery',
    html: `<p>Delivery orders are paid for online at checkout. The delivery charge is not included at checkout, because it depends on where you are and the size of the order. After you order, a member of our team will call you to confirm the charge and agree a delivery date before anything is dispatched. If you do not accept the charge, you can switch to pickup or cancel for a full refund.</p>`,
  },
  {
    heading: 'Delivery times',
    html: `<p>Most deliveries within the same state as the dispatching branch arrive within 1 to 3 working days of agreeing the delivery charge, and other states within 3 to 7 working days. We will give you a date for your order when we call.</p>`,
  },
  {
    heading: 'When it arrives',
    html: `<p>Please check the item before signing for it, and tell us within 7 days if anything is damaged or missing (see <a href="/returns">returns & refunds</a>). Large items are delivered to the ground floor or kerbside unless agreed otherwise.</p>`,
  },
  {
    heading: 'Questions',
    html: `<p>Contact <a href="mailto:${C.salesEmail}">${C.salesEmail}</a> or ${C.phone} with your order number.</p>`,
  },
]
</script>

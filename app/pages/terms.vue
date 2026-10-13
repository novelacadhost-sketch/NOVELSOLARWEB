<template>
  <LegalDocument
    title="Terms of sale"
    :updated="LEGAL_UPDATED"
    :intro="intro"
    :sections="sections"
    description="The terms that apply when you order from us: prices, payment, stock, promo codes, dealer pricing and liability."
  />
</template>

<script setup lang="ts">
import { LEGAL_CONTACT as C, LEGAL_UPDATED } from '~/utils/legal'

const brand = useSite().name

const intro = `These terms apply to every order you place on this website with ${brand}, a trading name of Novel Solar. By placing an order you agree to them. Please also read our returns, delivery and privacy policies, which form part of these terms.`

const sections = [
  {
    heading: 'Prices',
    html: `<p>Prices are in Nigerian naira (₦) and include any VAT that applies. Delivery is not included in the price shown at checkout: see our <a href="/delivery">delivery policy</a>. The price you pay is the price shown when you place your order. If we have made an obvious pricing error, we will contact you before accepting the order, and you may cancel it.</p>`,
  },
  {
    heading: 'Placing an order',
    html: `<p>Your order is an offer to buy. We accept it when we confirm it, either on screen after payment or when our team contacts you. We check stock before you pay; if an item becomes unavailable after you order, we will tell you and refund anything you have paid for it.</p>`,
  },
  {
    heading: 'Payment',
    html: `<ul>
      <li><b>Online</b>: by card or bank transfer through Paystack. Your order is confirmed once Paystack confirms the payment.</li>
      <li><b>At the store</b>: for pickup orders, you can pay when you collect from the branch you chose.</li>
    </ul>`,
  },
  {
    heading: 'Promo codes and staff referrals',
    html: `<p>A promo code gives the discount shown at checkout, under that code's terms (for example a minimum order value, an expiry date or a limit on uses). Only one code applies per order. Codes cannot be exchanged for cash, and we may withdraw a code at any time without affecting orders already placed with it.</p>`,
  },
  {
    heading: 'Dealer pricing',
    html: `<p>Dealer prices are available only to businesses we have approved as dealers, and only when signed in to their dealer account. We may change or withdraw dealer status in line with our dealer agreement.</p>`,
  },
  {
    heading: 'Product information',
    html: `<p>We try to describe products accurately. Pictures are for illustration and may differ slightly from the product supplied, for example in packaging. If you need a particular specification, please confirm it with our sales team before you order.</p>`,
  },
  {
    heading: 'Warranty',
    html: `<p>Products carry the warranty given by their manufacturer, which varies by product. Ask our sales team about the warranty for a specific product, and keep your receipt. Warranty does not cover damage from incorrect installation, misuse, or connecting equipment beyond its rated capacity.</p>`,
  },
  {
    heading: 'Our liability',
    html: `<p>Nothing in these terms limits your rights as a consumer under Nigerian law, including the Federal Competition and Consumer Protection Act 2018. Subject to that, our liability for any order is limited to the price you paid for it, and we are not liable for indirect losses such as lost profits.</p>`,
  },
  {
    heading: 'Governing law',
    html: `<p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>`,
  },
  {
    heading: 'Contact',
    html: `<p>Questions about an order: <a href="mailto:${C.salesEmail}">${C.salesEmail}</a> or ${C.phone}.</p>`,
  },
]
</script>

<template>
  <LegalDocument
    title="Privacy policy"
    :updated="LEGAL_UPDATED"
    :intro="intro"
    :sections="sections"
    description="How we collect, use and protect your personal data, and your rights under the Nigeria Data Protection Act 2023."
  />
</template>

<script setup lang="ts">
import { LEGAL_CONTACT as C, LEGAL_UPDATED } from '~/utils/legal'

const site = useSite()
const brand = site.name

const intro = `This policy explains what personal data ${brand} collects when you use this website, why we collect it, who we share it with and the rights you have over it. We process personal data in line with the Nigeria Data Protection Act 2023 (NDPA).`

const sections = [
  {
    heading: 'Who we are',
    html: `<p>${brand} is a trading name of Novel Solar. We are the data controller for the personal data described in this policy. You can reach us at <a href="mailto:${C.email}">${C.email}</a>, on ${C.phone}, or at ${C.address}.</p>`,
  },
  {
    heading: 'What we collect',
    html: `<ul>
      <li><b>Contact details</b> you give us: name, email address, phone number and delivery address.</li>
      <li><b>Order details</b>: the products you buy, prices, the branch you choose, how you pay and any promo code you use.</li>
      <li><b>Messages</b> you send through our contact, quote, booking, dealer and partner forms, including any documents you upload.</li>
      <li><b>Account details</b> if you sign in: your email address and the name and phone number on your profile.</li>
      <li><b>Payment confirmation</b> from Paystack, such as the transaction reference and amount. We never receive or store your card details.</li>
      <li><b>Technical data</b>: the pages you request and your IP address, held briefly in server logs for security and to fix errors.</li>
    </ul>`,
  },
  {
    heading: 'Why we use it',
    html: `<ul>
      <li>To process, deliver and support your orders, and to contact you about them (the lawful basis is the contract with you).</li>
      <li>To answer your enquiries, quotes and bookings, and to assess dealer and partner applications (steps you ask us to take before a contract).</li>
      <li>To prevent fraud and keep the website secure (our legitimate interests).</li>
      <li>To meet tax, accounting and other legal obligations.</li>
      <li>To send you news and offers, only if you have subscribed. You can unsubscribe at any time.</li>
    </ul>`,
  },
  {
    heading: 'Who we share it with',
    html: `<p>We do not sell your personal data. We share it only with service providers who process it for us, under contract:</p>
    <ul>
      <li><b>Paystack</b>, to take online payments.</li>
      <li><b>Bitrix24</b>, our customer relationship system, where our sales and branch teams manage orders and enquiries.</li>
      <li><b>Supabase</b>, which stores accounts and order records.</li>
      <li><b>Brevo</b>, which sends our emails.</li>
      <li><b>Vercel</b>, which hosts this website, and <b>Cloudinary</b>, which serves product images.</li>
      <li>Delivery partners, when we arrange a delivery for you.</li>
    </ul>
    <p>Some of these providers store data outside Nigeria. Where they do, we rely on the safeguards the NDPA requires for cross-border transfers. We may also disclose data where the law requires it.</p>`,
  },
  {
    heading: 'Cookies and storage in your browser',
    html: `<p>We use only what the website needs to work:</p>
    <ul>
      <li>A sign-in cookie, if you sign in, to keep you signed in.</li>
      <li>A security cookie that protects our forms against forged requests.</li>
      <li>Your shopping cart, saved in your browser so it survives a page reload.</li>
      <li>A staff referral code, if you arrive through a staff member's link, remembered for 30 days so they are credited for your order.</li>
    </ul>
    <p>We do not use advertising or tracking cookies.</p>`,
  },
  {
    heading: 'How long we keep it',
    html: `<p>We keep order records for six years, to meet tax and accounting requirements. We keep enquiries and quote requests for up to two years after our last contact with you, and account details until you ask us to close your account. Newsletter subscriptions are kept until you unsubscribe.</p>`,
  },
  {
    heading: 'Your rights',
    html: `<p>Under the NDPA you have the right to:</p>
    <ul>
      <li>be informed about, and get a copy of, the personal data we hold about you;</li>
      <li>have inaccurate data corrected;</li>
      <li>have your data deleted, where we no longer need it or have no legal reason to keep it;</li>
      <li>object to, or ask us to restrict, how we use it;</li>
      <li>receive your data in a portable format;</li>
      <li>withdraw your consent at any time, where we rely on it.</li>
    </ul>
    <p>To use any of these rights, email <a href="mailto:${C.email}">${C.email}</a>. We will respond within 30 days. If you are not satisfied with our response, you can complain to the Nigeria Data Protection Commission.</p>`,
  },
  {
    heading: 'Security',
    html: `<p>Data travels to and from this website over an encrypted connection, payments are handled by Paystack, and access to customer records is limited to staff who need it for their work.</p>`,
  },
  {
    heading: 'Changes to this policy',
    html: `<p>We will post any changes on this page and update the date above.</p>`,
  },
]
</script>

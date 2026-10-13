<template>
  <div class="min-h-screen bg-gray-50">
    <div class="bg-[#002888] py-20 px-4 text-center">
      <h1 class="text-4xl sm:text-5xl font-extrabold text-white mb-4">Frequently Asked Questions</h1>
      <p class="text-white/80 text-lg max-w-2xl mx-auto">How ordering, payment, pickup and delivery work.</p>
    </div>

    <div class="max-w-3xl mx-auto px-4 py-14 space-y-10">
      <section v-for="group in groups" :key="group.title">
        <h2 class="text-xl font-black text-slate-900 mb-4">{{ group.title }}</h2>
        <div class="space-y-3">
          <details
            v-for="item in group.items"
            :key="item.q"
            class="group bg-white rounded-2xl border border-slate-200 open:shadow-sm"
          >
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold text-slate-800"
            >
              {{ item.q }}
              <span class="material-symbols-outlined text-slate-400 transition-transform group-open:rotate-180"
                >expand_more</span
              >
            </summary>
            <!-- eslint-disable-next-line vue/no-v-html -- static, authored in this file -->
            <div class="px-5 pb-5 text-slate-600 leading-relaxed" v-html="item.a" />
          </details>
        </div>
      </section>

      <div class="bg-white rounded-3xl border border-slate-200 p-8 text-center">
        <h2 class="text-lg font-black text-slate-900 mb-2">Still have a question?</h2>
        <p class="text-slate-500 mb-6">Our team is available Monday to Saturday.</p>
        <NuxtLink
          to="/contact"
          class="inline-block bg-[#002888] text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-900 transition-all"
        >
          Contact us
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Frequently Asked Questions',
  meta: [
    {
      name: 'description',
      content: 'How to order, pay, pick up or get delivery from Novel Solar, plus dealer pricing, promo codes and installation.',
    },
  ],
})

const groups = [
  {
    title: 'Ordering and payment',
    items: [
      {
        q: 'How can I pay for my order?',
        a: 'You can pay online by card or bank transfer through Paystack. If you choose to pick up from a branch, you can also pay when you collect, at the store.',
      },
      {
        q: 'Is it safe to pay online?',
        a: 'Online payments are handled by Paystack, a licensed Nigerian payment provider. Your card details go to Paystack directly and are never stored by us.',
      },
      {
        q: 'Do I need an account to order?',
        a: 'No. You can check out as a guest. If you later create an account with the same email address, your earlier orders will appear in your order history.',
      },
      {
        q: 'How do I use a promo code?',
        a: 'Enter it in the promo code box at checkout. The discount is shown before you pay. One code can be used per order, and each code has its own terms, such as a minimum order or an expiry date.',
      },
      {
        q: 'What happens if an item is out of stock?',
        a: 'Checkout checks our stock before you pay. If we do not have enough of an item, we will tell you before any payment and you can ask us to call you back about supply.',
      },
    ],
  },
  {
    title: 'Pickup and delivery',
    items: [
      {
        q: 'Can I pick up my order from a branch?',
        a: 'Yes. Choose pickup at checkout and select the branch closest to you. Pickup is free. See <a href="/branch-outlets" class="font-bold text-[#002888] underline">our branches</a> for addresses and directions.',
      },
      {
        q: 'Do you deliver?',
        a: 'Yes. Delivery orders are paid for online at checkout. The delivery charge is not included at checkout, because it depends on your location and the size of the order: a member of our team will call you to confirm the cost and arrange delivery.',
      },
      {
        q: 'How do I know my order was received?',
        a: 'You will see a confirmation page with your order number, and we send a confirmation email to the address you gave. If you have an account, the order also appears under Order history.',
      },
    ],
  },
  {
    title: 'Dealers, installation and support',
    items: [
      {
        q: 'Do you offer dealer or wholesale prices?',
        a: 'Yes. Businesses can <a href="/partners/become-a-dealer" class="font-bold text-[#002888] underline">apply to become a dealer</a>. Once approved, you sign in and see dealer prices across the shop and at checkout.',
      },
      {
        q: 'Can you install the system for me?',
        a: 'Yes. You can <a href="/quote" class="font-bold text-[#002888] underline">request a quote</a> for a full system, or book an installation or maintenance visit from our services pages.',
      },
      {
        q: 'Not sure what size of system you need?',
        a: 'Try our <a href="/calculator" class="font-bold text-[#002888] underline">load calculator</a>, or request a quote and our engineers will recommend a system for your home or business.',
      },
      {
        q: 'What warranty do products come with?',
        a: 'Warranty terms depend on the product and its manufacturer. Ask our sales team for the warranty on a specific product before you buy, and keep your receipt.',
      },
      {
        q: 'Can I return a product?',
        a: 'See our <a href="/returns" class="font-bold text-[#002888] underline">returns and refunds policy</a> for when and how a product can be returned.',
      },
    ],
  },
]
</script>

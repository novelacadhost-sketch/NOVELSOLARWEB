<script setup lang="ts">
const { cart, isCartOpen, toggleCart, removeFromCart, updateQuantity, cartTotalAmount } = useCart()
</script>

<template>
  <teleport to="body">
    <!-- Overlay Backdrop -->
    <transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isCartOpen" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]" @click="toggleCart" />
    </transition>

    <!-- Drawer Panel -->
    <div
      :class="isCartOpen ? 'translate-x-0' : 'translate-x-full'"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-heading"
      class="fixed inset-y-0 right-0 z-[101] w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-500 ease-in-out"
    >
      <!-- Header -->
      <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-[#002888]">shopping_bag</span>
          <h2 id="cart-heading" class="text-xl font-bold text-slate-900">Your Cart</h2>
          <span v-if="cart.length > 0" class="bg-blue-50 text-[#002888] text-xs font-bold px-2 py-0.5 rounded-full">
            {{ cart.length }}
          </span>
        </div>
        <button
          aria-label="Close Cart"
          class="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors focus-visible:ring-2 focus-visible:ring-[#002888]"
          @click="toggleCart"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Cart Items List -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
        <div
          v-if="cart.length === 0"
          class="h-full flex flex-col items-center justify-center text-center text-gray-500 py-12"
        >
          <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <span class="material-symbols-outlined text-4xl text-gray-300">shopping_cart</span>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-1">Your cart is empty</h3>
          <p class="text-sm text-gray-500 max-w-[200px] mx-auto mb-8">
            Looks like you haven't added any solar equipment yet.
          </p>
          <button class="text-[#002888] font-bold text-sm hover:underline" @click="toggleCart">
            Continue Shopping &rarr;
          </button>
        </div>

        <div
          v-for="item in cart"
          :key="item.id"
          class="group flex gap-4 p-4 border border-transparent hover:border-gray-100 hover:bg-gray-50/50 rounded-2xl transition-all"
        >
          <!-- Item Preview -->
          <div class="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
            <FadeImage
              v-if="item.image"
              use-nuxt-img
              :src="item.image"
              :alt="item.name"
              class="w-full h-full"
              image-class="object-cover"
            />
            <span v-else class="material-symbols-outlined text-gray-300 text-3xl">image</span>
          </div>

          <!-- Item Details -->
          <div class="flex-1 flex flex-col justify-between">
            <div class="flex justify-between items-start gap-2">
              <h3 class="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">{{ item.name }}</h3>
              <button
                :aria-label="'Remove ' + item.name + ' from cart'"
                class="text-gray-400 hover:text-red-500 transition-colors p-1 focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                @click="removeFromCart(item.id)"
              >
                <span class="material-symbols-outlined text-xl">delete</span>
              </button>
            </div>

            <div class="flex items-center justify-between mt-3">
              <div class="text-[#002888] font-black text-sm">₦{{ Number(item.price).toLocaleString() }}</div>

              <!-- Quantity Controls -->
              <div class="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
                <button
                  aria-label="Decrease quantity"
                  class="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-l-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#002888]"
                  @click="updateQuantity(item.id, -1)"
                >
                  <span class="material-symbols-outlined text-lg">remove</span>
                </button>
                <span class="w-8 text-center text-xs font-bold text-slate-900" aria-label="Current quantity">{{
                  item.quantity
                }}</span>
                <button
                  aria-label="Increase quantity"
                  class="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-r-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#002888]"
                  @click="updateQuantity(item.id, 1)"
                >
                  <span class="material-symbols-outlined text-lg">add</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer / Checkout -->
      <div
        v-if="cart.length > 0"
        class="p-6 border-t border-gray-100 bg-white shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]"
      >
        <div class="flex justify-between items-center mb-6">
          <div class="flex flex-col">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Estimated Total</span>
            <span class="text-2xl font-black text-slate-900">₦{{ Number(cartTotalAmount).toLocaleString() }}</span>
          </div>
        </div>

        <NuxtLink
          to="/checkout"
          class="w-full flex items-center justify-center gap-3 bg-[#002888] text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-900 transition-all shadow-lg active:scale-[0.98] outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          @click="toggleCart"
        >
          Checkout Now
          <span class="material-symbols-outlined">arrow_forward</span>
        </NuxtLink>
        <p class="text-center text-[11px] text-gray-500 mt-4">Secure checkout powered by NovelSolar</p>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}

/* Material Symbols sizing */
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  vertical-align: middle;
}
</style>

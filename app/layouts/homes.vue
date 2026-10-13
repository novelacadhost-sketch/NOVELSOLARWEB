<template>
  <div class="min-h-screen flex flex-col bg-[#faf7f2] text-slate-800">
    <header class="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 md:h-20 flex items-center gap-4 md:gap-8">
        <NuxtLink to="/" class="flex items-center gap-2 shrink-0" aria-label="Novel Home Essentials home">
          <img v-if="site.logoPath" :src="site.logoPath" :alt="site.name" class="h-10 md:h-12 w-auto" width="505" height="160" />
          <template v-else>
            <span class="w-9 h-9 rounded-xl bg-[#1d4f91] text-white flex items-center justify-center">
              <span class="material-symbols-outlined text-[22px]">home</span>
            </span>
            <span class="leading-tight">
              <span class="block text-base md:text-lg font-black text-[#1d4f91] tracking-tight">Novel Home</span>
              <span class="block text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600"
                >Essentials</span
              >
            </span>
          </template>
        </NuxtLink>

        <nav class="hidden lg:flex items-center gap-1" aria-label="Main">
          <NuxtLink to="/shop" class="nav-link" active-class="nav-link--active">Shop all</NuxtLink>
          <NuxtLink
            v-for="group in HOMES_CATEGORY_GROUPS"
            :key="group.id"
            :to="`/category/${group.id}`"
            class="nav-link"
            active-class="nav-link--active"
            >{{ group.name }}</NuxtLink
          >
        </nav>

        <form class="flex-1 max-w-sm ml-auto hidden md:block" role="search" @submit.prevent="handleSearch">
          <label for="homes-search" class="sr-only">Search appliances</label>
          <div class="relative">
            <span
              class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-[20px] pointer-events-none"
              >search</span
            >
            <input
              id="homes-search"
              v-model="searchQuery"
              type="search"
              placeholder="Search freezers, fans, TVs..."
              class="w-full bg-stone-100 border border-transparent rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:bg-white focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20"
            />
          </div>
        </form>

        <div class="flex items-center gap-3 ml-auto md:ml-0">
          <button
            type="button"
            aria-label="Open cart"
            class="relative w-10 h-10 rounded-full flex items-center justify-center text-stone-600 hover:bg-stone-100"
            @click="toggleCart"
          >
            <span class="material-symbols-outlined">shopping_bag</span>
            <span
              v-if="cartItemCount > 0"
              class="absolute -top-0.5 -right-0.5 bg-[#a6192e] text-white text-[10px] font-bold h-5 min-w-5 px-1 flex items-center justify-center rounded-full"
            >
              {{ cartItemCount }}
            </span>
          </button>
          <NuxtLink
            :to="user ? '/account' : '/login'"
            class="w-10 h-10 rounded-full flex items-center justify-center border"
            :class="
              user
                ? 'bg-[#1d4f91]/10 text-[#1d4f91] border-[#1d4f91]/20'
                : 'text-stone-500 border-stone-200 hover:bg-stone-100'
            "
            :title="user ? 'My account' : 'Sign in'"
          >
            <span v-if="user" class="text-[11px] font-black uppercase">{{ userInitials }}</span>
            <span v-else class="material-symbols-outlined text-[20px]">person</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Phones: search and categories under the bar, since there is no menu drawer. -->
      <div class="md:hidden px-4 pb-3 space-y-3">
        <form role="search" @submit.prevent="handleSearch">
          <label for="homes-search-mobile" class="sr-only">Search appliances</label>
          <input
            id="homes-search-mobile"
            v-model="searchQuery"
            type="search"
            placeholder="Search freezers, fans, TVs..."
            class="w-full bg-stone-100 rounded-full py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
          />
        </form>
        <nav class="flex gap-2 overflow-x-auto -mx-4 px-4 no-scrollbar" aria-label="Categories">
          <NuxtLink
            v-for="group in HOMES_CATEGORY_GROUPS"
            :key="group.id"
            :to="`/category/${group.id}`"
            class="shrink-0 px-3.5 py-1.5 rounded-full bg-stone-100 text-xs font-semibold text-stone-700"
            active-class="!bg-[#1d4f91] !text-white"
            >{{ group.name }}</NuxtLink
          >
        </nav>
      </div>
    </header>

    <main class="flex-1 pb-20 md:pb-0">
      <slot />
    </main>

    <footer class="bg-[#13294b] text-stone-300 mt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p class="text-white text-lg font-black">{{ site.name }}</p>
          <p class="mt-3 text-sm leading-relaxed text-stone-400">
            Home appliances, fans and voltage stabilizers, from the Novel group. Store pickup or delivery.
          </p>
        </div>
        <div>
          <h2 class="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4">Shop</h2>
          <ul class="space-y-2 text-sm">
            <li v-for="group in HOMES_CATEGORY_GROUPS" :key="group.id">
              <NuxtLink :to="`/category/${group.id}`" class="hover:text-white">{{ group.name }}</NuxtLink>
            </li>
            <li><NuxtLink to="/shop" class="hover:text-white">All products</NuxtLink></li>
          </ul>
        </div>
        <div class="sm:col-span-2">
          <h2 class="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4">Visit us</h2>
          <ul class="grid gap-4 sm:grid-cols-2 text-sm">
            <li v-for="branch in homeEssentialsBranches" :key="branch.bitrixId">
              <p class="font-semibold text-white">{{ branch.name }}</p>
              <p class="text-stone-400">{{ branch.address }}</p>
              <a v-if="branch.phone" :href="`tel:${branch.phone}`" class="text-stone-300 hover:text-white">{{
                branch.phone
              }}</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <div
          class="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-xs text-stone-500">&copy; {{ year }} {{ site.name }}. Part of Novel Solar.</p>
          <nav class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <NuxtLink
              v-for="link in LEGAL_LINKS"
              :key="link.to"
              :to="link.to"
              class="text-stone-400 hover:text-white"
              >{{ link.label }}</NuxtLink
            >
          </nav>
        </div>
      </div>
    </footer>

    <!-- Phones: the cart and account are a thumb away. -->
    <nav
      class="md:hidden fixed bottom-0 inset-x-0 z-[60] bg-white/95 backdrop-blur border-t border-stone-200 flex justify-around pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label="Quick links"
    >
      <NuxtLink to="/" class="tab" exact-active-class="tab--active">
        <span class="material-symbols-outlined">home</span><span>Home</span>
      </NuxtLink>
      <NuxtLink to="/shop" class="tab" active-class="tab--active">
        <span class="material-symbols-outlined">grid_view</span><span>Shop</span>
      </NuxtLink>
      <button type="button" class="tab" @click="toggleCart">
        <span class="material-symbols-outlined">shopping_bag</span><span>Cart ({{ cartItemCount }})</span>
      </button>
      <NuxtLink :to="user ? '/account' : '/login'" class="tab" active-class="tab--active">
        <span class="material-symbols-outlined">person</span><span>{{ user ? 'Account' : 'Sign in' }}</span>
      </NuxtLink>
    </nav>

    <LazyCartDrawer />
    <WhatsAppFloating />
  </div>
</template>

<script setup lang="ts">
import { HOMES_CATEGORY_GROUPS } from '~/utils/productCategories'
import { LEGAL_LINKS } from '~/utils/legal'
import { homeEssentialsBranches } from '~/utils/locations'

const site = useSite()
const year = new Date().getFullYear()
const { cartItemCount, toggleCart } = useCart()

const searchQuery = ref('')
const handleSearch = () => {
  const q = searchQuery.value.trim()
  if (!q) return
  navigateTo({ path: '/shop', query: { q } })
  searchQuery.value = ''
}

// Cookies are not forwarded to internal API routes during SSR without this.
const { data: user } = await useFetch('/api/user/profile', {
  headers: useRequestHeaders(['cookie']),
})

const userInitials = computed(() => {
  if (!user.value) return ''
  const first = user.value.firstName ? user.value.firstName.charAt(0).toUpperCase() : ''
  const last = user.value.lastName ? user.value.lastName.charAt(0).toUpperCase() : ''
  return first + last || 'U'
})
</script>

<style scoped>
.nav-link {
  padding: 0.5rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #44403c;
}
.nav-link:hover {
  background: #f5f5f4;
}
.nav-link--active {
  background: #1d4f91;
  color: #fff;
}
.nav-link--active:hover {
  background: #1d4f91;
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0.25rem 0.5rem;
  font-size: 10px;
  font-weight: 600;
  color: #78716c;
}
.tab--active {
  color: #1d4f91;
}
.no-scrollbar {
  scrollbar-width: none;
}
</style>

<template>
  <div class="min-h-screen flex flex-col bg-background font-sans text-gray-800">
    <!-- Navbar -->
    <header
      class="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200 h-20 sticky top-0 z-50"
    >
      <!-- Left Section: Logo & Links -->
      <div class="flex items-center gap-8">
        <NuxtLink to="/" class="flex items-center">
          <FadeImage
            use-nuxt-img
            src="/images/logo.png"
            alt="NovelSolar"
            class="h-8 w-32 rounded"
            image-class="object-contain"
          />
        </NuxtLink>
        <nav class="hidden lg:flex items-center gap-2">
          <!-- Desktop Product Dropdown -->
          <div class="relative py-6" @mouseenter="openDesktopMenu('product')" @mouseleave="closeDesktopMenu()">
            <button
              type="button"
              class="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-[#002888] transition-colors"
              :class="{ 'text-[#002888]': isDesktopMenuOpen('product') }"
              :aria-expanded="isDesktopMenuOpen('product')"
              @click="toggleDesktopMenu('product')"
            >
              Product
              <span
                class="inline-block text-gray-500 font-light ml-1 text-lg leading-none transition-transform duration-300"
                :class="{ 'rotate-45': isDesktopMenuOpen('product') }"
                >+</span
              >
            </button>

            <!-- Simplified Product Dropdown -->
            <div
              class="absolute left-1/2 -translate-x-1/2 top-full w-64 bg-white border border-gray-200 shadow-xl rounded-lg transition-all duration-200 z-50 py-2"
              :class="desktopDropdownClass('product')"
            >
              <NuxtLink
                to="/shop"
                class="block px-6 py-2.5 text-sm font-semibold text-[#002888] hover:bg-blue-50 transition-colors border-b border-gray-100"
                @click="closeDesktopMenu"
              >
                Shop All Products &rarr;
              </NuxtLink>
              <NuxtLink
                v-for="category in productMenu"
                :key="category.title"
                :to="getCategoryLink(category.title)"
                class="block px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#002888] transition-colors"
                @click="closeDesktopMenu"
              >
                {{ category.title }}
              </NuxtLink>
            </div>
          </div>

          <div class="w-4" />

          <!-- Desktop Services Dropdown -->
          <div class="relative py-6" @mouseenter="openDesktopMenu('services')" @mouseleave="closeDesktopMenu()">
            <button
              type="button"
              class="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-[#002888] transition-colors"
              :class="{ 'text-[#002888]': isDesktopMenuOpen('services') }"
              :aria-expanded="isDesktopMenuOpen('services')"
              @click="toggleDesktopMenu('services')"
            >
              Services
              <span
                class="inline-block text-gray-500 font-light ml-1 text-lg leading-none transition-transform duration-300"
                :class="{ 'rotate-45': isDesktopMenuOpen('services') }"
                >+</span
              >
            </button>

            <div
              class="absolute left-0 top-full w-80 bg-white border border-gray-200 shadow-xl rounded-lg transition-all duration-200 z-50 py-2"
              :class="desktopDropdownClass('services')"
            >
              <NuxtLink
                v-for="service in servicesMenu"
                :key="service.title"
                :to="service.link"
                class="block px-6 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#002888] transition-colors border-b border-gray-100 last:border-0"
                @click="closeDesktopMenu"
              >
                {{ service.title }}
              </NuxtLink>
            </div>
          </div>

          <div class="w-4" />

          <!-- Desktop Partners Dropdown -->
          <div class="relative py-6" @mouseenter="openDesktopMenu('partners')" @mouseleave="closeDesktopMenu()">
            <NuxtLink
              to="/partners"
              class="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-[#002888] transition-colors"
              :class="{ 'text-[#002888]': isDesktopMenuOpen('partners') }"
              @click="openDesktopMenu('partners')"
            >
              Partners
              <span
                class="inline-block text-gray-500 font-light ml-1 text-lg leading-none transition-transform duration-300"
                :class="{ 'rotate-45': isDesktopMenuOpen('partners') }"
                >+</span
              >
            </NuxtLink>

            <div
              class="absolute left-0 top-full w-56 bg-white border border-gray-200 shadow-xl rounded-lg transition-all duration-200 z-50 py-2"
              :class="desktopDropdownClass('partners')"
            >
              <NuxtLink
                v-for="partner in partnersMenu"
                :key="partner.title"
                :to="partner.link"
                class="block px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#002888] transition-colors"
                @click="closeDesktopMenu"
              >
                {{ partner.title }}
              </NuxtLink>
              <div class="border-t border-gray-100 mt-2 pt-2">
                <NuxtLink
                  to="/partners/become-a-partner"
                  class="block px-6 py-2.5 text-sm font-semibold text-[#002888] hover:bg-blue-50 transition-colors"
                  @click="closeDesktopMenu"
                >
                  Become a Partner &rarr;
                </NuxtLink>
              </div>
            </div>
          </div>

          <div class="w-4" />

          <!-- About Us Dropdown -->
          <div class="relative py-6" @mouseenter="openDesktopMenu('about')" @mouseleave="closeDesktopMenu()">
            <button
              type="button"
              class="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-[#002888] transition-colors"
              :class="{ 'text-[#002888]': isDesktopMenuOpen('about') }"
              :aria-expanded="isDesktopMenuOpen('about')"
              @click="toggleDesktopMenu('about')"
            >
              About Us
              <span
                class="inline-block text-gray-500 font-light ml-1 text-lg leading-none transition-transform duration-300"
                :class="{ 'rotate-45': isDesktopMenuOpen('about') }"
                >+</span
              >
            </button>

            <div
              class="absolute top-full left-0 w-48 bg-white border border-gray-100 shadow-lg rounded-md transition-all duration-200 z-50 overflow-hidden"
              :class="desktopDropdownClass('about')"
            >
              <ul class="py-1">
                <li>
                  <NuxtLink
                    to="/about"
                    class="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#002888] transition-colors"
                    @click="closeDesktopMenu"
                    >About us</NuxtLink
                  >
                </li>
                <li>
                  <NuxtLink
                    to="/branch-outlets"
                    class="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#002888] transition-colors"
                    @click="closeDesktopMenu"
                    >Branch outlets</NuxtLink
                  >
                </li>
                <li>
                  <NuxtLink
                    to="/gallery"
                    class="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#002888] transition-colors"
                    @click="closeDesktopMenu"
                    >Gallery</NuxtLink
                  >
                </li>
                <li>
                  <NuxtLink
                    to="/blog"
                    class="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#002888] transition-colors"
                    @click="closeDesktopMenu"
                    >Blog</NuxtLink
                  >
                </li>
              </ul>
            </div>
          </div>

          <div class="w-4" />

          <!-- Blog Link -->
          <div class="relative py-6">
            <NuxtLink
              to="/blog"
              class="text-sm font-semibold text-gray-700 hover:text-[#002888] transition-colors"
              :class="{ 'text-[#002888]': isBlogRoute }"
            >
              Blog
            </NuxtLink>
          </div>

          <div class="w-4" />

          <!-- Quote Request Dropdown -->
          <div class="relative py-6" @mouseenter="openDesktopMenu('quote')" @mouseleave="closeDesktopMenu()">
            <button
              type="button"
              class="text-sm font-semibold text-gray-700 hover:text-[#002888] transition-colors flex items-center gap-1"
              :class="{ 'text-[#002888]': isDesktopMenuOpen('quote') }"
              :aria-expanded="isDesktopMenuOpen('quote')"
              @click="toggleDesktopMenu('quote')"
            >
              Quote Request
              <span
                class="inline-block text-gray-500 font-light ml-1 text-lg leading-none transition-transform duration-300"
                :class="{ 'rotate-45': isDesktopMenuOpen('quote') }"
                >+</span
              >
            </button>

            <div
              class="absolute top-full left-0 w-56 bg-white border border-gray-100 shadow-lg rounded-md transition-all duration-200 z-50 overflow-hidden"
              :class="desktopDropdownClass('quote')"
            >
              <ul class="py-1">
                <li>
                  <NuxtLink
                    to="/quote"
                    class="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#002888] transition-colors font-normal"
                    @click="closeDesktopMenu"
                    >Request a quote</NuxtLink
                  >
                </li>
                <li>
                  <NuxtLink
                    to="/calculator"
                    class="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#002888] transition-colors font-normal"
                    @click="closeDesktopMenu"
                    >Load calculator</NuxtLink
                  >
                </li>
              </ul>
            </div>
          </div>

          <div class="w-4" />

          <!-- Desktop Support Dropdown -->
          <div class="relative py-6" @mouseenter="openDesktopMenu('support')" @mouseleave="closeDesktopMenu()">
            <button
              type="button"
              class="text-sm font-semibold text-gray-700 hover:text-[#002888] transition-colors flex items-center gap-1"
              :class="{ 'text-[#002888]': isDesktopMenuOpen('support') }"
              :aria-expanded="isDesktopMenuOpen('support')"
              @click="toggleDesktopMenu('support')"
            >
              Support
              <span
                class="inline-block text-gray-500 font-light ml-1 text-lg leading-none transition-transform duration-300"
                :class="{ 'rotate-45': isDesktopMenuOpen('support') }"
                >+</span
              >
            </button>

            <div
              class="absolute left-0 top-full w-48 bg-white border border-gray-200 shadow-xl rounded-lg transition-all duration-200 z-50 py-2"
              :class="desktopDropdownClass('support')"
            >
              <NuxtLink
                v-for="item in supportMenu"
                :key="item.title"
                :to="item.link"
                class="block px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#002888] transition-colors"
                @click="closeDesktopMenu"
              >
                {{ item.title }}
              </NuxtLink>
            </div>
          </div>
        </nav>
      </div>

      <!-- Center Section: Search Bar -->
      <div class="w-64 lg:w-80 ml-auto mr-8 relative hidden lg:block">
        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search inventory..."
          class="w-full bg-gray-50 border border-gray-300 rounded-md py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#002288] transition-all"
          @keyup.enter="handleSearch"
        />
      </div>

      <!-- Right Section: Actions -->
      <div class="flex items-center gap-6">
        <!-- Cart -->
        <button
          aria-label="Toggle Shopping Cart"
          class="text-gray-600 hover:text-black transition-colors relative group/cart cursor-pointer flex items-center bg-transparent border-none p-0"
          @click="toggleCart"
        >
          <span class="material-symbols-outlined text-2xl">shopping_cart</span>
          <span
            v-if="cartItemCount > 0"
            class="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm"
          >
            {{ cartItemCount }}
          </span>
        </button>

        <!-- Button -->
        <NuxtLink
          to="/quote"
          class="bg-[#002888] text-white px-5 py-2.5 rounded-md text-sm font-bold hover:bg-blue-900 transition-colors shadow-sm hidden sm:block"
        >
          Request a Quote
        </NuxtLink>

        <!-- Profile Icon / Dropdown -->
        <div class="relative group/profile">
          <NuxtLink
            :to="user ? '#' : '/login'"
            class="h-9 w-9 rounded-full flex items-center justify-center cursor-pointer transition-all border shrink-0 overflow-hidden"
            :class="
              user
                ? 'bg-orange-100 text-orange-600 border-orange-200 hover:bg-orange-200'
                : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
            "
            title="My Account"
          >
            <template v-if="user">
              <span class="text-[10px] font-black uppercase tracking-tighter">{{ userInitials }}</span>
            </template>
            <template v-else>
              <span class="material-symbols-outlined text-[20px]">person</span>
            </template>
          </NuxtLink>

          <!-- User Dropdown Menu -->
          <div
            v-if="user"
            class="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 shadow-xl rounded-xl opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-200 z-[60] py-2 overflow-hidden"
          >
            <div class="px-4 py-3 border-b border-gray-50 mb-1">
              <p class="text-xs font-bold text-gray-900 truncate">{{ user.firstName }} {{ user.lastName }}</p>
              <p class="text-[10px] text-gray-500 truncate">{{ user.email }}</p>
            </div>
            <NuxtLink
              to="/account"
              class="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#002888] transition-colors"
              >My Profile</NuxtLink
            >
            <NuxtLink
              to="/orders"
              class="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#002888] transition-colors"
              >Order History</NuxtLink
            >
            <div class="border-t border-gray-50 mt-2 pt-1">
              <button
                class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                @click="handleLogout"
              >
                <span class="material-symbols-outlined text-sm">logout</span>
                Logout
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile Toggle Button -->
        <button
          class="hidden p-2 text-gray-600 hover:text-[#002888] transition-colors focus-visible:ring-2 focus-visible:ring-[#002888] rounded-md"
          aria-label="Toggle Navigation Menu"
          :aria-expanded="isMobileMenuOpen"
          @click="toggleMobileMenu"
        >
          <svg v-if="!isMobileMenuOpen" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mobile Dropdown Drawer -->
      <div
        v-show="isMobileMenuOpen"
        class="lg:hidden absolute top-20 left-0 w-full bg-white border-b border-gray-200 shadow-lg z-50 flex flex-col overflow-y-auto max-h-[calc(100vh-5rem)]"
      >
        <!-- Search -->
        <div class="p-6 border-b border-gray-50">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search inventory..."
              class="w-full bg-gray-50 border border-gray-300 rounded-md py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#002288]"
              @keyup.enter="handleSearch"
            />
          </div>
        </div>

        <!-- Links -->
        <nav class="flex flex-col">
          <template v-for="link in mobileMenuSections" :key="link.title">
            <!-- Simplified Product in Mobile Menu -->
            <div v-if="link.title === 'Product'" class="px-6 py-4 border-b border-gray-50">
              <NuxtLink
                to="/shop"
                class="flex items-center justify-between group/mob-prod"
                @click="isMobileMenuOpen = false"
              >
                <div
                  class="text-[#002888] text-[10px] font-black uppercase tracking-widest mb-4 group-hover/mob-prod:underline"
                >
                  Shop All Products &rarr;
                </div>
              </NuxtLink>
              <nav class="space-y-4">
                <NuxtLink
                  v-for="category in productMenu"
                  :key="category.title"
                  :to="getCategoryLink(category.title)"
                  class="block text-gray-900 hover:text-[#002888] transition-colors font-bold text-base"
                  @click="isMobileMenuOpen = false"
                >
                  {{ category.title }}
                </NuxtLink>
              </nav>
            </div>
            <!-- Special Handling for Services in Mobile Menu -->
            <div v-else-if="link.title === 'Services'" class="px-6 py-4 border-b border-gray-50">
              <button
                class="w-full text-left text-gray-900 font-bold text-base mb-2 flex items-center justify-between"
                @click="toggleMobileSection(link.title)"
              >
                Services
                <span
                  class="text-gray-500 font-light text-lg leading-none transition-transform duration-300"
                  :class="{ 'rotate-45': openMobileSections[link.title] }"
                  >+</span
                >
              </button>
              <div v-show="openMobileSections[link.title]" class="pl-4 border-l-2 border-primary/10 ml-1 space-y-1">
                <NuxtLink
                  v-for="service in servicesMenu"
                  :key="service.title"
                  :to="service.link"
                  class="block text-gray-600 py-3 text-sm hover:text-primary transition-colors border-b border-gray-50 last:border-0"
                  @click="isMobileMenuOpen = false"
                >
                  {{ service.title }}
                </NuxtLink>
              </div>
            </div>
            <!-- Special Handling for Partners in Mobile Menu -->
            <div v-else-if="link.title === 'Partners'" class="px-6 py-4 border-b border-gray-50">
              <button
                class="w-full text-left text-gray-900 font-bold text-base mb-2 flex items-center justify-between"
                @click="toggleMobileSection(link.title)"
              >
                Partners
                <span
                  class="text-gray-500 font-light text-lg leading-none transition-transform duration-300"
                  :class="{ 'rotate-45': openMobileSections[link.title] }"
                  >+</span
                >
              </button>
              <div v-show="openMobileSections[link.title]" class="pl-4 border-l-2 border-primary/10 ml-1 space-y-1">
                <NuxtLink
                  v-for="partner in partnersMenu"
                  :key="partner.title"
                  :to="partner.link"
                  class="block text-gray-600 py-2.5 text-sm hover:text-primary transition-colors"
                  @click="isMobileMenuOpen = false"
                >
                  {{ partner.title }}
                </NuxtLink>
                <NuxtLink
                  to="/partners/become-a-partner"
                  class="block text-primary py-3 text-sm font-bold hover:text-blue-800 transition-colors border-t border-gray-50 mt-2"
                  @click="isMobileMenuOpen = false"
                >
                  Become a Partner &rarr;
                </NuxtLink>
              </div>
            </div>
            <!-- Special Handling for About Us in Mobile Menu -->
            <div v-else-if="link.title === 'About Us'" class="px-6 py-4 border-b border-gray-50">
              <button
                class="w-full text-left text-gray-900 font-bold text-base mb-2 flex items-center justify-between"
                @click="toggleMobileSection(link.title)"
              >
                About Us
                <span
                  class="text-gray-500 font-light text-lg leading-none transition-transform duration-300"
                  :class="{ 'rotate-45': openMobileSections[link.title] }"
                  >+</span
                >
              </button>
              <div v-show="openMobileSections[link.title]" class="pl-4 border-l-2 border-primary/10 ml-1 space-y-1">
                <NuxtLink
                  v-for="item in link.items"
                  :key="item.title"
                  :to="item.link"
                  class="block text-gray-600 py-3 text-sm hover:text-primary transition-colors border-b border-gray-50 last:border-0"
                  @click="isMobileMenuOpen = false"
                >
                  {{ item.title }}
                </NuxtLink>
              </div>
            </div>
            <!-- Special Handling for Quote Request in Mobile Menu -->
            <div v-else-if="link.title === 'Quote Request'" class="px-6 py-4 border-b border-gray-50">
              <button
                class="w-full text-left text-gray-900 font-bold text-base mb-2 flex items-center justify-between"
                @click="toggleMobileSection(link.title)"
              >
                Quote Request
                <span
                  class="text-gray-500 font-light text-lg leading-none transition-transform duration-300"
                  :class="{ 'rotate-45': openMobileSections[link.title] }"
                  >+</span
                >
              </button>
              <div v-show="openMobileSections[link.title]" class="pl-4 border-l-2 border-primary/10 ml-1 space-y-1">
                <NuxtLink
                  v-for="item in link.items"
                  :key="item.title"
                  :to="item.link"
                  class="block text-gray-600 py-3 text-sm hover:text-primary transition-colors border-b border-gray-50 last:border-0"
                  @click="isMobileMenuOpen = false"
                >
                  {{ item.title }}
                </NuxtLink>
              </div>
            </div>
            <!-- Special Handling for Support in Mobile Menu -->
            <div v-else-if="link.title === 'Support'" class="px-6 py-4 border-b border-gray-50">
              <button
                class="w-full text-left text-gray-900 font-bold text-base mb-2 flex items-center justify-between"
                @click="toggleMobileSection(link.title)"
              >
                Support
                <span
                  class="text-gray-500 font-light text-lg leading-none transition-transform duration-300"
                  :class="{ 'rotate-45': openMobileSections[link.title] }"
                  >+</span
                >
              </button>
              <div v-show="openMobileSections[link.title]" class="pl-4 border-l-2 border-primary/10 ml-1 space-y-1">
                <NuxtLink
                  v-for="item in supportMenu"
                  :key="item.title"
                  :to="item.link"
                  class="block text-gray-600 py-3 text-sm hover:text-primary transition-colors border-b border-gray-50 last:border-0"
                  @click="isMobileMenuOpen = false"
                >
                  {{ item.title }}
                </NuxtLink>
              </div>
            </div>
            <!-- Standard Links -->
            <NuxtLink
              v-else
              :to="link.link"
              class="block w-full text-left px-6 py-4 border-b border-gray-50 text-gray-800 font-semibold hover:bg-gray-50 hover:text-[#002888] transition-colors"
              @click="isMobileMenuOpen = false"
            >
              {{ link.title }}
            </NuxtLink>
          </template>
        </nav>

        <!-- CTA -->
        <div class="p-6 bg-gray-50/50">
          <NuxtLink
            to="/quote"
            class="bg-[#002888] text-white w-full py-4 flex items-center justify-center rounded-lg text-sm font-bold hover:bg-blue-900 transition-colors shadow-md"
            @click="isMobileMenuOpen = false"
          >
            Request a Quote
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <!-- Every admin page except the dashboard itself gets a way back to it.
         Placed in the layout rather than on each page because only 2 of 13
         admin pages had a dashboard link, and the next page added would have
         been the fourteenth to forget one. -->
    <div v-if="showAdminBackBar" class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
        <NuxtLink
          to="/admin"
          class="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider text-[#002888] transition-colors hover:bg-slate-100"
        >
          <span class="material-symbols-outlined text-lg">arrow_back</span>
          Back to Dashboard
        </NuxtLink>
      </div>
    </div>

    <main class="flex-grow pb-24 md:pb-0">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 mt-12 py-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <!-- Column 1: Brand Info -->
          <div>
            <div class="mb-4">
              <FadeImage
                use-nuxt-img
                src="/images/logo.png"
                alt="NovelSolar"
                class="h-8 w-32 rounded"
                image-class="object-contain"
              />
            </div>
            <p class="text-sm text-gray-500 mb-4">
              Providing top-tier solar solutions for a sustainable future. Empowering communities with clean energy.
            </p>
          </div>

          <!-- Column 2: Product Categories -->
          <div>
            <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4">Product Categories</h3>
            <ul class="space-y-3">
              <li>
                <NuxtLink to="/category/solar-panels" class="text-sm text-gray-500 hover:text-primary transition-colors"
                  >Solar Panels</NuxtLink
                >
              </li>
              <li>
                <NuxtLink to="/category/inverters" class="text-sm text-gray-500 hover:text-primary transition-colors"
                  >Inverters</NuxtLink
                >
              </li>
              <li>
                <NuxtLink to="/category/lighting" class="text-sm text-gray-500 hover:text-primary transition-colors"
                  >Lighting</NuxtLink
                >
              </li>
              <li>
                <NuxtLink to="/category/power-banks" class="text-sm text-gray-500 hover:text-primary transition-colors"
                  >Power Banks</NuxtLink
                >
              </li>
              <li>
                <NuxtLink to="/category/accessories" class="text-sm text-gray-500 hover:text-primary transition-colors"
                  >Accessories</NuxtLink
                >
              </li>
            </ul>
          </div>

          <!-- Column 3: Company Links -->
          <div>
            <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4">Company</h3>
            <ul class="space-y-3">
              <li>
                <NuxtLink to="/about" class="text-sm text-gray-500 hover:text-primary transition-colors"
                  >About Us</NuxtLink
                >
              </li>
              <li>
                <NuxtLink to="/careers" class="text-sm text-gray-500 hover:text-primary transition-colors"
                  >Careers</NuxtLink
                >
              </li>
              <li>
                <NuxtLink to="/blog" class="text-sm text-gray-500 hover:text-primary transition-colors">Blog</NuxtLink>
              </li>
              <li>
                <NuxtLink to="/contact" class="text-sm text-gray-500 hover:text-primary transition-colors"
                  >Contact</NuxtLink
                >
              </li>
              <li class="pt-2">
                <NuxtLink
                  to="/partners/become-a-dealer"
                  class="text-sm font-bold text-[#002888] hover:text-blue-900 transition-colors inline-block"
                  >Become a Dealer &rarr;</NuxtLink
                >
              </li>
            </ul>
          </div>

          <!-- Column 4: Newsletter -->
          <div>
            <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4">Newsletter</h3>
            <p class="text-sm text-gray-500 mb-4">Subscribe to get the latest updates and offers.</p>
            <form class="flex" @submit.prevent>
              <label for="newsletter-email" class="sr-only">Email address</label>
              <input
                id="newsletter-email"
                type="email"
                required
                class="appearance-none min-w-0 w-full bg-white border border-gray-300 rounded-l-md py-2 px-4 text-base text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="Enter your email"
              />
              <div class="rounded-md sm:mt-0 sm:ml-3 sm:flex-shrink-0">
                <button
                  type="submit"
                  class="bg-[#002888] text-white px-5 py-2.5 rounded-md text-sm font-bold hover:bg-blue-900 transition-colors shadow-sm w-full flex items-center justify-center -ml-3 rounded-l-none"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </div>
        <div class="mt-8 pt-8 border-t border-gray-200 flex items-center justify-between">
          <p class="text-sm text-gray-400">&copy; 2026 NovelSolar. All rights reserved.</p>
        </div>
      </div>
    </footer>

    <!-- Fixed Bottom Navigation (Mobile Only) -->
    <nav
      class="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-lg border-t border-gray-200 z-[60] md:hidden flex justify-around items-center pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
    >
      <!-- Home -->
      <NuxtLink
        to="/"
        class="flex flex-col items-center p-2 text-gray-500 hover:text-[#002888] active:scale-95 transition-transform"
        exact-active-class="!text-[#002888]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span class="text-[10px] mt-1 font-medium">Home</span>
      </NuxtLink>

      <!-- Shop -->
      <NuxtLink
        to="/shop"
        class="flex flex-col items-center p-2 text-gray-500 hover:text-[#002888] active:scale-95 transition-transform"
        active-class="!text-[#002888]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        <span class="text-[10px] mt-1 font-medium">Shop</span>
      </NuxtLink>

      <!-- Calculator -->
      <NuxtLink
        to="/calculator"
        class="flex flex-col items-center p-2 text-gray-500 hover:text-[#002888] active:scale-95 transition-transform"
        active-class="!text-[#002888]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="16" y1="14" x2="16" y2="18" />
          <path d="M16 10h.01" />
          <path d="M12 10h.01" />
          <path d="M8 10h.01" />
          <path d="M12 14h.01" />
          <path d="M8 14h.01" />
          <path d="M12 18h.01" />
          <path d="M8 18h.01" />
        </svg>
        <span class="text-[10px] mt-1 font-medium">Load Calc</span>
      </NuxtLink>

      <!-- Menu -->
      <button
        class="flex flex-col items-center p-2 text-gray-500 hover:text-[#002888] active:scale-95 transition-transform"
        :class="{ 'text-[#002888]': isMobileMenuOpen }"
        @click="toggleMobileMenu"
      >
        <svg
          v-if="!isMobileMenuOpen"
          xmlns="http://www.w3.org/2000/svg"
          class="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="12" />
        </svg>
        <span class="text-[10px] mt-1 font-medium">{{ isMobileMenuOpen ? 'Close' : 'Menu' }}</span>
      </button>
    </nav>
    <!-- Global Cart Drawer -->
    <LazyCartDrawer />
    <!-- Global WhatsApp Floating Button -->
    <WhatsAppFloating />
  </div>
</template>

<script setup lang="ts">
const supabaseUser = useSupabaseUser()
const supabase = useSupabaseClient()

const isBitrixContext = useState('isBitrixContext', () => false)

useHead({
  script: [{ src: 'https://api.bitrix24.com/api/v1/', defer: true }],
})

const isMobileMenuOpen = ref(false)
const openMobileSections = ref<Record<string, boolean>>({})

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}
const toggleMobileSection = (section: string) => {
  openMobileSections.value[section] = !openMobileSections.value[section]
}

const activeDesktopMenu = ref<string | null>(null)

const openDesktopMenu = (menu: string) => {
  activeDesktopMenu.value = menu
}

const closeDesktopMenu = () => {
  activeDesktopMenu.value = null
}

const toggleDesktopMenu = (menu: string) => {
  activeDesktopMenu.value = activeDesktopMenu.value === menu ? null : menu
}

const isDesktopMenuOpen = (menu: string) => activeDesktopMenu.value === menu
const desktopDropdownClass = (menu: string) =>
  isDesktopMenuOpen(menu)
    ? 'opacity-100 visible translate-y-0 pointer-events-auto'
    : 'opacity-0 invisible -translate-y-1 pointer-events-none'

const searchQuery = ref('')
const handleSearch = () => {
  if (!searchQuery.value.trim()) return
  navigateTo(`/products?q=${encodeURIComponent(searchQuery.value.trim())}`)
  isMobileMenuOpen.value = false
  closeDesktopMenu()
  searchQuery.value = ''
}

const appConfig = useAppConfig()
const fallbackProductMenu = [
  { title: 'Solar Panels' },
  { title: 'Inverters' },
  { title: 'Batteries' },
  { title: 'Charge Controllers' },
  { title: 'Lighting' },
  { title: 'Power Banks' },
  { title: 'Accessories' },
]
const fallbackServicesMenu = [
  { title: 'Power & Load Audit Service', link: '/services/audit' },
  { title: 'Inverter, Solar Panel & Battery Installation', link: '/services/installation' },
  { title: 'Inverter Repair (Solar Panel, Battery etc Repairs)', link: '/services/repair' },
  { title: 'Solar Panel, Tubular Battery & Inverter Maintenance', link: '/services/maintenance' },
]
const fallbackPartnersMenu = [
  { title: 'Itel', link: '/partners/itel' },
  { title: 'Haisic', link: '/partners/haisic' },
  { title: 'Yinergy', link: '/partners/yinergy' },
  { title: 'Hithium', link: '/partners/hithium' },
  { title: 'Livoltek', link: '/partners/livoltek' },
]
const fallbackSupportMenu = [
  { title: 'FAQ', link: '/faq' },
  { title: 'Contact Us', link: '/contact' },
]

const productMenu = computed(() =>
  appConfig.nav?.productMenu?.length ? appConfig.nav.productMenu : fallbackProductMenu,
)
const servicesMenu = computed(() =>
  appConfig.nav?.servicesMenu?.length ? appConfig.nav.servicesMenu : fallbackServicesMenu,
)
const partnersMenu = computed(() =>
  appConfig.nav?.partnersMenu?.length ? appConfig.nav.partnersMenu : fallbackPartnersMenu,
)
const supportMenu = computed(() =>
  appConfig.nav?.supportMenu?.length ? appConfig.nav.supportMenu : fallbackSupportMenu,
)
const aboutMenu = [
  { title: 'About us', link: '/about' },
  { title: 'Branch outlets', link: '/branch-outlets' },
  { title: 'Gallery', link: '/gallery' },
  { title: 'Blog', link: '/blog' },
]
const quoteRequestMenu = [
  { title: 'Request a quote', link: '/quote' },
  { title: 'Load calculator', link: '/calculator' },
]
const mobileMenuSections = computed(() => [
  { title: 'Product' },
  { title: 'Services' },
  { title: 'Partners' },
  { title: 'About Us', items: aboutMenu },
  { title: 'Blog', link: '/blog' },
  { title: 'Quote Request', items: quoteRequestMenu },
  { title: 'Support' },
])

const route = useRoute()

/**
 * Admin pages had no way back to the dashboard — the only route was logging
 * out and in again. Excluded: the dashboard itself, and the auth pages, which
 * are reachable while signed out and must not offer a link into the console.
 */
const ADMIN_AUTH_ROUTES = ['/admin/login', '/admin/forgot-password', '/admin/reset-password']
const showAdminBackBar = computed(() => {
  const path = route.path.replace(/\/+$/, '')
  if (!path.startsWith('/admin')) return false
  if (path === '/admin') return false
  return !ADMIN_AUTH_ROUTES.includes(path)
})
const isBlogRoute = computed(() => route.path === '/blog' || route.path.startsWith('/blog/'))

const getCategoryLink = (title: string) => `/category/${title.toLowerCase().replace(/\s+/g, '-')}`

const { cartItemCount, toggleCart } = useCart()

// Nuxt does not forward cookies to internal API routes during SSR, so without
// the explicit header this renders as anonymous for a signed-in customer.
// Returns 401 (and leaves `user` null) when nobody is signed in.
const { data: user } = await useFetch('/api/user/profile', {
  headers: useRequestHeaders(['cookie']),
})

// Compute initials if the user exists
const userInitials = computed(() => {
  if (!user.value) return ''
  if (user.value.isTemporary) return '??'
  const first = user.value.firstName ? user.value.firstName.charAt(0).toUpperCase() : ''
  const last = user.value.lastName ? user.value.lastName.charAt(0).toUpperCase() : ''
  return first + last || 'U' // Fallback to 'U' if they haven't set a name yet
})

const handleLogout = async () => {
  try {
    // Supabase Auth is the only customer session — the `auth_token` cookie
    // and /api/auth/logout were removed. Dealers and customers land on
    // different login pages; every signed-in user has a Supabase session, so
    // the old `if (supabaseUser)` branch sent customers to /dealer/login.
    const isDealer = supabaseUser.value?.user_metadata?.role === 'dealer'
    await supabase.auth.signOut()
    user.value = null
    navigateTo(isDealer ? '/dealer/login' : '/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

const { initBitrixNavigation } = useBitrixNavigation()

onMounted(() => {
  // Mobile search focus handler

  // Check if we are running inside an iframe (Bitrix24 context)
  if (window !== window.parent) {
    isBitrixContext.value = true

    // Wait for BX24 to be available and initialize
    const checkBX24 = setInterval(() => {
      if (typeof (window as any).BX24 !== 'undefined') {
        clearInterval(checkBX24)
        ;(window as any).BX24.init()
        ;(window as any).BX24.installFinish()
        initBitrixNavigation() // Start navigation sync once BX24 is ready
      }
    }, 100)
    // Clear after 5 seconds to avoid infinite loop
    setTimeout(() => clearInterval(checkBX24), 5000)
  }
})
</script>

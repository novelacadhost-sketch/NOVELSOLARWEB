<script setup lang="ts">
const { addToast } = useToast()
const supabase = useSupabaseClient()
const isLoading = ref(false)
const isLoadingProfile = ref(true)
const profile = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
})

// Form state for updates
const form = ref({
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
})

const isProfileIncomplete = computed(() => {
  return !profile.value.firstName || !profile.value.phone
})

const fetchProfile = async () => {
  isLoadingProfile.value = true
  try {
    const data = await useNuxtApp().$apiFetch('/api/user/profile')
    profile.value = data
    // Pre-fill form
    form.value = {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      address: data.address,
    }
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    if (error.statusCode === 401) {
      navigateTo('/login')
    }
  } finally {
    isLoadingProfile.value = false
  }
}

const handleUpdateProfile = async () => {
  if (!form.value.firstName || !form.value.phone) {
    addToast('Validation', 'First Name and Phone Number are required.', 'error')
    return
  }

  isLoading.value = true
  try {
    await useNuxtApp().$apiFetch('/api/user/profile', {
      method: 'PUT',
      body: form.value,
    })
    // Refresh profile data
    await fetchProfile()
  } catch (error) {
    console.error('Update profile error:', error)
    addToast(
      'Synchronization Error',
      'We were unable to save your details to the CRM. Please check your connection and try again.',
      'error',
    )
  } finally {
    isLoading.value = false
  }
}

const handleLogout = async () => {
  isLoading.value = true
  try {
    // This previously only cleared the `auth_token` cookie and left the
    // Supabase session intact — a logout that did not log you out.
    await supabase.auth.signOut()
    navigateTo('/login')
  } catch (error) {
    console.error('Logout error:', error)
    navigateTo('/login')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchProfile()
})

useHead({
  title: 'My Account | Novel Solar',
  meta: [{ name: 'description', content: 'Manage your Novel Solar account.' }],
})
</script>

<template>
  <div class="min-h-screen bg-[#f8fafc] pt-24 pb-20 px-4 md:px-6">
    <div class="max-w-4xl mx-auto">
      <!-- Loading State -->
      <div v-if="isLoadingProfile" class="flex flex-col items-center justify-center py-20 animate-pulse">
        <div class="w-16 h-16 border-4 border-slate-200 border-t-[#a9001d] rounded-full animate-spin mb-4" />
        <p class="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Profile...</p>
      </div>

      <template v-else>
        <!-- Header Section -->
        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-500"
        >
          <div>
            <h1 class="text-4xl font-black text-slate-900 tracking-tight mb-2 uppercase">My Account</h1>
            <p class="text-slate-500 font-medium">Manage your profile, orders, and technical support.</p>
          </div>

          <button
            :disabled="isLoading"
            class="inline-flex items-center gap-2 bg-white border-2 border-slate-100 px-6 py-3 rounded-2xl font-bold text-slate-600 hover:text-[#a9001d] hover:border-red-100 hover:bg-red-50 transition-all active:scale-[0.98] group"
            @click="handleLogout"
          >
            <span
              v-if="isLoading"
              class="animate-spin border-2 border-slate-300 border-t-[#a9001d] w-4 h-4 rounded-full"
            />
            <span v-else class="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1"
              >logout</span
            >
            {{ isLoading ? 'Logging out...' : 'Logout' }}
          </button>
        </div>

        <!-- Conditional Content -->
        <div v-if="isProfileIncomplete" class="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div
            class="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/60 border border-slate-100 max-w-2xl mx-auto overflow-hidden relative"
          >
            <!-- Branding Accent -->
            <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#3c59b0] to-blue-500" />

            <div class="mb-10 text-center">
              <div
                class="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-blue-100"
              >
                <span class="material-symbols-outlined text-4xl text-[#3c59b0]">person_add</span>
              </div>
              <h2 class="text-3xl font-black text-slate-900 mb-3">Complete Your Profile</h2>
              <p class="text-slate-500 font-medium max-w-sm mx-auto">
                Just a few more details so we can provide you with personalized solar solutions.
              </p>
            </div>

            <form class="grid grid-cols-1 md:grid-cols-2 gap-6" @submit.prevent="handleUpdateProfile">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name*</label>
                <input
                  v-model="form.firstName"
                  type="text"
                  required
                  placeholder="e.g. John"
                  class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-slate-900 font-bold outline-none focus:border-[#3c59b0] focus:ring-4 focus:ring-blue-50 transition-all"
                />
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                <input
                  v-model="form.lastName"
                  type="text"
                  placeholder="e.g. Doe"
                  class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-slate-900 font-bold outline-none focus:border-[#3c59b0] focus:ring-4 focus:ring-blue-50 transition-all"
                />
              </div>
              <div class="space-y-2 md:col-span-2">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                  >Phone Number*</label
                >
                <input
                  v-model="form.phone"
                  type="tel"
                  required
                  placeholder="+234..."
                  class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-slate-900 font-bold outline-none focus:border-[#3c59b0] focus:ring-4 focus:ring-blue-50 transition-all"
                />
              </div>
              <div class="space-y-2 md:col-span-2">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                  >Street Address</label
                >
                <input
                  v-model="form.address"
                  type="text"
                  placeholder="123 Energy Lane, Ikeja"
                  class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-slate-900 font-bold outline-none focus:border-[#3c59b0] focus:ring-4 focus:ring-blue-50 transition-all"
                />
              </div>

              <div class="md:col-span-2 mt-4">
                <button
                  type="submit"
                  :disabled="isLoading"
                  class="w-full bg-[#3c59b0] text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-900 transition-all shadow-xl shadow-blue-900/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <span
                    v-if="isLoading"
                    class="animate-spin border-2 border-white/30 border-t-white w-5 h-5 rounded-full"
                  />
                  {{ isLoading ? 'Saving Profile...' : 'Save & Continue' }}
                  <span v-if="!isLoading" class="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Main Dashboard Content -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Profile Card -->
          <div class="lg:col-span-2 space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 delay-150">
            <div
              class="bg-white rounded-3xl p-8 md:p-10 shadow-xl shadow-slate-200/60 border border-slate-100 relative overflow-hidden group"
            >
              <div class="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <span class="material-symbols-outlined text-9xl">shield_person</span>
              </div>

              <div class="flex items-center gap-5 mb-8">
                <div
                  class="w-20 h-20 rounded-2xl bg-green-50 border-2 border-green-100 flex items-center justify-center"
                >
                  <span class="material-symbols-outlined text-4xl text-green-600">verified_user</span>
                </div>
                <div>
                  <p class="text-[10px] font-black text-green-600 uppercase tracking-[0.2em] mb-1">
                    Authenticated Account
                  </p>
                  <h2 class="text-2xl font-black text-slate-900">Welcome, {{ profile.firstName }}!</h2>
                </div>
              </div>

              <div class="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8">
                <p class="text-lg text-slate-700 font-medium leading-relaxed">
                  You are securely logged in to your professional Novel Solar console. Dashboard analytics and order
                  history features are being initialized.
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  class="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-[#3c59b0]/30 transition-colors bg-white"
                >
                  <span class="material-symbols-outlined text-[#3c59b0]">history</span>
                  <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Order History</span>
                </div>
                <div
                  class="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-[#3c59b0]/30 transition-colors bg-white"
                >
                  <span class="material-symbols-outlined text-[#3c59b0]">receipt_long</span>
                  <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Technical Quotes</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar / Actions -->
          <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 delay-300">
            <div class="bg-white rounded-3xl p-8 border border-slate-100 shadow-lg shadow-slate-200/40">
              <h3
                class="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 pb-4 border-b border-slate-50"
              >
                Quick Actions
              </h3>
              <ul class="space-y-4">
                <li>
                  <NuxtLink
                    to="/shop"
                    class="flex items-center gap-3 text-slate-500 hover:text-[#3c59b0] transition-colors group"
                  >
                    <span class="material-symbols-outlined text-lg">shopping_cart</span>
                    <span class="text-sm font-bold">Browse Inventory</span>
                    <span
                      class="material-symbols-outlined text-xs ml-auto opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1"
                      >arrow_forward</span
                    >
                  </NuxtLink>
                </li>
                <li>
                  <a
                    href="#"
                    class="flex items-center gap-3 text-slate-500 hover:text-[#3c59b0] transition-colors group"
                  >
                    <span class="material-symbols-outlined text-lg">support_agent</span>
                    <span class="text-sm font-bold">Contact Expert Support</span>
                    <span
                      class="material-symbols-outlined text-xs ml-auto opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1"
                      >arrow_forward</span
                    >
                  </a>
                </li>
                <li>
                  <button
                    class="flex items-center gap-3 text-slate-500 hover:text-[#3c59b0] transition-colors group w-full text-left"
                    @click="profile.firstName = ''"
                  >
                    <span class="material-symbols-outlined text-lg">edit</span>
                    <span class="text-sm font-bold">Edit Profile</span>
                    <span
                      class="material-symbols-outlined text-xs ml-auto opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1"
                      >arrow_forward</span
                    >
                  </button>
                </li>
              </ul>
            </div>

            <!-- Technical Alert (Premium Touch) -->
            <div
              class="bg-gradient-to-br from-[#3c59b0] to-blue-900 rounded-3xl p-8 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden"
            >
              <div class="relative z-10">
                <span class="material-symbols-outlined text-blue-200 mb-4 text-3xl">bolt</span>
                <h4 class="font-black text-lg mb-2 uppercase tracking-tight">Technical Hub</h4>
                <p class="text-blue-100 text-xs font-medium leading-relaxed opacity-80">
                  Your specialized solar dashboard is currently under active development. New monitoring tools coming
                  soon.
                </p>
              </div>
              <div class="absolute -bottom-6 -right-6 text-white/5">
                <span class="material-symbols-outlined text-[120px]">solar_power</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 600,
    'GRAD' 0,
    'opsz' 24;
}
</style>

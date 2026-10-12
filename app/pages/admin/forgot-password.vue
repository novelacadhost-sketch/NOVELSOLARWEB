<script setup lang="ts">
const email = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Forgot Password | Novel Solar Admin',
  meta: [{ name: 'description', content: 'Request an admin password reset link.' }],
})

const requestReset = async () => {
  if (!email.value) {
    errorMessage.value = 'Please enter your admin email.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await useNuxtApp().$apiFetch<{ message: string }>('/api/admin/auth/request-password-reset', {
      method: 'POST',
      body: {
        email: email.value,
      },
    })
    successMessage.value = response.message
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Failed to request password reset.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-[80vh] bg-slate-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="text-center mb-10">
        <div
          class="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-red-100 shadow-inner"
        >
          <span class="material-symbols-outlined text-3xl text-red-600">mark_email_unread</span>
        </div>
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">Forgot Password</h1>
        <p class="text-slate-500 font-medium mt-2">Enter your admin email and we’ll send you a reset link.</p>
      </div>

      <div
        class="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 sm:p-10 relative overflow-hidden"
      >
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400" />

        <form class="space-y-6" @submit.prevent="requestReset">
          <div>
            <label for="email" class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
              >Admin Email</label
            >
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400"
                >mail</span
              >
              <input
                id="email"
                v-model="email"
                type="email"
                placeholder="admin@novelsolar.com"
                required
                class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-medium outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all"
                :disabled="isLoading"
                autocomplete="email"
              />
            </div>
          </div>

          <div
            v-if="errorMessage"
            class="flex items-start gap-2 bg-red-50 p-3 rounded-xl border border-red-100 text-red-700"
          >
            <span class="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
            <span class="text-sm font-bold">{{ errorMessage }}</span>
          </div>

          <div
            v-if="successMessage"
            class="flex items-start gap-2 bg-green-50 p-3 rounded-xl border border-green-100 text-green-700"
          >
            <span class="material-symbols-outlined text-base mt-0.5 shrink-0">check_circle</span>
            <span class="text-sm font-bold">{{ successMessage }}</span>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            <span v-if="isLoading" class="animate-spin border-2 border-white/30 border-t-white w-5 h-5 rounded-full" />
            {{ isLoading ? 'Sending...' : 'Send Reset Link' }}
          </button>

          <div class="text-center">
            <NuxtLink to="/admin/login" class="text-sm font-bold text-red-600 hover:text-red-700 transition-colors">
              Back to login
            </NuxtLink>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

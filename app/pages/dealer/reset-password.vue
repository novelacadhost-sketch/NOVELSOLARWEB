<script setup lang="ts">
// Where the "Forgot password" email from /dealer/login lands. That email had
// always linked here, but the page did not exist, so a dealer who forgot their
// password hit a 404 and could not get back in.
useHead({ title: 'Reset Dealer Password' })

const supabase = useSupabaseClient()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
// 'checking' while the Supabase client exchanges the code in the link for a
// session; 'expired' when there is none, e.g. an old or already-used link.
const linkState = ref<'checking' | 'ready' | 'expired'>('checking')

onMounted(async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      linkState.value = 'ready'
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  linkState.value = 'expired'
})

const handleResetPassword = async () => {
  errorMessage.value = ''
  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters long.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  isLoading.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) throw error
    // Sign in again with the new password, so the dealer checks run as normal.
    await supabase.auth.signOut()
    successMessage.value = 'Password updated. Taking you to the dealer sign-in…'
    setTimeout(() => navigateTo('/dealer/login'), 1600)
  } catch (error: unknown) {
    errorMessage.value =
      (error as { message?: string })?.message || 'Could not update the password. Please request a new link.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-[80vh] bg-slate-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-10">
        <div
          class="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-blue-100"
        >
          <span class="material-symbols-outlined text-3xl text-[#002888]">lock_reset</span>
        </div>
        <h1 class="text-3xl font-black text-[#002888] tracking-tight">Reset Password</h1>
        <p class="text-slate-500 font-medium mt-2">Choose a new password for your dealer account.</p>
      </div>

      <div class="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 sm:p-10">
        <p v-if="linkState === 'checking'" class="text-center text-sm text-slate-500">Checking your link…</p>

        <div v-else-if="linkState === 'expired'" class="text-center">
          <p class="text-sm text-slate-600">
            This reset link has expired or has already been used. Request a new one from the dealer sign-in page.
          </p>
          <NuxtLink
            to="/dealer/login"
            class="mt-6 inline-block rounded-2xl bg-[#002888] px-6 py-3 text-sm font-black uppercase tracking-widest text-white"
          >
            Dealer sign-in
          </NuxtLink>
        </div>

        <form v-else class="space-y-6" @submit.prevent="handleResetPassword">
          <div>
            <label for="password" class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
              >New Password</label
            >
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="At least 8 characters"
                required
                autocomplete="new-password"
                :disabled="isLoading"
                class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-4 pr-12 text-slate-900 font-medium outline-none focus:border-[#002888]"
              >
              <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <span class="material-symbols-outlined">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>

          <div>
            <label for="confirm-password" class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
              >Confirm Password</label
            >
            <input
              id="confirm-password"
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Type it again"
              required
              autocomplete="new-password"
              :disabled="isLoading"
              class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 text-slate-900 font-medium outline-none focus:border-[#002888]"
            >
          </div>

          <p v-if="errorMessage" class="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
            {{ errorMessage }}
          </p>
          <p
            v-if="successMessage"
            class="rounded-xl border border-green-100 bg-green-50 p-3 text-sm font-bold text-green-700"
          >
            {{ successMessage }}
          </p>

          <button
            type="submit"
            :disabled="isLoading || Boolean(successMessage)"
            class="w-full bg-[#002888] text-white py-4 rounded-2xl font-black uppercase tracking-widest disabled:opacity-50"
          >
            {{ isLoading ? 'Updating…' : 'Save new password' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

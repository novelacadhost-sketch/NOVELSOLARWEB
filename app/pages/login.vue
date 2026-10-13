<script setup lang="ts">
const site = useSite()
const email = ref('')
const isSuccess = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const supabase = useSupabaseClient()
const {
  public: { baseUrl },
} = useRuntimeConfig()

const handleLogin = async () => {
  if (!email.value) {
    errorMessage.value = 'Please enter your email address.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  isSuccess.value = false

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.value,
      options: {
        // Uses the configured public URL so the magic link works on the live
        // site regardless of whether localhost is running.
        // /confirm handles the PKCE token exchange before redirecting to /account.
        emailRedirectTo: baseUrl + '/confirm',
      },
    })

    if (error) throw error

    isSuccess.value = true
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to send login link. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const resetLogin = () => {
  isSuccess.value = false
  email.value = ''
}

useHead({
  title: 'Sign In',
  meta: [
    { name: 'description', content: `Sign in to your ${site.name} account to view orders and manage your profile.` },
  ],
})
</script>

<template>
  <div class="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4 py-12">
    <div class="max-w-md w-full">
      <!-- Logo / Back Link -->
      <div class="text-center mb-8">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 text-slate-400 hover:text-[#3c59b0] transition-colors group mb-6"
        >
          <span class="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-1"
            >arrow_back</span
          >
          <span class="text-sm font-bold uppercase tracking-widest">Back to Home</span>
        </NuxtLink>
        <h1 class="text-3xl font-black text-[#3c59b0] tracking-tight">{{ site.name }}</h1>
      </div>

      <!-- Main Login Card -->
      <div
        class="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 md:p-10 relative overflow-hidden"
      >
        <!-- Progress Bar (Subtle) -->
        <div class="absolute top-0 left-0 w-full h-1 bg-slate-50">
          <div
            class="h-full bg-[#a9001d] transition-all duration-500 ease-out"
            :style="{ width: isSuccess ? '100%' : '50%' }"
          />
        </div>

        <!-- Magic Link Flow -->
        <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div v-if="!isSuccess">
            <div class="mb-8">
              <h2 class="text-2xl font-bold text-slate-900 mb-2">Sign In to Your Account</h2>
              <p class="text-slate-500 font-medium">
                Enter your email and we'll send you a magic link. No password needed — and you don't need an account to
                shop.
              </p>
            </div>

            <form class="space-y-6" @submit.prevent="handleLogin">
              <div>
                <label class="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Email Address</label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400"
                    >mail</span
                  >
                  <input
                    v-model="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                    class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-medium outline-none focus:border-[#3c59b0] focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                    :disabled="isLoading"
                  />
                </div>
                <p class="text-[11px] text-slate-400 mt-2 font-medium">
                  If you don't have an account, we will securely create one for you.
                </p>
              </div>

              <p
                v-if="errorMessage"
                class="text-[#a9001d] text-sm font-bold flex items-start gap-2 bg-red-50 p-3 rounded-xl border border-red-100"
              >
                <span class="material-symbols-outlined text-base flex-shrink-0 mt-0.5">error</span>
                <span>{{ errorMessage }}</span>
              </p>

              <button
                type="submit"
                :disabled="isLoading"
                class="w-full bg-[#3c59b0] text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span
                  v-if="isLoading"
                  class="animate-spin border-2 border-white/30 border-t-white w-4 h-4 rounded-full"
                />
                {{ isLoading ? 'Sending Link...' : 'Send Magic Link' }}
                <span v-if="!isLoading" class="material-symbols-outlined text-lg">bolt</span>
              </button>
            </form>
          </div>

          <!-- Success State -->
          <div v-else class="text-center py-4">
            <div
              class="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <span class="material-symbols-outlined text-3xl">mark_email_read</span>
            </div>
            <h2 class="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h2>
            <p class="text-slate-500 font-medium mb-8">
              We've sent a magic login link to <br />
              <span class="text-[#3c59b0] font-bold">{{ email }}</span
              >.
            </p>
            <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-8">
              <p class="text-xs text-slate-400 font-medium italic">
                Click the button in the email to log in securely. You can close this window now.
              </p>
            </div>
            <button
              class="text-sm font-bold text-[#3c59b0] hover:underline uppercase tracking-widest"
              @click="resetLogin"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>

      <!-- Help Text -->
      <p class="text-center mt-8 text-slate-400 text-xs font-medium">
        Having trouble? <a href="#" class="text-[#3c59b0] font-bold hover:underline">Contact Support</a>
      </p>
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

input::placeholder {
  letter-spacing: normal;
}
</style>

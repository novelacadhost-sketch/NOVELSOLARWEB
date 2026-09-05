// https://nuxt.com/docs/api/configuration/nuxt-config

// Allowed iframe ancestors for the Bitrix24 portal embed. Modern browsers
// drive this off CSP `frame-ancestors`; X-Frame-Options is set to SAMEORIGIN
// only as a defensive default and is overridden per-route below for embeds.
const BITRIX_FRAME_ANCESTOR = process.env.BITRIX_FRAME_ANCESTOR || 'https://*.bitrix24.com'
const FRAME_ANCESTORS = `'self' ${BITRIX_FRAME_ANCESTOR}`

// One canonical name per value. The previous six-deep fallback chains resolved
// URL and key independently, so a leftover alias from an old project could pair
// a new URL with a stale key — a mismatch that surfaces as a generic auth error
// rather than a config error. If a deprecated alias is set and the canonical
// name is not, fail here with the rename rather than silently using it.
const DEPRECATED_SUPABASE_ALIASES: Record<string, string> = {
  SUPABASE_URL: 'NUXT_PUBLIC_SUPABASE_URL',
  NUXT_PUBLIC_SUPABASE_KEY: 'NUXT_PUBLIC_SUPABASE_ANON_KEY',
  NEXT_PUBLIC_SUPABASE_URL: 'NUXT_PUBLIC_SUPABASE_URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'NUXT_PUBLIC_SUPABASE_ANON_KEY',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'NUXT_PUBLIC_SUPABASE_ANON_KEY',
  SUPABASE_ANON_KEY: 'NUXT_PUBLIC_SUPABASE_ANON_KEY',
  SUPABASE_PUBLISHABLE_KEY: 'NUXT_PUBLIC_SUPABASE_ANON_KEY',
  SUPABASE_SECRET_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
}

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || ''

// The canonical public address, used for BOTH the sitemap/canonical tags and
// every link the server builds (dealer onboarding, password resets, emails).
// These were previously separate hardcoded values that disagreed with each
// other. Default is the eventual production domain; staging overrides it via
// NUXT_PUBLIC_BASE_URL, so the cutover is an env change with no code edit.
const PRODUCTION_URL = 'https://novelsolar.com'
const SITE_URL = (process.env.NUXT_PUBLIC_BASE_URL || PRODUCTION_URL).replace(/\/$/, '')
const IS_PRODUCTION_DOMAIN = SITE_URL === PRODUCTION_URL

for (const [alias, canonical] of Object.entries(DEPRECATED_SUPABASE_ALIASES)) {
  if (!process.env[alias]) continue

  if (!process.env[canonical]) {
    throw new Error(
      `Supabase config: "${alias}" is set but "${canonical}" is not. ` +
        `This app reads only "${canonical}". Rename it.`,
    )
  }

  // Canonical wins, so this is safe — but a leftover alias is how a stale
  // value from a previous project survives a migration unnoticed.
  console.warn(
    `[supabase config] "${alias}" is set and ignored ("${canonical}" takes precedence). Delete the stale alias.`,
  )
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  srcDir: 'app',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/image',
    '@vueuse/nuxt',
    '@nuxt/content',
    '@nuxtjs/sitemap',
    '@nuxtjs/supabase',
  ],
  site: {
    url: SITE_URL,
    name: 'Novel Solar',
  },
  sitemap: {
    strictNuxtContentPaths: true,
    exclude: [
      '/admin/**', // Keep the admin dashboard out of Google
      '/checkout',
      '/thank-you',
    ],
  },
  image: {
    domains: ['nisl.bitrix24.com', 'res.cloudinary.com'],
    format: ['webp', 'avif'],
    quality: 80,
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536,
    },
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Novel Solar: Leading Solar Energy Company in Nigeria - novelsolar',
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block',
        },
      ],
    },
  },
  runtimeConfig: {
    cronSecret: process.env.CRON_SECRET,
    bitrixWebhookUrl: process.env.BITRIX_WEBHOOK_URL,
    otpSecret: process.env.OTP_SECRET,
    authSessionSecret: process.env.AUTH_SESSION_SECRET,
    bitrixApplicationToken: process.env.BITRIX_APPLICATION_TOKEN,
    bitrixHandlerToken: process.env.BITRIX_HANDLER_TOKEN,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpFrom: process.env.SMTP_FROM,
    blogGithubToken: process.env.BLOG_GITHUB_TOKEN,
    blogGithubOwner: process.env.BLOG_GITHUB_OWNER || 'dev-davies',
    blogGithubRepo: process.env.BLOG_GITHUB_REPO || 'NovelSolar',
    blogGithubBranch: process.env.BLOG_GITHUB_BRANCH || 'master',
    bitrixClientId: process.env.BITRIX_CLIENT_ID,
    bitrixClientSecret: process.env.BITRIX_CLIENT_SECRET,
    public: {
      whatsappNumber: process.env.NUXT_PUBLIC_WHATSAPP_NUMBER || '2348022119908',
      whatsappNumberFormatted: process.env.NUXT_PUBLIC_WHATSAPP_NUMBER_FORMATTED || '+234 802 211 9908',
      baseUrl: SITE_URL,
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_KEY,
    },
  },
  supabase: {
    url: SUPABASE_URL,
    key: SUPABASE_KEY,
    // Disable the module's global redirect so unauthenticated users can
    // freely browse the shop and checkout. Auth is only enforced on
    // /admin pages via the custom admin middleware.
    redirect: false,
  },
  // Allow the Bitrix24 portal to embed any page of the app in an iframe.
  // X-Frame-Options is intentionally NOT set: the spec only supports DENY /
  // SAMEORIGIN / ALLOW-FROM, and ALLOW-FROM is ignored by Chrome/Edge/Safari,
  // so any value here would either block the embed or do nothing useful.
  // Modern browsers honour CSP `frame-ancestors` instead, which supports
  // multiple origins and wildcards.
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': `frame-ancestors ${FRAME_ANCESTORS}`,
        // Staging runs on a public vercel.app URL. Without this it gets
        // crawled and competes with the live site for the same content.
        // Self-disabling: once NUXT_PUBLIC_BASE_URL is the production
        // domain, the header stops being sent.
        ...(IS_PRODUCTION_DOMAIN ? {} : { 'X-Robots-Tag': 'noindex, nofollow' }),
      },
    },
  },
  nitro: {
    experimental: { tasks: true },
    // The product sync is awaited (see trigger-sync.post.ts) and caps its own
    // Bitrix fetch at 30s, so the function must outlive the default timeout.
    vercel: {
      functions: {
        maxDuration: 60,
      },
    },
    scheduledTasks: {
      '0 18 * * *': ['sync:products'],
    },
    storage: {
      // Rate limiting uses memory in dev, Vercel KV in production if available
      rateLimit: {
        driver: process.env.NODE_ENV === 'production' && process.env.KV_REST_API_URL ? 'vercel-kv' : 'memory',
      },
      // OTP codes use memory in dev, Vercel KV in production if available
      otp: {
        driver: process.env.NODE_ENV === 'production' && process.env.KV_REST_API_URL ? 'vercel-kv' : 'memory',
      },
      // Sessions are now stored in Supabase — these drivers are no longer used
    },
  },
})

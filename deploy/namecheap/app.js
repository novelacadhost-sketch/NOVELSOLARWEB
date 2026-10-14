// Startup file for the Namecheap (cPanel "Setup Node.js App") deployment.
//
// The host loads this with require(); Nitro's server is an ES module, hence
// the dynamic import at the bottom.
//
// The build runs on GitHub without any secrets, so runtimeConfig is empty.
// Secrets live in an env file on the server, outside the app folder so a
// deploy never touches it, written with the same names Vercel uses.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const envFile = process.env.APP_ENV_FILE || path.join(os.homedir(), 'novelsolar-staging.env')
if (!fs.existsSync(envFile)) {
  throw new Error(`Env file not found: ${envFile}`)
}
process.loadEnvFile(envFile)
process.env.NODE_ENV ||= 'production'

// Nitro only overrides runtimeConfig from NUXT_-prefixed names at runtime, so
// a plain name like BITRIX_WEBHOOK_URL is invisible to useRuntimeConfig()
// unless copied across. Mirrors runtimeConfig in nuxt.config.ts and the
// @nuxtjs/supabase module's keys; a key added there must be added here.
const RUNTIME_NAMES = {
  CRON_SECRET: 'NUXT_CRON_SECRET',
  BITRIX_WEBHOOK_URL: 'NUXT_BITRIX_WEBHOOK_URL',
  OTP_SECRET: 'NUXT_OTP_SECRET',
  BITRIX_APPLICATION_TOKEN: 'NUXT_BITRIX_APPLICATION_TOKEN',
  BITRIX_HANDLER_TOKEN: 'NUXT_BITRIX_HANDLER_TOKEN',
  SMTP_HOST: 'NUXT_SMTP_HOST',
  SMTP_PORT: 'NUXT_SMTP_PORT',
  SMTP_USER: 'NUXT_SMTP_USER',
  SMTP_PASS: 'NUXT_SMTP_PASS',
  SMTP_FROM: 'NUXT_SMTP_FROM',
  SMTP_FROM_HOMES: 'NUXT_SMTP_FROM_HOMES',
  PAYSTACK_SECRET_KEY: 'NUXT_PAYSTACK_SECRET_KEY',
  STOCK_REQUEST_NOTIFY_USER_IDS: 'NUXT_STOCK_REQUEST_NOTIFY_USER_IDS',
  PAYSTACK_PUBLIC_KEY: 'NUXT_PUBLIC_PAYSTACK_PUBLIC_KEY',
  // @nuxtjs/supabase: public.supabase.key and supabase.secretKey.
  NUXT_PUBLIC_SUPABASE_ANON_KEY: 'NUXT_PUBLIC_SUPABASE_KEY',
  SUPABASE_SERVICE_ROLE_KEY: 'NUXT_SUPABASE_SECRET_KEY',
}
for (const [plain, nuxt] of Object.entries(RUNTIME_NAMES)) {
  if (process.env[plain] && !process.env[nuxt]) process.env[nuxt] = process.env[plain]
}

import(pathToFileURL(path.join(__dirname, '.output', 'server', 'index.mjs')).href).catch((error) => {
  console.error(error)
  process.exit(1)
})

import { logger } from '../utils/logger'

/**
 * Validates environment configuration once, at server start.
 *
 * Without this, a missing variable surfaces as a generic 500 at request time —
 * or, for the degrading ones, as nothing at all until a customer reports that
 * an email never arrived. Both are far more expensive to diagnose than a
 * startup failure that names the variable.
 */

// Nothing works without these; failing fast beats serving a broken site.
const REQUIRED = [
  'NUXT_PUBLIC_SUPABASE_URL',
  'NUXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AUTH_SESSION_SECRET',
] as const

// The site still serves without these, but a specific feature is dead.
const DEGRADES: Record<string, string> = {
  BITRIX_WEBHOOK_URL: 'product sync, checkout, and all lead capture',
  CRON_SECRET: 'scheduled product sync and the staleness-bypass resync',
  OTP_SECRET: 'admin MFA',
  SMTP_HOST: 'all outbound email',
  SMTP_PORT: 'all outbound email',
  SMTP_USER: 'all outbound email',
  SMTP_PASS: 'all outbound email',
  SMTP_FROM: 'all outbound email',
  CLOUDINARY_CLOUD_NAME: 'product image uploads',
  CLOUDINARY_API_KEY: 'product image uploads',
  CLOUDINARY_API_SECRET: 'product image uploads',
  BLOG_GITHUB_TOKEN: 'blog publishing (/api/admin/blog/* throws 500)',
  BITRIX_APPLICATION_TOKEN: 'inbound Bitrix webhook verification (allows unverified requests)',
}

export default defineNitroPlugin(() => {
  const missingRequired = REQUIRED.filter((k) => !process.env[k]?.trim())
  const missingOptional = Object.keys(DEGRADES).filter((k) => !process.env[k]?.trim())

  if (missingOptional.length) {
    logger.warn('Env Check', `${missingOptional.length} optional variable(s) unset — features disabled`, {
      missing: missingOptional.map((k) => `${k} → ${DEGRADES[k]}`),
    })
  }

  // Setting the token without the owner/repo pair silently targets the
  // upstream repo (dev-davies/NovelSolar) rather than this fork.
  if (process.env.BLOG_GITHUB_TOKEN && !(process.env.BLOG_GITHUB_OWNER && process.env.BLOG_GITHUB_REPO)) {
    logger.warn(
      'Env Check',
      'BLOG_GITHUB_TOKEN is set but BLOG_GITHUB_OWNER/BLOG_GITHUB_REPO are not — blog publishing will target the default dev-davies/NovelSolar, not this repository.',
    )
  }

  if (missingRequired.length) {
    logger.error('Env Check', 'Missing required environment variables — the app cannot function', {
      missing: missingRequired,
    })
    throw new Error(
      `Missing required environment variable(s): ${missingRequired.join(', ')}. ` +
        `Set them in the deployment environment and redeploy.`,
    )
  }

  logger.info('Env Check', 'Environment OK', {
    required: REQUIRED.length,
    optionalMissing: missingOptional.length,
  })
})

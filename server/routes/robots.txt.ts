import { siteUrlFor } from '../utils/site'

/**
 * Per-site robots.txt, so each domain points crawlers at its own sitemap.
 * Replaces public/robots.txt, which allowed everything and named no sitemap.
 *
 * This does not decide whether a host is indexed at all: staging is kept out
 * by the X-Robots-Tag header in nuxt.config.ts.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /checkout',
    'Disallow: /thank-you',
    'Disallow: /account',
    'Disallow: /orders',
    '',
    `Sitemap: ${siteUrlFor(event)}/sitemap.xml`,
    '',
  ].join('\n')
})

import { SITES, siteIdForHost, type SiteConfig } from '#shared/sites'

/**
 * Which storefront this page is, from the hostname — the same rule the server
 * enforces with (server/middleware/0.site.ts), so SSR and the browser agree.
 */
export function useSite(): SiteConfig {
  return SITES[siteIdForHost(useRequestURL().host)]
}

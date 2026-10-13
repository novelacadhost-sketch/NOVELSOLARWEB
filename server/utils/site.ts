import type { H3Event } from 'h3'
import { SITES, siteIdForHost, type SiteConfig, type SiteId } from '#shared/sites'

export function getSite(event: H3Event): SiteConfig {
  const id = (event.context.siteId as SiteId | undefined) ?? siteIdForHost(getRequestHost(event, { xForwardedHost: true }))
  return SITES[id] ?? SITES.solar
}

/** A site id read back from stored data (outbox payload, Paystack metadata). */
export function siteFromStored(value: unknown): SiteConfig {
  return value === 'homes' ? SITES.homes : SITES.solar
}

/** Paystack hands metadata back as an object or, sometimes, a JSON string. */
export function siteFromPaystackMetadata(metadata: unknown): SiteConfig {
  let meta = metadata
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta)
    } catch {
      meta = null
    }
  }
  return siteFromStored((meta as { site?: unknown } | null)?.site)
}

/**
 * The address to put in links built for this request: emails, the Paystack
 * return URL. Novel Solar keeps NUXT_PUBLIC_BASE_URL, as before. Home Essentials
 * uses the host it was reached on, so staging and production both link back to
 * themselves — the host only resolved to this site because it is one of ours.
 */
export function siteUrlFor(event: H3Event): string {
  const site = getSite(event)
  if (site.id === 'solar') return String(useRuntimeConfig().public.baseUrl).replace(/\/$/, '')

  const host = getRequestHost(event, { xForwardedHost: true })
  if (!host) return site.canonicalUrl
  const local = /^(?:localhost|127\.|homes\.localhost)/.test(host)
  return `${local ? 'http' : 'https'}://${host}`
}

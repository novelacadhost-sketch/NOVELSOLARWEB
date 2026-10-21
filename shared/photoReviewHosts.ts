/**
 * Where the supplier photo-review tool is allowed to exist.
 *
 * Shared because the rule has to hold in two places: the server endpoints and
 * the page itself. Gating only the endpoints would still leave the page
 * rendering on the customer site, asking a visitor for their name before
 * failing -- so both import this.
 *
 * Staging and Vercel production deploy from the same branch, so this list is
 * the whole of what keeps a scratch tool off novelsolar.com.
 */
const ALLOWED = ['staging.novelsolar.com']

export function photoReviewHostAllowed(host: string | undefined | null): boolean {
  const bare = String(host || '')
    .toLowerCase()
    .split(':')[0]
  if (!bare) return false
  if (ALLOWED.includes(bare)) return true
  return bare === 'localhost' || bare === '127.0.0.1' || bare.endsWith('.localhost')
}

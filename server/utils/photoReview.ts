import type { H3Event } from 'h3'
import { photoReviewHostAllowed } from '#shared/photoReviewHosts'

/**
 * The bulk photo review tool: a temporary internal page shared with the
 * suppliers who sent the product photos, so they can say which product each
 * picture belongs to.
 *
 * Two gates, both required.
 *
 * HOST. Staging and Vercel production both deploy from master, so shipping
 * this at all ships it everywhere. The page and its endpoints answer 404 on
 * any host but staging (and localhost, for development), which is what keeps a
 * supplier-facing scratch tool off the customer site. A 404 rather than a 403:
 * there is no reason to confirm the route exists.
 *
 * TOKEN. An external supplier has no account, so the link carries a shared
 * secret. It gates reading the catalogue and writing answers, nothing else --
 * the tool cannot change a product, a price or an order, and the worst a
 * leaked link allows is a wrong answer in a review table that is reconciled by
 * hand before any photo is uploaded.
 */
/** Throws 404 unless this request may use the review tool. */
export function assertPhotoReviewAccess(event: H3Event): void {
  const notFound = () => createError({ statusCode: 404, statusMessage: 'Not found' })

  if (!photoReviewHostAllowed(getRequestHost(event, { xForwardedHost: true }))) throw notFound()

  const { photoReviewToken } = useRuntimeConfig()
  // Unset means off. A tool that waves everyone through when its secret is
  // missing is the failure mode this project has been bitten by before.
  if (!photoReviewToken) throw notFound()

  const supplied = String(getQuery(event).k || getHeader(event, 'x-review-token') || '')
  if (supplied !== photoReviewToken) throw notFound()
}

import { HOMES_CATEGORY_GROUPS } from '~/utils/productCategories'

/**
 * Novel Home Essentials shares this app's pages but not all of them: the load
 * calculator, solar services, partner brands, blog and the solar company pages
 * belong to Novel Solar. Anything not listed here sends a Home Essentials
 * visitor to its homepage rather than into a solar page under the wrong name.
 */
const HOMES_PATHS = [
  /^\/$/,
  /^\/shop(\/.*)?$/,
  /^\/checkout$/,
  /^\/thank-you$/,
  /^\/account$/,
  /^\/orders(\/[^/]+)?$/,
  /^\/login$/,
  /^\/confirm$/,
  /^\/404$/,
  /^\/(privacy|terms|returns|delivery)$/,
  // Staff codes apply on both sites.
  /^\/staffreferral(\/.*)?$/,
  // Dealer pricing applies on both sites, so dealers sign in here too.
  /^\/dealer\/(login|setup-account)$/,
  /^\/admin(\/.*)?$/,
]

export default defineNuxtRouteMiddleware((to) => {
  if (useSite().id !== 'homes') return

  const path = to.path.replace(/\/+$/, '') || '/'
  if (HOMES_PATHS.some((pattern) => pattern.test(path))) return

  const category = path.match(/^\/category\/([^/]+)$/)?.[1]
  if (category && HOMES_CATEGORY_GROUPS.some((g) => g.id === category)) return

  return navigateTo('/', { redirectCode: 302 })
})

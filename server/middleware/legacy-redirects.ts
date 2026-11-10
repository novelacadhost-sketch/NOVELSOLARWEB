/**
 * Old WordPress addresses, kept working after novelsolar.com moved to this app.
 *
 * Here rather than as routeRules redirects: on Vercel each routeRule path
 * becomes its own function directory, and `/x` and `/x/` map to the same one,
 * which failed the build (EEXIST on powerchinastore.func). WordPress links end
 * in a slash, so both spellings have to work.
 */
const LEGACY_REDIRECTS: Record<string, string> = {
  '/powerchina': '/partners/powerchina',
  '/powerchinastore': '/partners/powerchina/shop',
}

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]!.replace(/\/+$/, '').toLowerCase()
  const to = LEGACY_REDIRECTS[path]
  if (to) return sendRedirect(event, to, 301)
})

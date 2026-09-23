/**
 * The app's payment bridge lives at /payment-complete.html, a static file in
 * public/. Static files are served at their exact filename only, so the bare
 * /payment-complete — the address people actually type — was a 404.
 *
 * This forwards it to the real page with the query string intact, since the
 * verified result travels in `?payment=&ref=`. The payment callback itself
 * still redirects straight to the .html form, so the app never depends on this.
 */
export default defineEventHandler((event) => {
  return sendRedirect(event, `/payment-complete.html${getRequestURL(event).search}`, 302)
})

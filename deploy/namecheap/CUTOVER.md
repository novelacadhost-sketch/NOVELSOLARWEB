# Cutover: novelsolar.com from WordPress to Nuxt — Sunday 1 November 2026

The Nuxt app replaces the WordPress site at `https://novelsolar.com`, on the same Namecheap
account that serves WordPress today. Staging (`https://staging.novelsolar.com`) has run there since
14 October; see [README.md](README.md) for how deploys work.

Owners: **Davies**, **Blessing** (Flutter app), **Claude** (changes made in a coding session with
Davies).

## What is already true

- **No DNS change is needed.** `novelsolar.com`, `www` and `staging` all point at the same server
  (162.213.251.196). Do not touch nameservers or the zone.
- **Email is unaffected.** MX is `novelsolar.com` on this cPanel account; mailboxes live outside
  the website folder.
- **The domain's document root cannot move.** It is `~/public_html`, the cPanel main domain.
- **Any file left in `public_html` is served directly and skips the app** — tested on staging:
  a file, a folder's `index.html`, or a leftover `index.php` all win over the Nuxt route. So
  WordPress must leave `public_html`, not just be switched off.
- **Four other sites live inside `public_html`**: `sunluxsolar.com`, `novelhomesng.com`,
  `reset.novelsolar.com`, `intranet.novelsolar.com`. They inherit `public_html/.htaccess`, which
  is where cPanel will write the Node app's settings.
- WordPress publishes 187 products, 40 blog posts, 55 pages, 57 product categories and ~165 tag,
  category, author and template URLs. Google has those URLs; each needs a 301 or it becomes a 404.
- The Nuxt build bakes in its address: production must be built with
  `NUXT_PUBLIC_BASE_URL=https://novelsolar.com`, or it tells search engines not to index the site.

## Now — security

- [ ] **Davies:** the web-folder clean-up and password changes found on 14 October. The details
  are kept out of this public repository until they are done.

## By Wednesday 21 October

- [ ] **Blessing:** point the app at `https://staging.novelsolar.com` (see MOBILE-API.md, "The API
  base"). Test sign-in, catalogue and dealer prices, cart, checkout with pay-at-store and a
  Paystack test card, enquiry forms, order history. Report anything that differs from Vercel.
- [ ] **Davies:** Supabase → Authentication → URL Configuration → add redirect URLs
  `https://staging.novelsolar.com/**` and `https://novelsolar.com/**`. Leave the Site URL alone
  until cutover day.
- [ ] **Davies:** decide the 40 WordPress blog posts: import them into the Nuxt blog (Claude can
  convert them to markdown), redirect them all to `/blog`, or a mix.
- [ ] **Davies:** live Paystack keys for production (staging keeps test keys).

## By Saturday 24 October

- [ ] **Claude:** redirect map for every WordPress URL, served as 301s by the app. Products are
  matched to Bitrix products by name, reviewed by Davies on a page like the photo review, the
  same way the photos were matched. Categories go to the closest `/category/...`, pages to their
  Nuxt equivalent, and tags, authors and archives to `/blog` or `/shop`.
- [ ] **Claude:** production deploy job (app folder `~/novelsolar-production`, env file
  `~/novelsolar-production.env`, built for `https://novelsolar.com`), off until cutover.
- [ ] **Davies + Claude:** move the four nested sites' document roots out of `public_html`
  (cPanel → Domains → each domain → document root) to e.g. `~/sites/<domain>`, and check each
  loads exactly as before. Done a week early so a problem there is not tangled up with the
  cutover.
- [ ] **Claude:** dry run on staging with production settings: the redirect map, a production
  build, and the `www` → bare-domain redirect.

## Friday 30 October

- [ ] **Davies:** create `~/novelsolar-production.env` (copy of the staging file, with
  `NUXT_PUBLIC_BASE_URL=https://novelsolar.com`, live Paystack keys, Unix line endings, 600).
- [ ] **Davies:** full WordPress backup: Softaculous backup (files + database) plus a cPanel
  database download, copied off the server. The latest Softaculous one is from 5 October.
- [ ] **Davies:** content freeze on WordPress from here.
- [ ] **Blessing:** app build pointing at `https://novelsolar.com` ready to release once the
  site is live.

## Sunday 1 November — cutover

Pick a quiet hour. Until step 3, nothing customers see has changed.

1. **Claude:** run the production deploy into `~/novelsolar-production`; start it.
2. **Claude:** move WordPress and every leftover file out of `public_html` into
   `~/wordpress-archive/` (keep `.well-known`, `cgi-bin` and the `google…html` verification file).
3. **Claude:** create the Node app for `novelsolar.com` pointing at `~/novelsolar-production`
   (`cloudlinux-selector create … --domain novelsolar.com`, with
   `APP_ENV_FILE=$HOME/novelsolar-production.env`). The site is now Nuxt.
4. **Claude — check:** home, shop, a product, checkout page, blog, sitemap, robots (must allow
   indexing), 20 sampled old WordPress URLs redirect correctly, `www` redirects, admin sign-in.
5. **Davies — repoint the services that call Vercel:**
   - Paystack dashboard → webhook URL `https://novelsolar.com/api/payments/paystack/webhook`
   - Bitrix outbound webhook → `https://novelsolar.com/api/bitrix/handler?t=…` (with the new
     handler token, see step 6)
   - Bitrix local app (iframe embed) handler and install URLs, if they name Vercel
   - Supabase → Site URL `https://novelsolar.com`
   - Google Search Console → submit `https://novelsolar.com/sitemap.xml`
6. **Davies + Claude:** rotate the Bitrix webhook URL and `BITRIX_HANDLER_TOKEN` (deferred to
   go-live), update both env files and Vercel, restart.
7. **Claude:** point the GitHub product-sync and order-queue jobs at `https://novelsolar.com`
   (`SYNC_URL`, `DRAIN_URL` repo variables) and run each once by hand.
8. **Davies:** one real pay-at-store order end to end (deal appears in Bitrix), then delete it.
9. **Blessing:** release the app build that points at `https://novelsolar.com`.

### Rollback

If the site is broken and not fixable within the hour: Claude removes the Node app for
`novelsolar.com` and moves `~/wordpress-archive/` back into `public_html`. WordPress is then
back as it was; nothing else in steps 1–4 touches it. Undo steps 5–7 only if they were done.

## After

- [ ] **Week of 2 November:** watch the error alerts and Search Console for 404s; add redirects
  for anything missed.
- [ ] **Keep Vercel running until Sunday 29 November** so older app builds keep working, then
  remove the project. Before then, change its `NUXT_PUBLIC_BASE_URL` to `https://novelsolar.com`
  so any link it still sends points at the live site.
- [ ] Decide whether staging keeps deploying on every push to master once production does too.
- [ ] Novel Home Essentials (`novelhomeessentials.com`, launching November) is served by this same
  app: add it as an addon domain pointing at `~/novelsolar-production`, rather than on Vercel.
- [ ] Retire the WooCommerce sync plugin and the old Softaculous WordPress backups once nobody
  needs them.

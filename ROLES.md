# Roles & Authentication

The thing to understand first: **there is no single "role" field in this app.** There are
two independent identity systems, each with its own cookie, its own storage, and its own
check. A person can hold both at once, and knowing one tells you nothing about the other.

| System | Cookie | Source of truth | Grants |
| --- | --- | --- | --- |
| **Admin** | `admin_token` | `admin_profiles` table | The `/admin` console and `/api/admin/*` |
| **Customer / Dealer** | `sb-<project-ref>-auth-token` | `profiles.role` + `profiles.dealer_status` | Storefront login; dealer pricing |
| **Bitrix portal user** | — | — | **Removed 2026-09-14.** See §3. |
| **`auth_token` customer session** | — | — | **Removed 2026-09-14.** See §4. |

There were four. Two were removed on the same day, both for the same reason: they predated
Supabase Auth and had been superseded without being deleted.

An admin is **not** a row in `profiles`. A dealer is **not** a row in `admin_profiles`. The two
never consult each other.

---

## 1. Admin

### Becoming one

A master admin creates them via `/api/admin/create-admin`, which does two things:

1. Creates a Supabase Auth user (so a password exists)
2. Inserts a row into **`admin_profiles`** — `user_id`, `admin_username`, `is_master`

Both are required. A Supabase Auth user with no `admin_profiles` row is not an admin.

### How it's checked

`server/api/admin/auth/login.post.ts` verifies the password through Supabase Auth, then
**separately** confirms an `admin_profiles` row exists. Password valid but no row → `403 This
account does not have admin access.`

On success it mints a random opaque token (`admin_session_<uuid>`), stores it in the
**`admin_sessions`** table with a 24-hour expiry, and sets it as the `admin_token` cookie.

`server/middleware/adminGuard.ts` then protects every `/api/admin/*` route except
`/api/admin/auth/*`. It looks the cookie up in `admin_sessions` and attaches
`event.context.admin = { user_id, email }`.

> This deliberately does **not** use Supabase's own session. Supabase Auth is only a password
> checker here; the admin session is entirely our own.

### `is_master`

A boolean on `admin_profiles`. There is no middleware for it — **each endpoint checks it
itself**, by re-reading `admin_profiles` for `event.context.admin.user_id`:

```ts
const { data: currentAdmin } = await supabase
  .from('admin_profiles').select('is_master').eq('user_id', event.context.admin.user_id).single()
if (!currentAdmin?.is_master) throw createError({ statusCode: 403, ... })
```

Enforced in `create-admin`, `delete-admin`, and `list-admins`. **If you add an endpoint that
manages admins, you must add this check yourself — nothing does it for you.**

### Client side

`app/middleware/admin.ts` runs on 11 admin pages. It only pings `/api/admin/auth/verify` and
redirects to `/admin/login` on a 401. It is a **UX redirect, not a security boundary** — it runs
client-side only. The real enforcement is `adminGuard` on the server.

---

## 2. Customer and Dealer

Both are the same Supabase Auth session; the difference is two columns on `profiles`.

```
profiles.role         text, default 'customer'
profiles.dealer_status dealer_status_enum: 'none' | 'pending' | 'approved' | 'rejected'
```

**A dealer is `role = 'dealer'` AND `dealer_status = 'approved'`. Both, always.** A rejected or
pending application still has `role = 'dealer'`, so checking `role` alone grants dealer pricing
to people who were turned down.

The single place this is decided is `server/utils/dealerCheck.ts`:

```ts
resolveIsDealerFromEvent(event) -> boolean
```

Called by `checkout.post.ts`, `inventory.get.ts`, `products.ts`, and inline equivalents in
`product/[id].ts` and `itel-products.ts`. **Use this function — do not re-implement the check.**

It **fails closed**: any error, missing session, or unreadable profile returns `false`, i.e.
retail pricing. That is the safe direction, but it means a bug here is silent — the customer
just sees the normal price. See the gotchas.

### How someone becomes a dealer

`/partners/become-a-dealer` → `dealer_applications` row → an admin approves via
`/api/admin/approve-dealer`, which creates the Auth user, sets `profiles.role = 'dealer'`,
`dealer_status = 'approved'`, and emails a 48-hour onboarding token. The dealer sets their own
password at `/dealer/setup-account?token=…`, then logs in at `/dealer/login`.

`/api/dealer/auth/login` signs them in **and then re-checks** role and status, calling
`signOut()` immediately if they don't qualify.

There is **no route middleware on `/dealer/*`.** Those pages aren't gated client-side; the
server decides what data and prices a request receives. After login a dealer lands on `/` and
simply sees dealer prices.

---

## 3. Bitrix portal user — removed

There used to be a third system here: the `bitrix_session` cookie and the `auth_sessions` table
held a per-user Bitrix24 OAuth token, so REST calls could be made *as the portal user who opened
the iframe*. It predated Supabase Auth.

**Removed on 2026-09-14.** It was dead weight: `auth_sessions` never held a single row on this
project, so every Bitrix call already fell through to the service webhook, and the OAuth branch
had two faults waiting to fire — it never checked `expires_at`, and the `refreshBitrixToken()`
it would have needed was defined but never called. Had the install ever succeeded, the first
portal user would have had roughly one working hour followed by silent failures.

All Bitrix REST calls now go through `bitrixFetch()` in `server/utils/bitrixAuth.ts`, as the
service webhook. `server/api/bitrix/handler.ts` still handles the install callback — it just uses
the token to register event handlers and pick a redirect, and stores nothing.

If per-user Bitrix attribution is ever wanted, build it deliberately; don't revive this.

---

## 4. The other customer cookie: `auth_token` — removed

`server/utils/userSession.ts` held an HMAC-signed customer session in `user_sessions` behind an
`auth_token` cookie. It was never a second **login** — `/api/auth/session` required a valid
Supabase session before issuing one. What it actually stored was a single fact: *which Bitrix
CRM contact this customer is.*

**Removed on 2026-09-14.** That fact is a permanent property of the user, not of a session, and
`profiles.bitrix_contact_id` already existed for it — with an index — read by nothing. A third
copy, the `bitrix_contact_links` table, existed too and had never been touched by any code.

The link now resolves through `resolveBitrixContactId()` in `server/utils/bitrixContact.ts`:
read `profiles.bitrix_contact_id` by `user_id`; if empty, find-or-create the CRM contact by
email and write it back. `/api/auth/session` (called by `/confirm`) warms it on first sign-in;
`/api/user/profile` resolves it lazily, so a CRM outage during sign-in costs nothing permanent.

Gone with it: the `auth_token` cookie, `/api/auth/logout`, the `user_sessions` and
`bitrix_contact_links` tables, the stateless HMAC fallback token (which could not be revoked
before its 7-day expiry), the `temp_`/`local_` placeholder contact ids, and the
`AUTH_SESSION_SECRET` env var — `userSession.ts` was its only consumer, so it can be deleted
from Vercel.

**Logout is now `supabase.auth.signOut()` only.** There is no server-side session to destroy.

### What this fixed on the way

- **`/api/user/profile` queried `profiles` by `.eq('id', …)`.** The primary key is `user_id`;
  every other call site in the repo uses it. PostgREST returned the error in `error`, which the
  handler discarded, so it fell through to a hardcoded `firstName: 'Dealer', isDealer: true`
  for **every** signed-in customer. The account page had never shown anyone's real name. No
  security impact — nothing on the client read `isDealer`, and pricing is gated server-side by
  `resolveIsDealerFromEvent()`.
- **Nothing ever created a `profiles` row for a retail customer.** The only writers were
  `approve-dealer` (`role: 'dealer'`) and `reject-dealer` (`role: 'customer'`, for a *rejected*
  applicant). `admin/customers.get.ts` filters `.in('role', ['customer','dealer'])`, so the
  admin Customers list had only ever shown dealers. First sign-in now creates the row, and
  `cacheProfileName()` keeps `first_name`/`last_name` readable there without a CRM call per row.
- **`account.vue` logged out without `supabase.auth.signOut()`** — it cleared `auth_token` and
  left the real session alive.
- **`default.vue` sent every Supabase user to `/dealer/login`.** Customers have a Supabase
  session too; it now branches on `user_metadata.role`.
- **`/api/user/profile` in the layout had no `useRequestHeaders(['cookie'])`**, so it rendered
  anonymous during SSR — the same landmine that broke dealer pricing.

`phone` and `address` are deliberately **not** mirrored into `profiles`. Bitrix stays the only
copy of those; only the name is cached, for the admin list.

---

## Gotchas that have already cost real time

**`serverSupabaseUser()` returns JWT claims, not a User object.** There is no `.id` — the id is
the JWT subject, `sub`. Reading `.id` yields `undefined`, Postgres rejects it as an invalid
uuid, and because every call site wraps the lookup in try/catch it fails **silently**. This made
every approved dealer see retail prices from June until September 2026.
**Always use `getAuthUserId()` from `server/utils/authUserId.ts`.**

**Cookies are not forwarded to internal API routes during SSR.** Nuxt won't pass them unless you
ask. Without `headers: useRequestHeaders(['cookie'])`, `serverSupabaseUser()` sees no session
server-side and the page renders as though the visitor were anonymous. All seven price-aware
page fetches now do this — copy the pattern if you add another.

**`user_metadata.role` is written but never read.** `approve-dealer`, `reject-dealer` and
`create-admin` all set it on the Supabase Auth user. Nothing anywhere makes an authorization
decision from it. **Do not trust it** — it can be stale. `profiles` and `admin_profiles` are the
truth.

**`CRON_SECRET` bypasses `adminGuard` entirely.** A request with
`Authorization: Bearer <CRON_SECRET>` gets `event.context.admin = { user_id: 'cron' }` and full
access to every admin endpoint. It exists for the Vercel cron that triggers the product sync.
Treat that value as a master key.

**Admin membership is not in `profiles`.** Looking for an admin's role there will find either
nothing or `'customer'`. Check `admin_profiles`.

---

## Where to put a new check

| You're protecting | Do this |
| --- | --- |
| A new `/api/admin/*` endpoint | Nothing — `adminGuard` covers it automatically. Read `event.context.admin`. |
| An admin action only master admins may take | Re-read `admin_profiles.is_master` in the handler, as `create-admin` does. |
| Anything price-related | Call `resolveIsDealerFromEvent(event)`. Never re-implement it. |
| A new admin page | `definePageMeta({ middleware: 'admin' })` for the redirect, and rely on `adminGuard` for the real enforcement. |
| A page that fetches per-user data during SSR | Pass `headers: useRequestHeaders(['cookie'])` to the fetch. |

---

## Mobile / native clients

Added 2026-09-14. A native app authenticates with **`Authorization: Bearer <supabase access token>`**
— the token the Supabase mobile SDKs already hold. No cookie jar is needed.

```http
GET /api/inventory?q=inverter
Authorization: Bearer eyJhbGciOi...
```

Sign in with the Supabase SDK exactly as on web (`signInWithPassword` for dealers), take
`session.access_token`, and send it on every request. Dealer pricing then applies identically to
the browser: `dealerPrice` appears alongside `PRICE` for approved dealers, and is absent for
everyone else.

**`dealerPrice` is absent, not null,** for anyone who is not an approved dealer. Treat a missing
key as retail; do not compare against zero.

**This superseded the original advice, 2026-09-15.** Until then RLS blocked `select` on
`products` for both `anon` and `authenticated`, and this document said to go through the API for
everything. The catalogue is now directly readable — see below. Prices for a signed-in user are
still API-only, and always will be.

### Reading data directly from Supabase

Two tables are reachable with the anon key. Everything else is service-role only.

| Table / view | Who | What |
| --- | --- | --- |
| `public_products` (view) | `anon`, `authenticated` | active products, `select *` works |
| `products` | `anon`, `authenticated` | same rows, but **columns must be named** |
| `profiles` | `authenticated` | the caller's own row only |

**`select *` on `products` fails with `42501`, deliberately.** RLS filters rows, not columns, so
the column restriction is a column-level `GRANT` instead — and a grant without a column list
means *all* columns. Naming them is what keeps `dealer_price` and `raw` out:

```sql
GRANT SELECT (id, name, price, description, specs, gallery_urls, image_url, quantity, active)
  ON public.products TO anon, authenticated;
```

`raw` is excluded because it carries `PROPERTY_184` — the dealer price again. Failing loudly on
`select *` is the point: the alternative is a client that silently receives the wholesale price
list. **Never write `GRANT SELECT ON public.products` without a column list.** It does not error,
it does not warn, and the RLS policy still looks correct afterwards.

Use the `public_products` view if naming columns is a nuisance. It is `security_invoker`, so the
same policy applies — it is a convenience, not a way around RLS.

### Profiles

**The client never inserts a profile.** A trigger on `auth.users` (`handle_new_user`) creates the
row at signup with `role = 'customer'`. There is no INSERT policy and the grant is revoked.

This is not an oversight to work around. `profiles` carries the dealer gate and the dealer
onboarding token, so a client-side insert would let any signed-in user grant themselves dealer
pricing, or plant a token for another user's id and reset that account's password through
`/api/dealer/create-account`.

A client may read its own row and update **`first_name`, `last_name`, `phone`, `address`** —
nothing else. `role` and `dealer_status` are readable so the app can tell whether the user is a
dealer, but not writable; RLS cannot restrict columns, so that is a column-level grant too.

**The catalogue is Bitrix-first.** `/api/inventory` fetches live from Bitrix24 and only falls
back to the Supabase mirror when Bitrix is unreachable. The mirror is a resilience layer
refreshed once daily — not the source of truth.

### Writes

`POST`/`PUT`/`DELETE` normally require the CSRF cookie-and-header pair. There are two exemptions,
and both turn on the same question: **did the browser attach these credentials by itself?**
`hasAmbientCredentials()` in `server/utils/requestCredentials.ts` is the single answer — it looks
for `csrf-token`, `admin_token`, or a Supabase session cookie matched by shape
(`sb-<project-ref>-auth-token`).

**1. A verified Bearer token with no session cookie.** A Bearer token is never ambient; the
caller must hold it deliberately, so the attack CSRF prevents cannot happen. On any other path a
malformed or expired token is not exempt and still gets a 403.

**2. A request with no credentials at all, to one of four lead-capture paths** — `/api/contact`,
`/api/quote`, `/api/book-service`, `/api/checkout` (`ANONYMOUS_WRITE_PATHS`). Added 2026-09-15 so
the mobile app can take guest enquiries and guest orders.

CSRF on an anonymous endpoint protects nothing: a POST with no credentials has no privilege to
abuse, and the identical request can be made with curl. It was never a spam control either — a
script need only GET one page to be handed a `csrf-token` cookie and echo it back. The control
that does the work is the rate limiter: anonymous lead writes get **10/min per IP** against the
website's 30.

The "no credentials at all" condition is load-bearing, and `/api/checkout` is why. Forcing a
signed-in dealer's browser to place an order **is** a real CSRF target, so anything cookie-bearing
keeps the full check. The website is unaffected — a browser holds a `csrf-token` cookie after any
GET.

> One consequence to know: on those four paths a **bogus or expired** Bearer token is not a 403.
> It fails verification, leaves no `bearerUser`, and the request is then indistinguishable from a
> guest — so it is treated as one. It grants nothing; the caller has exactly a stranger's
> privileges. But a dealer whose token has gone stale is served **retail** and their order is
> placed as a guest, silently. See Failing closed.

### Response shapes are inconsistent

`/api/inventory` returns a **bare array**. `/api/products` returns **`{ products: [...] }`**.
There is no API versioning. Pin nothing without checking, and expect shapes to move.

### A worked example

Browse anonymously, then show the right price once signed in:

```dart
// 1. anonymous catalogue — straight from Supabase
final rows = await supabase.from('public_products').select();

// 2. sign in (magic link for customers, password for dealers)
await supabase.auth.signInWithPassword(email: e, password: p);

// 3. prices for a signed-in user — API only, never the table
final token = supabase.auth.currentSession!.accessToken;
final r = await http.get(
  Uri.parse('$base/api/inventory?q=inverter&start=0'),
  headers: {'Authorization': 'Bearer $token'},
);
final List items = jsonDecode(r.body);      // bare array
final price = items[0]['dealerPrice'] ?? items[0]['PRICE'];
```

Step 3 is not optional for a dealer build. A dealer served from step 1 is quoted retail, which is
the bug that went unnoticed here from June to September 2026.

### Why Bearer resolution lives in middleware

`server/middleware/0.bearer-auth.ts` verifies the token and puts the user on
`event.context.bearerUser`. It cannot be done inside the route handler:
`defineCachedEventHandler` rebuilds the event and **drops the raw headers**, so
`getHeader(event, 'authorization')` — and `cookie` — both read as empty inside `/api/inventory`.
`event.context` survives; raw headers do not. If you add another auth source, resolve it in
middleware for the same reason.

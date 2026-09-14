# Roles & Authentication

The thing to understand first: **there is no single "role" field in this app.** There are
three independent identity systems, each with its own cookie, its own storage, and its own
check. A person can hold several at once, and knowing one tells you nothing about the others.

| System | Cookie | Source of truth | Grants |
| --- | --- | --- | --- |
| **Admin** | `admin_token` | `admin_profiles` table | The `/admin` console and `/api/admin/*` |
| **Customer / Dealer** | `sb-<project-ref>-auth-token` | `profiles.role` + `profiles.dealer_status` | Storefront login; dealer pricing |
| **Bitrix portal user** | `bitrix_session` | `auth_sessions` table | Identifies who opened the app inside Bitrix24 |

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

## 3. Bitrix portal user

Separate from everything above. When the app is opened inside the Bitrix24 iframe, Bitrix POSTs
OAuth credentials to `server/api/bitrix/handler.ts`, which stores them in **`auth_sessions`**
and sets a `bitrix_session` cookie. This identifies *who in the Bitrix portal opened the app*.
It grants nothing in this app's own authorization — it exists so the app can call the Bitrix
REST API as that user and so the install flow can register event handlers.

---

## 4. The fourth cookie: `auth_token`

`server/utils/userSession.ts` implements a **separate, HMAC-signed customer session** stored in
`user_sessions` and linked to a Bitrix CRM contact. Only `/api/auth/session`, `/api/auth/logout`,
and `/api/user/profile` use it.

`/api/user/profile` tries the Supabase session **first** and falls back to this one — so two
different customer-identity systems overlap on one endpoint. Be aware of it before changing
anything there.

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

**Do not query the database directly for the catalogue.** RLS blocks `select` on `products` for
both `anon` and `authenticated` — only the service role can read it, and the service key must
never ship in an app. Go through the API.

**The catalogue is Bitrix-first.** `/api/inventory` fetches live from Bitrix24 and only falls
back to the Supabase mirror when Bitrix is unreachable. The mirror is a resilience layer
refreshed once daily — not the source of truth.

### Writes

`POST`/`PUT`/`DELETE` normally require the CSRF cookie-and-header pair. A request carrying a
**verified** Bearer token and no session cookie is exempt, because CSRF only defends against a
browser attaching *ambient* credentials — a Bearer token is never ambient. A malformed or expired
token is not exempt and still gets a 403.

**Anonymous writes are still blocked.** A native client with no token cannot POST to
`/api/contact`, `/api/quote` or `/api/book-service` — it gets a 403. Those endpoints need either
a signed-in user or a deliberate exemption. Unresolved as of 2026-09-14.

### Response shapes are inconsistent

`/api/inventory` returns a **bare array**. `/api/products` returns **`{ products: [...] }`**.
There is no API versioning. Pin nothing without checking, and expect shapes to move.

### Why Bearer resolution lives in middleware

`server/middleware/0.bearer-auth.ts` verifies the token and puts the user on
`event.context.bearerUser`. It cannot be done inside the route handler:
`defineCachedEventHandler` rebuilds the event and **drops the raw headers**, so
`getHeader(event, 'authorization')` — and `cookie` — both read as empty inside `/api/inventory`.
`event.context` survives; raw headers do not. If you add another auth source, resolve it in
middleware for the same reason.

# NovelSolar — mobile client guide

For the Flutter app. Everything here is verified against the live backend as of **2026-09-15**.

---

## The model in one paragraph

There is one identity: a **Supabase Auth session**. A customer and a dealer are the same kind of
session — the difference is two columns on `profiles`. The app reads the **product catalogue
straight from Supabase**, but anything price-sensitive goes through the **REST API** with the
session's access token, because dealer pricing is resolved server-side and is deliberately not
readable from the database.

**The one rule: never show a price you read from the `products` table to a signed-in user.**
That table only carries retail. A dealer priced from it is quoted retail, and nothing errors —
see [Failing closed](#failing-closed), which is how this exact bug survived for three months.

---

## Setup

```dart
await Supabase.initialize(url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY);
```

| Value | Where |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API. Ask Damilare. |
| API base (staging) | `https://novelsolarweb.vercel.app` |
| API base (production) | `https://novelsolar.com` — not live yet, still WordPress |

The anon key is public by design and is meant to ship in the app. The **service role key must
never** appear in the app — it bypasses every security rule in the database.

---

## 1. Auth

```dart
// Customers — magic link, opens /confirm in a browser
await supabase.auth.signInWithOtp(email: email);

// Dealers — password, set during onboarding
await supabase.auth.signInWithPassword(email: email, password: password);

await supabase.auth.signOut();
```

Nothing else is needed at signup. A database trigger creates the user's `profiles` row
automatically. **Do not insert into `profiles`** — there is no permission for it and the attempt
will fail. That is intentional, not an oversight.

Dealers cannot self-register. An admin approves a dealer application, which provisions the
account and emails a 48-hour onboarding link.

---

## 2. Catalogue — read directly from Supabase

```dart
final products = await supabase.from('public_products').select();
```

Active products only, retail prices. Good for browsing, search and offline caching.

If you'd rather query the table than the view, **you must name the columns**:

```dart
await supabase.from('products')
    .select('id,name,price,description,specs,gallery_urls,image_url,quantity');
```

> **`supabase.from('products').select()` fails with `42501`.** This is deliberate. Row-level
> security filters *rows*, not *columns*, so the column restriction is a grant — and a grant
> without a column list would expose `dealer_price`. It fails loudly so nobody ships a client
> that silently downloads the wholesale price list. Use `public_products` if naming columns is a
> nuisance.

Columns on `public_products`: `id`, `name`, `price`, `description`, `specs`, `gallery_urls`,
`image_url`, `quantity`.

---

## 3. The user's profile

```dart
final uid = supabase.auth.currentUser!.id;

final me = await supabase.from('profiles')
    .select('first_name,last_name,phone,address,email,role,dealer_status')
    .eq('user_id', uid).single();

final isDealer = me['role'] == 'dealer' && me['dealer_status'] == 'approved';
```

**Both conditions, always.** A rejected applicant keeps `role = 'dealer'`, so checking `role`
alone would show a dealer badge to someone who was turned down — and the UI would then disagree
with the prices the server returns.

You can only read **your own row**. Reading anyone else's returns nothing.

Updatable fields: **`first_name`, `last_name`, `phone`, `address`** — nothing else.

```dart
await supabase.from('profiles')
    .update({'first_name': 'Ada', 'phone': '080...'}).eq('user_id', uid);
```

`role` and `dealer_status` are readable but not writable. An attempt returns `42501`.

There is also `GET /api/user/profile` (Bearer), which returns the profile from the Bitrix CRM
rather than the database — the customer's name, phone and address as sales sees them. Use
whichever fits; the CRM one is authoritative for contact details.

---

## 4. Prices — API only

Four endpoints apply dealer pricing. All take `Authorization: Bearer <access token>`.

| Endpoint | Query | Returns |
| --- | --- | --- |
| `GET /api/inventory` | `q`, `brand`, `start` | **bare array** |
| `GET /api/products` | `q`, `brand`, `start` (page size 50) | `{ products, next, total, count }` |
| `GET /api/product/{id}` | — | single object |
| `GET /api/itel-products` | `brand` | **bare array** |

> The shapes are inconsistent and there is no API versioning. Don't write one parser for all of
> them.

```dart
Future<List<dynamic>> inventory({String q = '', String brand = '', int start = 0}) async {
  // Read the token at call time — see Failing closed.
  final token = Supabase.instance.client.auth.currentSession?.accessToken;

  final res = await http.get(
    Uri.parse('$apiBase/api/inventory?q=$q&brand=$brand&start=$start'),
    headers: {if (token != null) 'Authorization': 'Bearer $token'},
  );
  if (res.statusCode != 200) throw Exception('inventory ${res.statusCode}');
  return jsonDecode(res.body) as List;
}

num priceOf(Map p) => p['dealerPrice'] ?? p['PRICE'];
```

Product fields are Bitrix-shaped and **uppercase**: `ID`, `NAME`, `PRICE`, `ACTIVE`,
`CURRENCY_ID`, `SECTION_ID`, plus `imageUrl`. Specs are `PROPERTY_104`, gallery `PROPERTY_112`.

**`dealerPrice` is absent, not null,** for anyone who is not an approved dealer. Use
`p['dealerPrice'] ?? p['PRICE']`. Never test for `== 0` — a zero would mean free.

No CSRF header is required. A request carrying a verified Bearer token and no cookie is exempt,
because CSRF only defends against a browser attaching credentials automatically.

**Do not cache these responses across users.** The server sends `Cache-Control: private,
no-store` and segments its own cache by pricing tier. If you cache locally keyed only on the
query string, one user's dealer prices will surface for another on a shared device.

---

## 5. Checkout

```http
POST /api/checkout
Authorization: Bearer <token>
Content-Type: application/json
```

```jsonc
{
  "customer": {
    "firstName": "Ada",      // 2–80
    "lastName":  "Obi",      // 2–80
    "email":     "a@b.com",
    "phone":     "080...",   // 7–30
    "address":   "...",      // 5–500
    "note":      ""          // optional, ≤1000
  },
  "cart": [ { "id": "1234", "quantity": 2 } ],   // 1–50 items, quantity 1–99
  "branch": { "name": "...", "address": "...", "state": "..." },
  "paymentMethod": "Bank Transfer"               // or "pickup"
}
```

**Send ids and quantities only — never prices.** Every price is re-fetched from Bitrix
server-side and dealer pricing is applied from your token, so a tampered cart cannot set its own
total. Any price you send is ignored.

Response:

```jsonc
{ "success": true, "orderId": "ORD-...", "crmSuccess": true, "message": "..." }
```

`crmSuccess: false` with `success: true` means the order was captured and queued but did not
reach the CRM — still show the customer a confirmation. They also get a receipt email either way.

For `branch`, use the live branch list — see [Branches](#7-branches).

---

## 6. Enquiry forms

All `POST`, all require a Bearer token today (see [What's blocked](#whats-blocked)).

| Endpoint | Body |
| --- | --- |
| `/api/contact` | `name`, `email`, `phone`, `subject`, `message` |
| `/api/quote` | `firstName`, `lastName`, `email`, `phone`, `projectType`, `details` |
| `/api/book-service` | `firstName`, `lastName`, `email`, `phone`, `serviceType`, `preferredDate`, `address`, `details` |

If the CRM is down these are queued server-side rather than lost, so a `success` response is
safe to show.

---

## 7. Branches

38 selling branches, in `app/utils/locations.ts` in the web repo. There's no endpoint for them
yet — ask Damilare for the current list, or scrape it from `/branch-outlets`.

Each has `name`, `city`, `state`, `address`, `phone`, `email1`, `coords`, and `bitrixId`.

Two caveats if you show them on a map:

- 13 branches carry **`approxCoords: true`** — geocoded from the address, accurate only to the
  town, not the street. Don't navigate to those pins; link to the **address text** instead.
- `bitrixId` is the CRM's id for the branch. Send that, not the name, if branch ever becomes part
  of an order.

---

## Failing closed

**The dealer check never errors. It returns "not a dealer".**

A missing token, an expired token, an unreadable profile — all produce a normal `200` response
with no `dealerPrice` field, and the app shows retail. There is no 401 and no error message.

This is safe (nobody is ever accidentally given a discount) but it means a broken token is
invisible. It is exactly how approved dealers were charged retail here from June to September
2026 without a single log line.

So: **if dealer pricing "doesn't work", check the token before you check anything else.**

```dart
// WRONG — the token expires in ~1 hour, then you silently get retail forever
final token = session.accessToken;   // captured once at login

// RIGHT — read it per request; supabase_flutter refreshes in the background
final token = Supabase.instance.client.auth.currentSession?.accessToken;
```

A quick sanity check: call `/api/inventory?q=philips` signed in as an approved dealer and confirm
`dealerPrice` is present. Discounts run about 2–9% below retail.

---

## What's blocked

**Anonymous writes return 403.** With no token and no cookie, `POST /api/contact`, `/api/quote`,
`/api/book-service` and guest `/api/checkout` are all rejected.

This matters for app design: enquiry forms and guest checkout are usually the screens you show
*before* asking someone to sign in. **Raise it with Damilare before building those screens** —
it needs a decision on the backend (a device token, a per-route exemption with rate limiting, or
requiring sign-in).

Also unavailable:

- Any table other than `products`, `public_products` and your own `profiles` row
- `dealer_price` and `raw` on `products` — no client can read these
- Orders, dealer applications, admin data

---

## Error reference

| Code | Means |
| --- | --- |
| `42501` (PostgREST) | No permission. Usually `select *` on `products` — name the columns, or use `public_products`. |
| Empty array, no error | RLS filtered every row. Signed in? Querying your own `user_id`? |
| `403` on a POST | No token and no cookie — see What's blocked. |
| `200` but no `dealerPrice` | Not an approved dealer, **or the token didn't arrive**. See Failing closed. |
| `401` on `/api/user/profile` | No valid Supabase session on the request. |

---

## Questions worth asking early

1. Should guests be able to send enquiries and check out? (Blocked today.)
2. Do you need an endpoint for branches, or is a bundled list fine?
3. Push notifications for order status — nothing exists server-side for this yet.

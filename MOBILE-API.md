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
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API. Ask Davies. |
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
will fail. That is intentional, not an oversight: three of the four ways an account gets created
here are server-side (an admin approving a dealer, an admin creating an admin), where there is no
client session to do the insert. The trigger covers every path.

**Pass the customer's details at signup** and the profile is populated immediately rather than
staying blank until they edit it:

```dart
await supabase.auth.signUp(
  email: email,
  password: password,
  data: {'first_name': 'Ada', 'last_name': 'Obi', 'phone': '080...'},
);
```

`first_name`, `last_name` and `phone` are read from that metadata. **`role` is not**, and sending
it does nothing — it is an authorization field, and `raw_user_meta_data` is client-supplied. A
role is granted by an admin approving a dealer application, never by the account asking for it.

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
`image_url`, `quantity`, `section_id`, `section_name`.

**Stock: read it from `products`, not `public_products`.** `public_products.quantity` is always
`null` on purpose — it keeps the WordPress shop from switching on stock tracking. Real stock is on
the base table:

```dart
final stock = await supabase.from('products').select('id, quantity');
```

`quantity` is the company-wide total across all warehouses, refreshed nightly. It is `null` for
services and for the few products the catalog does not track — treat `null` as "not limited", not
as zero. Checkout re-checks stock live when an order is placed, so a stale number can never let an
order through that should not go.

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
  "branch": { "name": "...", "address": "...", "state": "...", "bitrixId": "9356" },
  "fulfillment": "pickup",        // "pickup" | "delivery"
  "paymentMethod": "paystack",    // "paystack" | "pay_at_store"
  "client": "app"                 // ALWAYS send this from the app — see below
}
```

**Send ids and quantities only — never prices.** Every price is re-fetched from Bitrix
server-side and dealer pricing is applied from your token, so a tampered cart cannot set its own
total. Any price you send is ignored.

**Always send `branch.bitrixId`.** It is the branch's id in the Bitrix branch list, and it is what
files the order against the right store and messages that branch's manager. Without it the order
still goes through, but lands with no branch and nobody is told. Every branch in the list carries
one — see [Branches](#7-branches).

**The customer must be signed in.** A request with `"client": "app"` and no valid Bearer token is
refused with `401` and `data.code: "SIGN_IN_REQUIRED"`, before anything is charged or filed. The
website still allows guest checkout; the app does not. Most often this means the token expired and
was not refreshed. Refresh the session and retry, or send the customer to sign in. Never drop
`client` to get round it: the order would then be filed as a guest's and would not appear in their
account.

The app asks a guest to register when they first tap **add to cart**, which fits the backend: the
cart lives in `cart_items`, which only a signed-in user can write. Email confirmation is **on**,
though, so `signUp` gives no session until the customer taps the link in the confirmation email:

- Pass `emailRedirectTo` with the app's deep link, and add that link to Supabase's allowed redirect
  URLs (Authentication → URL Configuration). Otherwise the email opens the website's `/confirm`
  page and signs them in on the web instead of the app. A magic link (`signInWithOtp`) needs the
  same redirect, and asks for no password.
- Remember the product (and quantity) they tapped, and add it to `cart_items` once the session
  arrives through the deep link. They are away from the app reading an email in between, and
  coming back to an empty cart makes them find it again.

Guest orders placed earlier with the same email (on the website, say) are attached to the account
automatically once it is confirmed, the next time the profile is loaded.

**Payment rules** — the same as the website:

| `fulfillment` | allowed `paymentMethod` |
| --- | --- |
| `pickup` | `paystack` or `pay_at_store` |
| `delivery` | `paystack` only — the delivery cost is quoted later by an agent, so tell the customer the total is for the items only |

Response:

```jsonc
{
  "success": true,
  "orderId": "ORD-...",            // also the Paystack reference
  "orderRecordId": "uuid",         // the row in public.orders
  "crmSuccess": true,
  "paymentUrl": "https://checkout.paystack.com/...",   // paystack only
  "paymentAccessCode": "...",                          // paystack only
  "paymentReference": "ORD-...",                       // paystack only
  "paymentPending": false,         // true = order saved but payment could not be opened
  "message": "..."
}
```

### Taking the payment inside the app

**Open `paymentUrl` in an in-app WebView, not the system browser**, and **send `"client": "app"`**
in the checkout body. `url_launcher` (or anything that hands off to Chrome/Safari) takes the
customer out of the app, and without `client: "app"` they finish on the *website's* thank-you page.

What happens after they pay:

1. Paystack sends the WebView to `/api/payments/paystack/callback`. **Let it load** — that is where
   the server verifies the payment with Paystack.
2. The server sees the order came from the app and redirects to
   **`/payment-complete.html?payment=<status>&ref=ORD-...`**, a small bridge page.
3. The bridge page hands the result to the app over a **JavaScript channel named
   `CheckoutBridge`**, calling
   `CheckoutBridge.postMessage('{"status":"success","reference":"ORD-..."}')`.

**This only works inside a WebView that registers the channel.** There is no deep link — opened in
the system browser, the page just shows the result and stops. So the WebView is required, not
optional.

Register the channel before loading `paymentUrl`:

```dart
controller.addJavaScriptChannel(
  'CheckoutBridge',
  onMessageReceived: (message) {
    final data = jsonDecode(message.message) as Map<String, dynamic>;
    Navigator.of(context).pop(data['status']);   // close the WebView, hand back the result
  },
);
```

**Also intercept the navigation, as a fallback.** Both result pages carry the outcome in the URL,
so catching them in the `NavigationDelegate` works even if the channel message never arrives. It
also covers the one case the bridge page cannot: if the server fails to reach Paystack, it cannot
tell the order came from the app and sends the WebView to `/thank-you?payment=pending` instead.

```dart
NavigationDelegate(
  onNavigationRequest: (request) {
    final uri = Uri.parse(request.url);
    if (uri.path == '/payment-complete.html' || uri.path == '/thank-you') {
      Navigator.of(context).pop(uri.queryParameters['payment'] ?? 'unknown');
      return NavigationDecision.prevent;
    }
    return NavigationDecision.navigate;
  },
)
```

`status` is one of:

| value | meaning | what to show |
| --- | --- | --- |
| `success` | Paystack confirmed the payment | order confirmed |
| `failed` | not paid | order saved, unpaid — offer to try again |
| `pending` | could not confirm right now | **not a failure** — they may have paid; it will be matched |
| `review` | amount did not match the order | the team will be in touch |
| `unknown` | the page could not read a result | check the order row |

**Never treat the status as proof of payment.** Anyone can open the bridge page with
`payment=success` typed in. It is a signal to close the WebView — then read `public.orders`
by `orderRecordId` (you can read your own orders) and check `status` is `confirmed`. The Paystack
webhook usually confirms it before the customer is back in the app.

**If the customer closes the WebView without paying**, the order stays `pending` and no CRM deal is
created. **Keep their cart** until you see a confirmed order — clearing it before payment strands
anyone who backs out, which is the bug the website had.

### When there is not enough stock

Checkout checks stock before taking any money. If an item is short it refuses the order with
**`409`** and a body that says exactly what:

```jsonc
{
  "statusCode": 409,
  "statusMessage": "Some items are not available in the quantity requested.",
  "data": {
    "code": "INSUFFICIENT_STOCK",
    "items": [
      { "id": "19736", "name": "19 INCHES BLUEGATE TV", "requested": 3, "available": 1 }
    ]
  }
}
```

Nothing is created — no order, no payment, no deal — and the cart should be left alone. Instead of
an error, show the customer the items and offer a call back, like the website does: *"We don't have
enough of this in stock yet. Leave your number and our team will call you to arrange the supply."*

If they accept, send:

```http
POST /api/stock-request
Content-Type: application/json
```

```jsonc
{
  "customer": { "firstName": "Ada", "lastName": "Obi", "phone": "080...", "email": "a@b.com" },
  "items": [ { "id": "19736", "quantity": 3 } ],        // the short items, with the quantity they wanted
  "branch": { "name": "...", "bitrixId": "9356" },
  "client": "app"
}
```

It answers `{ "success": true }` once the request is safely recorded. That files a CRM lead and
messages procurement and sales support, who call the customer about supply. It is a guest write like
the enquiry forms: no token needed, and it is rate-limited the same way.

Stock is the company-wide total, not the chosen branch's — a short branch is restocked by transfer.
Services are never stock-limited.

`pay_at_store` returns no `paymentUrl`: the order is placed immediately and paid on collection.

`paymentPending: true` means the order was saved but Paystack could not be opened — tell the
customer the team will contact them to complete payment.

`crmSuccess: false` with `success: true` means the order was captured and queued but did not
reach the CRM — still show the customer a confirmation.

---

## 6. Enquiry forms

All `POST`. **A guest may send these without signing in** — no token, no CSRF header, nothing.
If the user *is* signed in, send the Bearer token as usual and the enquiry is attributed to them.

| Endpoint | Body |
| --- | --- |
| `/api/contact` | `name`, `email`, `phone`, `subject`, `message` |
| `/api/quote` | `firstName`, `lastName`, `email`, `phone`, `projectType`, `details` |
| `/api/book-service` | `firstName`, `lastName`, `email`, `phone`, `serviceType`, `preferredDate`, `address`, `details` |

If the CRM is down these are queued server-side rather than lost, so a `success` response is
safe to show.

---

## 7. Branches

37 selling branches, in `app/utils/locations.ts` in the web repo. There's no endpoint for them
yet — ask Davies for the current list, or scrape it from `/branch-outlets`.

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

**Guest writes now work** (2026-09-15). `POST /api/contact`, `/api/quote`, `/api/book-service`
and guest `/api/checkout` accept a request with no credentials at all, so enquiry forms and guest
checkout can be built without a sign-in wall.

Anonymous callers get a tighter rate limit than the website: **10 requests per minute per IP**
across those four endpoints combined, versus 30 for a signed-in or browser request. Ample for a
person filling in a form; if you see `429` in testing, that is why.

Everything else still requires authentication. Unavailable:

- Any table other than `products`, `public_products` and your own `profiles` row
- `dealer_price` and `raw` on `products` — no client can read these
- Orders, dealer applications, admin data

---

## Error reference

| Code | Means |
| --- | --- |
| `42501` (PostgREST) | No permission. Usually `select *` on `products` — name the columns, or use `public_products`. |
| Empty array, no error | RLS filtered every row. Signed in? Querying your own `user_id`? |
| `403` on a POST | CSRF. You sent *some* credential but not a valid pair — e.g. a cookie without the matching `x-csrf-token` header. Send either a clean anonymous request or a Bearer token, not a half-set. |
| `200` but no `dealerPrice` | Not an approved dealer, **or the token didn't arrive**. See Failing closed. |
| `401` on `/api/user/profile` | No valid Supabase session on the request. |
| `401` `SIGN_IN_REQUIRED` on `/api/checkout` | App order with no valid Bearer token. Refresh the session or sign the customer in. |
| `409` `PRODUCT_UNAVAILABLE` on `/api/checkout` | The cart holds products removed from the catalog since they were added. `data.items` lists every one (`id`, `name` or null). Delete those rows from `cart_items`, tell the customer, and let them retry. |

---

## Questions worth asking early

1. Do you need an endpoint for branches, or is a bundled list fine?
2. Push notifications for order status — nothing exists server-side for this yet.

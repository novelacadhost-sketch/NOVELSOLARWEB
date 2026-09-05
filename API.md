# NovelSolar API Documentation

The NovelSolar backend relies on Nuxt 4's built-in Nitro server engine to provide secure, server-side APIs that interface directly with Bitrix24 (CRM), Supabase (Auth/Database), and Cloudinary.

All endpoints run relative to the `/api/` base route.

---

## Security Overview

- **CSRF Protection:** All mutating endpoints (`POST`, `PUT`, `DELETE`) require an `x-csrf-token` header that matches the `csrf-token` securely set by the server on initial GET requests.
- **Rate Limiting:** IP addresses are restricted to 100 requests per minute to prevent brute-force and DDoS attacks.
- **Payload Sanitization:** Form-based JSON string payloads automatically undergo HTML entity sanitization (XSS protection) before processing.

---

## Public Endpoints (App -> Server -> External Services)

### Checkout Processing

`POST /api/checkout`
Processes an eCommerce cart payload, pushing customer data directly into the Bitrix CRM as a Lead and dispatching confirmation emails.

- **Body:** `{ customer: { firstName: string, lastName: string, email: string, phone?: string, address?: string, note?: string }, cart: Array<{ id?: string|number, ID?: string|number, quantity: number }>, branch?: { address?: string, state?: string, name?: string }, paymentMethod?: string }`
- **Response:** `200 OK` `{ success: boolean, leadId: number, orderId: string, message: string }`

### Contact Inquiry

`POST /api/contact`
Generates a "General Inquiry" Lead within Bitrix24.

- **Body:** `{ name: string, email: string, phone?: string, subject?: string, message: string }`
- **Response:** `200 OK` `{ success: boolean, leadId: number }`

### Quote Generation

`POST /api/quote`
Calculates solar sizing references and fires a custom Lead payload into Bitrix.

- **Body:** `{ firstName: string, lastName: string, email: string, phone: string, projectType: string, details?: string }`
- **Response:** `200 OK` `{ success: boolean, leadId: number, message: string }`

### Service Booking

`POST /api/book-service`
Processes field requests such as audits, installations, and repairs.

- **Body:** `{ firstName: string, lastName: string, email: string, phone: string, address: string, preferredDate: string, serviceType: string, details?: string }`
- **Response:** `200 OK` `{ success: boolean, leadId: number }`

---

## Internal Utility Endpoints

### Bitrix Image Fetcher

`GET /api/bitrix/bitrix-image?url=...`
Securely proxies authenticated Bitrix file attachments back to the UI.

### System Error Logging

`POST /api/log-error`
Captures uncaught frontend client exceptions entirely offline and logs them into a server-side backend logger or service.

---

## Admin Endpoints `/api/admin/*`

_All admin endpoints are rigorously protected by sever-side authentication middleware ensuring the requester's JWT or Session is a valid configured Administrator._

### Product Management

- **`POST /api/admin/upload-product`**: Accepts `multipart/form-data`. Uploads binary images into Cloudinary and publishes the final product entity with `PROPERTY_102` inside Bitrix24.
- **`POST /api/admin/update-product`**: Patches existing Bitrix Product items.
- **`POST /api/admin/delete-product`**: Securely wipes a unified specific product from the CRM.

### Admin Identity Management

- **`GET /api/admin/list-admins`**: Fetches registered Sub-administrators from Supabase Auth DB.
- **`POST /api/admin/create-admin`**: Invites a new Auth user via Supabase.
- **`POST /api/admin/delete-admin`**: Revokes an administrator's access to the CMS system securely.

### Fallback Storage Management

_These endpoints allow administrators to review and manage submissions that were saved locally due to Bitrix24 connectivity issues._

- **`GET /api/admin/failed-contacts`**: Retrieves failed contact inquiries stored locally during Bitrix outages.
  - **Response:** `200 OK` `{ success: true, contacts: Array, count: number }`
- **`GET /api/admin/failed-bookings`**: Retrieves failed service bookings stored locally during Bitrix outages.
  - **Response:** `200 OK` `{ success: true, bookings: Array, count: number }`
- **`GET /api/admin/failed-quotes`**: Retrieves failed quote requests stored locally during Bitrix outages.
  - **Response:** `200 OK` `{ success: true, quotes: Array, count: number }`

---

_Note: For detailed configurations surrounding required third-party API Keys, refer to the project's `.env.example` file._

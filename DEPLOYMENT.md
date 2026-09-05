# NovelSolar Deployment Guide

This guide details the steps required to deploy the NovelSolar application (a Nuxt 4 application utilizing Nitro server APIs) to a production environment. Since the project uses Vercel KV for its caching strategy and Edge capabilities, Vercel is the primary recommended hosting environment.

---

## 1. Prerequisites

Before scaling to production, you will need active accounts and API access configuration for:

1. **Bitrix24 CRM**: For leads, quotes, and product inventory integration.
2. **Supabase**: For PostgreSQL database and administrative Authentication mapping.
3. **Cloudinary**: For high-performance asset uploading from the admin dashboard.
4. **Vercel**: For deploying the Nuxt application and provisioning the KV Database.
5. **Nodemailer/SMTP Service**: E.g. SendGrid, Mailgun, or Gmail App Packets for dispatching reciepts.

Ensure you have established all internal Keys mapped in the root `.env.example`.

---

## 2. Deploying on Vercel (Recommended)

Because NovelSolar leans heavily into Nuxt Native Nitro Engine capabilities (such as caching image formats dynamically, rate limiting IPs via `vercel-kv`, and auto-handling Server Middleware), Vercel provides the most seamless environment.

### Step-by-Step Vercel Deployment

1. **Link the Repository:** Add your GitHub repository containing the NovelSolar directory to Vercel via their Dashboard (`Add New Project`).
2. **Configure Build Commands:**
   - **Framework Preset Setup:** Vercel ordinarily automatically detects "Nuxt.js". Leave it as Default.
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`
3. **Environment Generation:**
   Inside the project settings -> Environment Variables tab, meticulously transpose every variable listed in your local project's `.env.example` file.
4. **Link Vercel KV:**
   - From the Vercel Dashboard, go to your project's **Storage** tab.
   - Create a new **Vercel KV** database.
   - Attach it to the project explicitly. This allows properties like `process.env.KV_REST_API_URL` to be automatically exposed to Nuxt Nitro. Rate limiting (`ip123:14:50`) and OTP sessions natively rely on this connection!
5. **Deploy:** Hit "Deploy". Vercel will crunch the Vite bundle, verify the Nuxt environment, bind the APIs to Serverless Functions dynamically, and boot up.

---

## 3. Alternative Hosting Environments (Docker / VPS / Cpanel)

If deploying to a self-managed server (e.g. Ubuntu VPS via Digital Ocean), you must run the server manually.

### Build Step

```bash
npm install
npm run build
```

This commands Nuxt to emit a native lightweight `.output/server/index.mjs` entry point.

### Server Execution

We highly advise using `pm2` to persistently map the entry point.

```bash
# Export env variables explicitly, or pass an env file
export NUXT_PORT=3000

pm2 start .output/server/index.mjs --name "NovelSolar-App"
```

> **Warning regarding Rate Limiting**: If deploying manually without Vercel KV, you **MUST** ensure the `nitro.storage.rateLimit.driver` variable in `nuxt.config.ts` cascades down to standard `'memory'` safely, or link a custom `redis` storage adapter in the config parameters.

---

## 4. Post-Deployment Optimization Cheatsheet

1. **Verify Cloudinary Whitelist**: Make sure your Cloudinary environment accepts CORS uploads originating from your new Production Domain perfectly.
2. **Setup Bitrix Outbound Access**: Verify your Bitrix domain hasn't changed IP filtering policies and can effectively receive Webhook calls from the production Vercel Edge.
3. **Service Worker (SW)**: Due to our robust client-side Offline Service worker `sw.js`, anytime you deploy updates, recommend users to force refresh (`CTRL/CMD + SHIFT + R`) to purge the cache-first images if designs suddenly fragment.

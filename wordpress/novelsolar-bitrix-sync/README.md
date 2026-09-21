# NovelSolar Bitrix Sync

Keeps WooCommerce products in step with the Bitrix24 catalogue by reading the
Supabase product mirror — the same source the Flutter app uses.

## The rule that matters

**Nothing publishes itself.**

- A product the sync has never seen before is created as a **draft**. It is not
  visible on the site and cannot be bought.
- Once a product exists, the sync **never touches its status again**. Publish it
  and it stays published; leave it drafted and it stays drafted. Later runs only
  refresh the name, price, category and image.
- The single exception: a product **deleted from Bitrix** is set back to draft
  (or trashed, or left alone — your choice in settings).

There is no "publish everything automatically" option, on purpose.

## Install

1. Copy the `novelsolar-bitrix-sync` folder into `wp-content/plugins/`, or upload
   the zip via **Plugins → Add New → Upload Plugin**.
2. Activate it. WooCommerce must already be active.
3. Go to **WooCommerce → Bitrix Sync** and fill in:
   - **Supabase URL** — `https://<project>.supabase.co`
   - **Supabase anon key** — the publishable anon key, *not* the service role key
4. Click **Save & test connection**, then **Sync now**.

Optionally put the credentials in `wp-config.php` instead, which takes precedence
over the settings form and greys those fields out:

```php
define( 'NSBS_SUPABASE_URL', 'https://xxxx.supabase.co' );
define( 'NSBS_SUPABASE_ANON_KEY', 'eyJhbGci...' );
```

## What actually syncs

| Field | Where it comes from | Coverage today |
|---|---|---|
| Name | mirror `name` | 1156 / 1156 |
| Price | mirror `price` | all but 21 |
| Category | mirror `section_name` → `product_cat` | 28 categories |
| Image | mirror `image_url` (Cloudinary) | 70 |
| Description | mirror `description` | **none exist in Bitrix** |
| Stock | mirror `quantity` | **null for every product** |

With the default rules (skip SERVICES, skip zero-priced) that is **1131
products**, 66 of them with a picture.

Two of those gaps are upstream, not plugin bugs:

- **Stock.** Bitrix holds real quantities, but the Nuxt sync reads
  `crm.product.list`, which does not return `QUANTITY`. Until that changes, the
  plugin leaves WooCommerce stock management **off** rather than claiming
  everything is in stock with a made-up number. The moment the mirror carries a
  real quantity, stock management switches on by itself — no plugin change.
- **Descriptions.** Bitrix has none at all. Nothing can sync what does not exist.

## How it runs

- Hourly via WP-Cron, if "Run automatically" is on.
- Products are processed in chained batches (40 by default) through Action
  Scheduler, which WooCommerce already bundles. Lower the batch size if your host
  times out.
- A row whose content has not changed is skipped by hash, so routine runs are
  cheap even at 1100+ products.

### WP-CLI

```
wp nsbs sync            # run a full sync in the foreground
wp nsbs sync --force    # ignore a stale lock
wp nsbs status          # show the last run
```

## Notes

- Products are matched by the `_nsbs_bitrix_id` post meta. Renaming that key
  orphans everything already imported.
- Images are downloaded once and reused by source URL. An image you set by hand
  in WordPress is never overwritten.
- SKUs are set to `BX-<bitrix id>` on creation only, and skipped if that SKU is
  already taken.
- The plugin only ever reads from Supabase. It writes nothing back.
- Orders placed through WooCommerce do **not** reach Bitrix. Only the Nuxt site
  and the mobile app create CRM deals.

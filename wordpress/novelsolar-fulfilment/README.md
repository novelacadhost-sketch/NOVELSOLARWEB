# NovelSolar Order Fulfilment

Adds an **Order Fulfilment** role that can work WooCommerce orders and reach
nothing else in WordPress.

## What they see

They log in and land directly on the **Orders** screen. That is the only screen
there is: no Dashboard, no Products, no Pages, no Plugins, no Appearance, no
Settings, no Users, no Tools, and no WooCommerce Settings, Status or Analytics.

On the Orders screen they get everything WooCommerce normally offers:

- Status tabs — **Processing, On hold, Completed, Cancelled, Refunded, Failed**
- Customer name, email, phone, billing and shipping address
- Line items and totals
- Order notes, including notes the customer sees
- Changing an order's status
- Search and date filters

## What they cannot do

| | |
|---|---|
| Delete an order | No `delete_shop_orders`. An order is a financial record; a fulfilment mistake should be a status change or a note, never a disappearance. |
| Issue a refund | Blocked explicitly. Refunds move money and belong with an administrator. |
| Touch products, pages, posts, media | Capability absent. |
| Install/edit plugins or themes, change settings, add users | Capability absent. |

## Install

1. Upload the zip via **Plugins → Add New → Upload Plugin**, or copy the
   `novelsolar-fulfilment` folder into `wp-content/plugins/`.
2. Activate it. WooCommerce must already be active.
3. **Users → Add New**, set **Role** to **Order Fulfilment**, and send them the
   login.

Existing staff: **Users → <person> → Role → Order Fulfilment**.

## How the restriction actually works

Two layers, and the second is the one that counts:

1. **Capabilities.** Most of WordPress is unreachable because the capability
   simply isn't granted. WordPress core enforces this, not plugin code.
2. **An allowlist of admin pages**, checked on every admin request. Hiding a
   menu only removes the link — the page stays reachable by typing its URL.
   Anything not on the allowlist redirects back to Orders.

Menu stripping is tidying on top of those, not a boundary.

The allowlist is covered by a test (`scratchpad/lockdown-test.php` in the
session that built this) exercising 35 request shapes, including attempts to
reach Settings, Users, the plugin file editor and the Bitrix Sync settings page,
plus case-tricks and injection in the query string. All blocked; the Orders
screens and AJAX all reachable.

An administrator who is *also* given this role keeps full access, so a
misassignment can't lock you out of your own site.

## Notes

- **HPOS is handled.** WooCommerce can store orders in their own table rather
  than in `wp_posts`, and the Orders screen lives at a different URL in each
  case. The plugin detects which is in use.
- **If the Orders screen doesn't appear** on your WooCommerce version, grant the
  role `manage_woocommerce` as well — the allowlist still blocks WooCommerce
  Settings, Status and Analytics, so this stays safe. It is left out by default
  because it's the Shop Manager capability and carries more than fulfilment
  needs.
- **The role survives deactivation.** Removing it would strip the role from
  every user holding it, and WordPress doesn't give it back on reactivation —
  those accounts would come back with no role at all.
- Deactivating the plugin leaves the role in place but **removes the
  restriction**, so those users would then reach whatever their capabilities
  allow. The capabilities alone are narrow, but don't treat deactivation as
  safe.

## What this does not fix

**Orders placed through WooCommerce never reach Bitrix.** This plugin makes them
visible to the fulfilment team; it does not put them in the CRM. Only the Nuxt
site and the mobile app create Bitrix deals. If those orders need to reach
Bitrix, that's a separate piece of work.

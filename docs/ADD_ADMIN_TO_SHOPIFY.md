# Add the affiliate admin to the Shopify admin

The affiliate admin can open **inside Shopify admin** as an app. Shopify has no way to add a built-in menu item, so
it appears under **Apps** and you **pin** it, which puts it in the left sidebar. Staff are signed in by Shopify itself,
so there is no second login.

## Before you start
- The Node server (`server/`) is running on a **public HTTPS address**, for example `https://affiliate.yourdomain.com`.
  `localhost` does not work: Shopify loads the page from this address.
- The site is built (`npm run build` in the main folder), so the server can serve it.
- `server/.env` has `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`. The server uses them to
  check that each request really comes from your store's Shopify admin.
- Open `https://YOUR-DOMAIN/` in a normal browser tab first. If your site loads, the server is reachable.

## Steps
1. Shopify admin > **Settings > Apps and sales channels > Develop apps**. This opens the **Dev Dashboard**.
2. Open your app (for example "Creator Moves 365 Affiliate") and click **Create version**.
3. Fill in:
   - **App URL:** `https://YOUR-DOMAIN/shopify-admin`
   - **Embed app in Shopify admin:** on
   - **Allowed redirection URL(s):** `https://YOUR-DOMAIN/shopify-admin` (the form needs one; this app does not use it)
   - **Access scopes:** `write_discounts, read_discounts`
4. Click **Release**.
5. **Install** the app on your store. If the store belongs to a different organisation than the one that owns the app,
   use **Custom distribution** in the Dev Dashboard to get an install link, and open it as the store owner.
6. In Shopify admin open **Apps > Creator Moves 365 Affiliate**. The admin dashboard loads inside Shopify.
7. **Pin it:** click the pin icon next to the app (or "Pin to navigation"). It now sits in the left sidebar.

## Who can open it
Anyone Shopify lets open the app. The store owner controls this per person in **Settings > Users**. Everyone who can
open it gets full affiliate-admin rights. Shopify does not give the app staff names or emails, so the audit log shows
"Shopify staff <id>".

## Troubleshooting
| What you see | Cause and fix |
| --- | --- |
| Blank page or "refused to connect" | The server is not running at that address, or the site is not built. Open `https://YOUR-DOMAIN/` in a normal tab. |
| "Open this page from your Shopify admin" | You opened `/shopify-admin` in a normal tab. It only runs inside Shopify. |
| "Could not confirm your Shopify session" | `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` or `SHOPIFY_STORE_DOMAIN` in `server/.env` does not match the app or store. Fix and restart the server. |
| App missing from the Apps list | It is not installed on that store yet (step 5). |
| Staff member cannot see it | The owner must allow it for that person in Settings > Users. |
| Page loads but lists nothing | Normal on a new store: no applications or sales yet. |

## The website's own admin
Separately, the same screens are at `https://YOUR-DOMAIN/admin/login` with email and password. Accounts for that are
created only with `node scripts/make-admin.js` (see the README). It is a different sign-in from the partner area.

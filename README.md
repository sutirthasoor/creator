# Creator Moves 365

One folder, three parts:

| Part | Where | What |
| --- | --- | --- |
| Storefront | `src/` | Vite + React site. Products, cart and customer accounts talk to Shopify (headless). |
| Partner area + admin | `src/pages/partner/` | Influencer dashboard (`/partner`) and admin panel (`/admin`), same React app. |
| Affiliate server | `server/` | Plain Node server with Firestore as its only database. Sign-in, tracking, attribution, commissions, payouts, reports. Also serves the built site. |

The storefront setup is below; the affiliate system setup is further down.

```bash
npm install
cp .env.example .env     # then fill it in (below)
npm run dev
```

With no `.env` values the site runs on a clearly-labelled **sample catalogue** with a local cart and checkout switched off, so every page can be reviewed before Shopify exists.

## Pages

| Route | What it is |
| --- | --- |
| `/products` | Product grid: search, sort, load more |
| `/products/:handle` | Product detail: gallery, variants, quantity, add to cart, recommendations |
| `/cart` | Shopify cart: change quantity, remove, **Checkout** goes to Shopify's hosted checkout |
| `/auth`, `/auth?mode=signup` | Sign in / create account |
| `/auth/callback` | OAuth return from Shopify |
| `/account` | Customer details and recent orders |
| `/about`, `/contact` | Full separate pages |

## Connect Shopify

1. **Headless channel.** In Shopify admin install the *Headless* sales channel and create a storefront.
2. **Storefront API token.** Copy the *public* access token. Enable the scopes for products, product tags/inventory, and cart/checkout (read and write). Put the token and your store domain in `.env`.
3. **Products.** Create your e-books as normal Shopify products and publish them to the Headless channel. The page reads title, description, images, variants, price, compare-at price and availability.
4. **Customer sign-in.** Shopify deprecated legacy (email + password) customer accounts in February 2026 and a headless storefront signs customers in through the **Customer Account API** (OAuth 2.0 + PKCE):
   - Headless channel > *Customer Account API settings* > client type **Public**.
   - **Callback URI**: `https://YOUR-DOMAIN/auth/callback`. **JavaScript origin**: `https://YOUR-DOMAIN`. **Logout URI**: `https://YOUR-DOMAIN/`.
   - Shopify requires **HTTPS and does not accept `localhost`**, so test sign-in through a tunnel (ngrok, Cloudflare Tunnel) or on your deployed site. Vite also needs to accept the tunnel's hostname (`server.allowedHosts` in `vite.config.js`).
   - Copy the **Client ID** into `VITE_SHOPIFY_CUSTOMER_CLIENT_ID`. If automatic endpoint discovery is blocked by the browser, also copy the Authorization, Token, Logout and GraphQL URLs shown on that settings page into the optional `VITE_SHOPIFY_CUSTOMER_*` variables.
5. **Stores that still have legacy accounts** can set `VITE_SHOPIFY_AUTH_MODE=classic` to use the email + password forms through the Storefront API.

## Things to know

- **Not yet tested against a live store.** The code was checked with stubbed Shopify responses, not a real shop. First connection may need small adjustments, most likely in the Customer Account sign-in (see step 4).
- **Browser CORS.** The Storefront API is built for browser use. Shopify's docs do not say whether the Customer Account *token* endpoint accepts browser requests from a single-page app. If sign-in fails at the token step with a network/CORS error, the fix is a small server-side function that performs the token exchange.
- **Sign-in is passwordless on Shopify's side**, which differs from the PRD's "email/password" line. Classic mode exists for stores that still support it.
- **Descriptions are shown as plain text.** Product descriptions are rendered from Shopify's plain-text field rather than HTML, so merchant HTML can never inject script into the page.
- **Production hosting** needs every route to fall back to `index.html`. `public/_redirects` does this on Netlify; configure the equivalent elsewhere (for example a Vercel rewrite).
- The pages in `src/pages.css` and `src/shop.css` are built from the design tokens in your original `src/styles.css`, which is unchanged.

---

# Affiliate and influencer system

Runs on the **free Firebase plan**: Firestore is the only Firebase product used for data, and Firebase Authentication (also free) is reached only through the Node server. There are no Cloud Functions and no Firebase Hosting, so no Blaze plan is needed. Everything else is one Node server in `server/`.

## What it does

- **Partners** sign up at `/partner`, verify their email and apply. Admin approves, which issues a referral ID, a coupon code (also created in Shopify) and a tracked link: any store URL plus `?ref=CODE`.
- **Clicks** are logged by the server, which returns a signed attribution token. The storefront keeps it and attaches it to the Shopify cart (`cm_ref` cart attribute) so the paid order carries it.
- **Shopify webhooks** (`orders/paid`, `refunds/create`, `orders/cancelled`, `disputes/create`) hit `/api/webhooks/shopify`. Signatures are checked, repeats are ignored, and each paid order creates at most one commission.
- **Commission lifecycle:** Pending (hold period) > Approved > Payable > Paid, or Reversed. Refunds reverse the matching share; refunds after payment become a clawback netted off the next payout. Paid records are never rewritten.
- **Customer refunds:** a customer asks for a refund from their account page (whole order, inside the refund window, default 7 days, set in Affiliate rules). An admin with the finance role approves or declines it in the **Refunds** tab. Approving makes Shopify return the money; Shopify's `refunds/create` webhook then deducts the partner's commission exactly as for any other refund (reduced before payout, or a clawback netted off the next payout if already paid) and ends the customer's access to the e-books. A refund made directly in the Shopify dashboard takes the same path, so a commission is never deducted twice.
- **Admin** (`/admin`): influencers and applications, commissions, payouts (record UTR + date), refunds, reports with CSV export, affiliate rules, per-e-book rates, audit log.
- Nothing business-related is hard-coded: rules live in Firestore and are edited in the admin panel.

## How the pieces connect

```
Browser  --->  Node server (server/)  --->  Firestore (database)
 (React)        /api/*  and the site         Firebase Authentication (sign-in, via REST)
                   ^                         Shopify Admin API (coupon codes)
                   |
        Shopify webhooks (orders, refunds)
```

The server serves the built site (`dist`) and the API on one domain, so there is no CORS to set up.

## Set it up

1. **Firebase project (free Spark plan).** Create one at console.firebase.google.com. Then:
   - **Authentication > Sign-in method:** turn on **Email/Password**.
   - **Firestore Database:** create a database (production mode; the server bypasses the rules and the rules block everything else).
   - **Project settings > General:** copy the **Web API key**.
   - **Project settings > Service accounts > Generate new private key:** save the file as `server/serviceAccount.json`. Keep it private; never commit it.
2. **Deploy the Firestore rules and indexes** (works on the free plan):
   ```bash
   npm i -g firebase-tools && firebase login
   cp .firebaserc.example .firebaserc      # put your project ID inside
   firebase deploy --only firestore
   ```
   Indexes take a few minutes to build. If a page shows an index error, the error contains a link that creates it.
3. **Shopify app.** Shopify admin > Settings > Apps and sales channels > Develop apps opens the **Dev Dashboard**. Create an app, set the Admin API scopes `write_discounts`, `read_discounts` and `write_orders` (the last one lets the Refunds tab issue refunds), release the version, install it on the store, and copy its **Client ID** and **Client secret**. The server fetches a short-lived Admin API token with them automatically.
4. **Server settings.**
   ```bash
   cd server && npm install
   cp .env.example .env     # then fill it in (every line is explained inside)
   ```
5. **Build the site and start the server.**
   ```bash
   cd .. && npm install && npm run build      # creates dist/
   cd server && npm start
   ```
   Open http://localhost:8080. The site, `/partner`, `/admin` and `/api` are all served from there.
6. **Put it on a public HTTPS address.** Shopify's webhooks need one. Any host that runs Node works (Render, Railway, Fly.io, a VPS). Set the same variables from `server/.env` in the host's settings, set the start command to `node index.js` in the `server` folder, and build the site before starting. For local testing use a tunnel (ngrok or Cloudflare Tunnel).
7. **Webhooks.** In Shopify admin > Settings > Notifications > Webhooks create, in JSON format, pointing at `https://YOUR-DOMAIN/api/webhooks/shopify`: *Order payment*, *Order cancellation*, *Refund create* (and *Dispute creation* if offered). Shopify shows a signing secret on that page. Put it in `SHOPIFY_WEBHOOK_SECRET`.
8. **Create your admin account.** Admins and partners are **separate accounts with separate sign-in pages**:

   | | Partner (influencer) | Admin |
   | --- | --- | --- |
   | Sign in | `/partner/auth` | `/admin/login` |
   | Create account | by themselves, on the sign-up form | only by you, with the script below |
   | Layout | own slim top bar | own slim top bar |

   Neither area shows the storefront header or footer. An admin password does not work on the partner sign-in, and a partner password does not work on the admin sign-in: the server refuses it. An email that is already a partner cannot be made an admin; use a different email.
   ```bash
   cd server
   node scripts/make-admin.js you@example.com super_admin
   node scripts/make-admin.js ops@example.com admin partners,finance   # limited admin
   ```
   For a new email the script creates the account and prints a link; open it once to choose the password. Then sign in at `/admin/login`. `partners` covers influencers, rules and commission approval; `finance` covers payouts, adjustments and the audit log.

**Working on the code with the dev server.** `npm run dev` serves the site on port 5173 and cannot reach the API on its own. Put `VITE_AFFILIATE_API_URL=http://localhost:8080/api` in `.env` and `ALLOWED_ORIGINS=http://localhost:5173` in `server/.env`, and run both.

Server tests (no Firebase needed): `cd server && npm test`.

## Admin panel inside the Shopify admin (an "Affiliate" app in the sidebar)

The same admin screens also open **inside Shopify admin**, as an embedded app. Staff sign in through Shopify itself (no second login). The influencer dashboard stays on your site at `/partner`.

1. In the **Dev Dashboard**, open your app and create a new version. Set:
   - **App URL:** `https://YOUR-DOMAIN/shopify-admin`
   - **Embed app in Shopify admin:** on
   - **Allowed redirection URL(s):** `https://YOUR-DOMAIN/shopify-admin` (required by the form; this app does not use a redirect)
   - **Scopes:** `write_discounts, read_discounts, write_orders`
2. **Release** the version, then **install** the app on the store.
3. In Shopify admin, open **Apps > Creator Moves 365 Affiliate**. Click the pin icon (or "Pin to navigation") to keep it in the sidebar.
4. Set `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` and `SHOPIFY_STORE_DOMAIN` in `server/.env`. The server uses them to check the session token Shopify sends: it must be signed by your app and for your store, otherwise the request is refused.

Notes:
- **Who can open it:** anyone Shopify lets open the app (the owner decides under Settings > Users, per staff member). Everyone who can open it gets full affiliate-admin rights (influencers, rules, commissions, payouts, reports, audit). Shopify does not tell the app staff names or emails, so the audit log records them as "Shopify staff <id>".
- It appears as an **app in the sidebar**, not as a built-in Shopify menu. Shopify has no way to add one.
- The website's own admin page (`/admin/login`, email + password, accounts made with `make-admin.js`) works too. If you only want the Shopify version, never run `make-admin.js`; without an admin account, `/admin/login` has nobody who can sign in.
- The page only runs inside the Shopify admin. Opening `/shopify-admin` directly in a browser shows a message.
- If the store belongs to someone else's organisation (not the one that owns the app), use **Custom distribution** in the Dev Dashboard to get an install link for that store.

## Things to know

- **Not yet run against real Firebase or a real Shopify store.** The server logic is covered by 37 tests on an in-memory store and mocked webhooks, auth calls, Shopify session tokens and file serving. The Firestore adapter (`server/src/store.firestore.js`), the Firebase Authentication calls and the Shopify payload field names are written from the documentation but have not been exercised live. Send one test order first and check the commission appears.
- **Free-tier limits.** Firestore's free plan allows about 50,000 reads and 20,000 writes a day. Reports and the admin tables read many records, so heavy use of them on a large store could hit the read limit. Fine for a small partner base.
- **Free hosts may sleep.** Some free Node hosts pause an idle server. Shopify retries failed webhooks for a while, so orders are not lost, but commissions would appear late. A small always-on plan avoids this.
- **Rate limiting** on sign-in, click and apply endpoints is kept in memory per server process.
- **MFA for admins** is not wired in yet.
- **Emails** about applications, approvals and payouts are not sent. Firebase sends the sign-up verification and password-reset emails itself. Other emails need a mail service and are a next step.
- **E-book access control** (private reader, signed file URLs, access grants) is a separate module and not part of this build.
- **Currency** is stored in integer paise and assumes INR.

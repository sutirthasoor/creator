// All Shopify settings come from environment variables (see .env.example).
// Vite only exposes variables that start with VITE_ to the browser, and everything
// here is therefore PUBLIC. Only put the *public* Storefront access token and the
// public-client Customer Account client ID here, never an Admin API token or secret.

const env = import.meta.env;
const clean = (v) => (v || "").trim();

const domain = clean(env.VITE_SHOPIFY_STORE_DOMAIN).replace(/^https?:\/\//, "").replace(/\/+$/, "");

export const SHOPIFY = {
  domain, // e.g. your-store.myshopify.com
  token: clean(env.VITE_SHOPIFY_STOREFRONT_TOKEN), // public Storefront API access token
  apiVersion: clean(env.VITE_SHOPIFY_API_VERSION) || "2026-07",
  locale: clean(env.VITE_CURRENCY_LOCALE) || "en-IN", // number formatting only
};

export const isShopifyConfigured = Boolean(SHOPIFY.domain && SHOPIFY.token);

// Customer Account API (OAuth 2.0 + PKCE, public client). The endpoint URLs can be
// copied from Shopify admin > Headless > Customer Account API settings. When left
// blank they are discovered from https://<domain>/.well-known/...
export const CUSTOMER = {
  clientId: clean(env.VITE_SHOPIFY_CUSTOMER_CLIENT_ID),
  authUrl: clean(env.VITE_SHOPIFY_CUSTOMER_AUTH_URL),
  tokenUrl: clean(env.VITE_SHOPIFY_CUSTOMER_TOKEN_URL),
  logoutUrl: clean(env.VITE_SHOPIFY_CUSTOMER_LOGOUT_URL),
  graphqlUrl: clean(env.VITE_SHOPIFY_CUSTOMER_GRAPHQL_URL),
};

// "oauth"   - Shopify new customer accounts (Customer Account API). Default.
// "classic" - email + password through the Storefront API. Only for stores that
//             still run legacy customer accounts (deprecated by Shopify in 2026).
// "none"    - Shopify not connected, or no customer client ID configured.
const rawMode = clean(env.VITE_SHOPIFY_AUTH_MODE).toLowerCase();
export const AUTH_MODE = !isShopifyConfigured
  ? "none"
  : rawMode === "classic"
    ? "classic"
    : CUSTOMER.clientId
      ? "oauth"
      : "none";

export const AUTH_NOT_CONNECTED = "AUTH_NOT_CONNECTED";

import fs from "node:fs";

// All settings come from environment variables (see .env.example). A local .env file is
// read for convenience when running with `npm start`.
export function loadEnvFile(path = new URL("../.env", import.meta.url)) {
  try {
    for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !line.trim().startsWith("#") && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch { /* no .env file: use real environment variables */ }
}

export function loadConfig(env = process.env) {
  const need = (k) => {
    if (!env[k]) throw new Error(`Missing required setting ${k}. See server/.env.example.`);
    return env[k];
  };
  const shopId = env.SHOPIFY_SHOP_ID || "";
  return {
    port: Number(env.PORT) || 8080,
    attributionSecret: need("ATTRIBUTION_SECRET"),
    webhookSecret: need("SHOPIFY_WEBHOOK_SECRET"),
    firebaseWebApiKey: need("FIREBASE_WEB_API_KEY"),
    shopDomain: env.SHOPIFY_STORE_DOMAIN || "",
    shopifyApiVersion: env.SHOPIFY_API_VERSION || "2026-07",
    storefrontToken: env.SHOPIFY_STOREFRONT_TOKEN || "",
    customerGraphqlUrl: env.SHOPIFY_CUSTOMER_GRAPHQL_URL || "",
    shopifyClientId: env.SHOPIFY_CLIENT_ID || "",
    shopifyClientSecret: env.SHOPIFY_CLIENT_SECRET || "",
    // Customer Account API (OAuth + PKCE, public client). Used by /api/auth/shopify/token.
    shopifyCustomerTokenUrl:
      env.SHOPIFY_CUSTOMER_TOKEN_URL ||
      (shopId ? `https://shopify.com/authentication/${shopId}/oauth/token` : ""),
    shopifyCustomerClientId: env.SHOPIFY_CUSTOMER_CLIENT_ID || "",
    allowedOrigins: (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
    staticDir: env.STATIC_DIR || new URL("../../dist", import.meta.url).pathname,
    promoteEveryMinutes: Number(env.PROMOTE_EVERY_MINUTES) || 60,
  };
}
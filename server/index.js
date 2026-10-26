import http from "node:http";
import fs from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { loadEnvFile, loadConfig } from "./src/config.js";
import { createFirestoreStore } from "./src/store.firestore.js";
import { createHandler } from "./src/api.js";
import { createShopifyAdmin } from "./src/shopify.js";
import { createAuthService } from "./src/auth.js";
import { createStaticHandler } from "./src/static.js";
import { createIdentity } from "./src/shopifySession.js";
import { createCustomerVerifier } from "./src/library.js";
import { promoteDue } from "./src/lifecycle.js";
import { reconcileRefunds } from "./src/reconcile.js";

loadEnvFile();
const config = loadConfig();

// Firestore is the only database. Credentials: a service-account key file (GOOGLE_APPLICATION_CREDENTIALS)
// or the key's JSON pasted into FIREBASE_SERVICE_ACCOUNT_JSON (handy on hosts without file storage).
const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
initializeApp({ credential: json ? cert(JSON.parse(json)) : applicationDefault() });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const store = createFirestoreStore(db);

const shopify = createShopifyAdmin({
  domain: config.shopDomain, clientId: config.shopifyClientId, clientSecret: config.shopifyClientSecret, version: config.shopifyApiVersion,
});
const firebaseVerify = async (token) => {
  const d = await getAuth().verifyIdToken(token);
  return { uid: d.uid, email: d.email, emailVerified: Boolean(d.email_verified), role: d.role || null, perms: d.perms || [] };
};
// Accepts both: Shopify staff inside the Shopify admin (session token) and email + password sign-ins.
const verifyIdToken = createIdentity({
  firebaseVerify,
  shopify: { clientId: config.shopifyClientId, clientSecret: config.shopifyClientSecret, shopDomain: config.shopDomain },
});
const customers = createCustomerVerifier({
  shopDomain: config.shopDomain, apiVersion: config.shopifyApiVersion, storefrontToken: config.storefrontToken, graphqlUrl: config.customerGraphqlUrl,
});
const api = createHandler({
  store,
  config,
  verifyIdToken,
  shopify,
  customers,
  authService: createAuthService({
    apiKey: config.firebaseWebApiKey,
    shopify: {
      tokenUrl: config.shopifyCustomerTokenUrl,
      clientId: config.shopifyCustomerClientId,
    },
  }),
});
const staticHandler = fs.existsSync(config.staticDir) ? createStaticHandler(config.staticDir, { embed: { clientId: config.shopifyClientId } }) : null;

const server = http.createServer((req, res) => {
  const path = (req.url || "").split("?")[0];
  if (path === "/api" || path.startsWith("/api/")) return api(req, res);
  if (staticHandler) return staticHandler(req, res);
  res.writeHead(404, { "Content-Type": "text/plain" });
  return res.end("The site has not been built. Run `npm run build` in the project folder, or open the storefront separately.");
});

server.listen(config.port, () => console.log(`Creator Moves 365 server listening on :${config.port}${staticHandler ? " (serving the built site)" : " (API only)"}`));

// Commissions whose hold period has ended become payable. Runs at start and then on a timer.
async function promote() {
  try {
    const r = await promoteDue(store);
    if (r.payable) console.log(`Promoted ${r.payable} commission(s) to payable`);
  } catch (e) {
    console.error("promoteDue failed", e);
  }
}
promote();
setInterval(promote, config.promoteEveryMinutes * 60_000).unref();

// Refund safety net: asks Shopify for refunds the webhook missed, so a refunded order always loses its commission
// and its e-book access. Harmless when nothing was missed.
async function reconcile() {
  try {
    const r = await reconcileRefunds(store, shopify);
    if (r.applied) console.log(`Reconciled ${r.applied} missed refund(s)/cancellation(s)`);
  } catch (e) {
    console.error("reconcileRefunds failed", e);
  }
}
setTimeout(reconcile, 30_000).unref();
setInterval(reconcile, Math.max(5, config.promoteEveryMinutes) * 60_000).unref();

for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => server.close(() => process.exit(0)));
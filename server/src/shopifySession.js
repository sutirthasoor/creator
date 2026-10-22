import crypto from "node:crypto";

// Verifies the session token (a JWT signed with the app's client secret, HS256) that Shopify's App Bridge
// gives the admin page running inside the Shopify admin. Tokens live about a minute.
const b64 = (s) => Buffer.from(s, "base64url");

export function verifyShopifySessionToken(token, { clientId, clientSecret, shopDomain, now = Date.now() }) {
  if (typeof token !== "string" || !clientId || !clientSecret || !shopDomain) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header;
  let claims;
  try {
    header = JSON.parse(b64(parts[0]).toString());
    claims = JSON.parse(b64(parts[1]).toString());
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;
  const expected = crypto.createHmac("sha256", clientSecret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = b64(parts[2]);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const t = Math.floor(now / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= t - 5) return null;
  if (typeof claims.nbf === "number" && claims.nbf > t + 5) return null;
  if (claims.aud !== clientId) return null;
  let dest;
  let iss;
  try {
    dest = new URL(claims.dest);
    iss = new URL(claims.iss);
  } catch {
    return null;
  }
  const shop = shopDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
  if (dest.hostname.toLowerCase() !== shop || iss.hostname.toLowerCase() !== dest.hostname.toLowerCase()) return null; // only OUR store
  return claims;
}

// One place that turns an Authorization token into a signed-in user: Shopify staff opening the
// app inside the Shopify admin, or a partner/admin who signed in with email + password.
export function createIdentity({ firebaseVerify, shopify, staffPerms = ["partners", "finance"] }) {
  return async function verify(token) {
    const claims = verifyShopifySessionToken(token, shopify || {});
    if (claims) {
      // Shopify decides who can open the app (staff app permissions). The token carries no email,
      // so staff appear in the audit log by their Shopify user id.
      return { uid: `shopify:${claims.sub}`, email: `Shopify staff ${claims.sub}`, emailVerified: true, role: "admin", perms: staffPerms, via: "shopify" };
    }
    return firebaseVerify(token);
  };
}

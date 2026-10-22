import crypto from "node:crypto";

export function verifyWebhook(rawBody, headerHmac, secret) {
  if (!rawBody || !headerHmac || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  let given;
  try { given = Buffer.from(headerHmac, "base64"); } catch { return false; }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// Minimal Admin GraphQL client, used only to create the influencer's discount code.
// Two ways to authenticate: a Dev Dashboard app (clientId + clientSecret, token fetched with the
// client credentials grant and refreshed before its ~24h expiry), or a fixed token from an older app.
export function createShopifyAdmin({ domain, token, clientId, clientSecret, version, fetchImpl = fetch }) {
  const enabled = Boolean(domain && (token || (clientId && clientSecret)));
  let cached = null;
  async function accessToken() {
    if (token) return token;
    if (cached && cached.expiresAt - Date.now() > 300_000) return cached.value;
    const res = await fetchImpl(`https://${domain}/admin/oauth/access_token`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    });
    if (!res.ok) throw new Error(`Shopify token request failed (${res.status})`);
    const j = await res.json();
    cached = { value: j.access_token, expiresAt: Date.now() + (Number(j.expires_in) || 86399) * 1000 };
    return cached.value;
  }
  async function gql(query, variables) {
    const res = await fetchImpl(`https://${domain}/admin/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await accessToken() },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify responded ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
    return json.data;
  }
  return {
    enabled,
    async createDiscountCode({ code, percentBps, title }) {
      const data = await gql(
        `mutation($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`,
        { d: {
          title, code, startsAt: new Date().toISOString(), appliesOncePerCustomer: false,
          customerSelection: { all: true },
          customerGets: { value: { percentage: percentBps / 10000 }, items: { all: true } },
        } }
      );
      const out = data.discountCodeBasicCreate;
      if (out.userErrors && out.userErrors.length) throw new Error(out.userErrors.map((e) => e.message).join("; "));
      return { id: out.codeDiscountNode.id };
    },
  };
}

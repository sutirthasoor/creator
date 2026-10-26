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
// Turns Shopify's suggested refund transactions into the transactions refundCreate expects.
export function buildRefundTransactions(orderGid, suggested) {
  return (suggested || [])
    .filter((t) => t && t.parentTransaction && Number(t.amountSet && t.amountSet.shopMoney && t.amountSet.shopMoney.amount) > 0)
    .map((t) => ({ orderId: orderGid, gateway: t.gateway, kind: "REFUND", parentId: t.parentTransaction.id, amount: t.amountSet.shopMoney.amount }));
}

// Shopify requires an idempotency key on refundCreate. The key is made from the exact refund being sent, so a
// retry of the same refund can never pay out twice, while a changed refund gets a fresh key.
export function refundIdempotencyKey(orderGid, items, transactions) {
  const h = crypto.createHash("sha256").update(JSON.stringify({ orderGid, items, transactions })).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

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
    // Refunds everything left on an order back to the original payment. Shopify then sends the
    // refunds/create webhook, which is what reverses the influencer's commission.
    async refundOrder({ orderId, note }) {
      if (!enabled) throw new Error("Shopify is not connected.");
      const gid = `gid://shopify/Order/${orderId}`;
      const found = await gql(`query($id: ID!) { order(id: $id) { id lineItems(first: 100) { nodes { id refundableQuantity } } } }`, { id: gid });
      if (!found.order) throw new Error("The order was not found in Shopify.");
      const items = found.order.lineItems.nodes.filter((n) => n.refundableQuantity > 0).map((n) => ({ lineItemId: n.id, quantity: n.refundableQuantity }));
      if (!items.length) throw new Error("Nothing is left to refund on this order.");
      const sug = await gql(
        `query($id: ID!, $items: [RefundLineItemInput!]) { order(id: $id) { suggestedRefund(refundLineItems: $items, refundShipping: true) { suggestedTransactions { gateway parentTransaction { id } amountSet { shopMoney { amount } } } } } }`,
        { id: gid, items }
      );
      const transactions = buildRefundTransactions(gid, sug.order.suggestedRefund.suggestedTransactions);
      if (!transactions.length) throw new Error("Shopify found no payment to refund.");
      const data = await gql(
        `mutation($input: RefundInput!, $key: String!) { refundCreate(input: $input) @idempotent(key: $key) { refund { id } userErrors { field message } } }`,
        { key: refundIdempotencyKey(gid, items, transactions), input: { orderId: gid, note: note || "Customer refund request", notify: true, refundLineItems: items.map((i) => ({ ...i, restockType: "NO_RESTOCK" })), shipping: { fullRefund: true }, transactions } }
      );
      const out = data.refundCreate;
      if (out.userErrors && out.userErrors.length) throw new Error(out.userErrors.map((e) => e.message).join("; "));
      return { id: out.refund.id };
    },
  };
}

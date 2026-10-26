import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { createMemoryStore } from "../src/store.memory.js";
import { signToken } from "../src/token.js";
import { handleOrderPaid, handleRefund } from "../src/orders.js";
import { promoteDue, createPayout, markPayoutPaid } from "../src/lifecycle.js";
import { influencerSummary } from "../src/reports.js";
import { listLibrary } from "../src/library.js";
import { buildRefundTransactions } from "../src/shopify.js";
import { createHandler } from "../src/api.js";
import { HttpError } from "../src/util.js";
import {
  requestRefund, listMyOrders, listRefundRequests, approveRefund, rejectRefund, completeRefundRequest, refundEligibility,
} from "../src/refunds.js";

const SECRET = "test-attribution-secret";
const WEBHOOK = "test-webhook-secret";
const admin = { uid: "a1", email: "admin@aa100xtech.com" };
const BUYER = "buyer@example.com";
const T0 = "2026-10-01T10:00:00.000Z";
const later = (days) => new Date(Date.parse(T0) + days * 86400000).toISOString();

async function activeInfluencer(store) {
  await store.set("influencers", "u1", {
    uid: "u1", email: "riya@example.com", name: "Riya", status: "active", code: "RIYA1234", couponCode: "RIYA10",
    commissionOverride: null, payout: { method: "upi", upi: "riya@upi" }, createdAt: T0, history: [],
  });
}
const linkToken = () => signToken({ i: "u1", c: "click1", t: Date.parse(T0), x: Date.parse(T0) + 30 * 86400000 }, SECRET);

function order(id, { token, email = BUYER } = {}) {
  return {
    id, name: `#${id}`, email, currency: "INR", created_at: T0, taxes_included: false,
    total_line_items_price: "2100.00", total_discounts: "0.00", subtotal_price: "2100.00", total_price: "2100.00", total_tax: "0.00",
    discount_codes: [], note_attributes: token ? [{ name: "cm_ref", value: token }] : [],
    line_items: [{ id: id * 10, product_id: 555, title: "Masterbook", quantity: 1, price: "2100.00", total_discount: "0.00", tax_lines: [] }],
  };
}
const pay = (store, o) => handleOrderPaid(store, { order: o, webhookId: `w${o.id}`, secret: SECRET, now: T0 });
const shopifyRefund = (orderId, refundId = 9) => ({
  id: refundId, order_id: orderId, refund_line_items: [{ line_item_id: orderId * 10, quantity: 1 }], transactions: [{ kind: "refund", amount: "2100.00" }],
});

function fakeShopify({ fail } = {}) {
  const s = { enabled: true, calls: [] };
  s.refundOrder = async (args) => {
    s.calls.push(args);
    if (fail) throw new Error(fail);
    return { id: `gid://shopify/Refund/${s.calls.length}` };
  };
  return s;
}

// A store with one influencer-attributed paid order (#1).
async function setup() {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order(1, { token: linkToken() }));
  return store;
}
const ask = (store, over = {}, now = later(1)) => requestRefund(store, { email: BUYER, orderId: "1", reason: "Not what I expected", ...over }, { now });

test("request: creates one pending request, audited, and leaves the commission alone", async () => {
  const store = await setup();
  const r = await ask(store);
  assert.equal(r.status, "pending");
  assert.equal(r.deadline, later(7));
  const doc = await store.get("refundRequests", "1");
  assert.equal(doc.amountPaise, 210000);
  assert.equal(doc.influencerId, "u1");
  assert.equal(doc.email, BUYER);
  assert.equal(store._dump("audit").filter((a) => a.action === "refund_requested").length, 1);
  const c = await store.get("commissions", "1");
  assert.equal(c.reversedPaise, 0); // nothing is deducted until the money is actually refunded
});

test("request: guards (owner only, reason, one per order, window, order state)", async () => {
  const store = await setup();
  await assert.rejects(ask(store, { email: "someone-else@example.com" }), /not found/i);
  await assert.rejects(ask(store, { orderId: "999" }), /not found/i);
  await assert.rejects(ask(store, { orderId: "../etc" }), /not found/i);
  await assert.rejects(ask(store, { reason: "  " }), /reason/i);
  await assert.rejects(ask(store, {}, later(8)), /7-day refund window/);
  await ask(store, { email: "BUYER@Example.com" }); // capitalisation does not matter
  await assert.rejects(ask(store), /being reviewed/);

  const s2 = await setup();
  await handleRefund(s2, { refund: shopifyRefund(1), now: later(2) });
  await assert.rejects(ask(s2), /no longer be refunded/);
});

test("request: the window is a setting the admin can change", async () => {
  const store = await setup();
  await store.set("settings", "affiliate", { refundWindowDays: 14 });
  await ask(store, {}, later(10));
  assert.equal((await store.get("refundRequests", "1")).status, "pending");
});

test("customer order list shows what they can do and the request status", async () => {
  const store = await setup();
  await pay(store, order(2, { email: "other@example.com" }));
  let { orders } = await listMyOrders(store, BUYER, { now: later(1) });
  assert.equal(orders.length, 1); // only their own order
  assert.equal(orders[0].refund.canRequest, true);
  assert.equal(orders[0].refund.deadline, later(7));
  assert.equal(orders[0].request, null);
  await ask(store);
  ({ orders } = await listMyOrders(store, BUYER, { now: later(1) }));
  assert.equal(orders[0].refund.canRequest, false);
  assert.equal(orders[0].request.status, "pending");
  ({ orders } = await listMyOrders(store, "nobody@example.com", { now: later(1) }));
  assert.equal(orders.length, 0);
  assert.equal(refundEligibility({ status: "paid", paidAt: T0 }, null, { refundWindowDays: 7 }, later(7)).eligible, true);
  assert.equal(refundEligibility({ status: "paid", paidAt: T0 }, null, { refundWindowDays: 7 }, later(7.1)).eligible, false);
});

test("approve: asks Shopify once, and the commission only changes when the refund webhook arrives", async () => {
  const store = await setup();
  await ask(store);
  const shopify = fakeShopify();
  await approveRefund(store, "1", { note: "ok" }, admin, { shopify, now: later(2) });
  assert.equal(shopify.calls.length, 1);
  assert.equal(shopify.calls[0].orderId, "1");
  assert.equal((await store.get("refundRequests", "1")).status, "approved");
  assert.equal((await store.get("commissions", "1")).reversedPaise, 0);
  await assert.rejects(approveRefund(store, "1", {}, admin, { shopify, now: later(2) }), /already approved/);
  assert.equal(shopify.calls.length, 1);
  assert.equal(store._dump("audit").filter((a) => a.action === "refund_approved").length, 1);
});

test("approve: a failed Shopify call refunds nothing and can be retried; a crashed claim can be retaken", async () => {
  const store = await setup();
  await ask(store);
  await assert.rejects(approveRefund(store, "1", {}, admin, { shopify: fakeShopify({ fail: "Gateway timeout" }), now: later(2) }), /Nothing was refunded/);
  let r = await store.get("refundRequests", "1");
  assert.equal(r.status, "pending");
  assert.match(r.lastError, /Gateway timeout/);
  await approveRefund(store, "1", {}, admin, { shopify: fakeShopify(), now: later(2) });
  assert.equal((await store.get("refundRequests", "1")).status, "approved");

  const s2 = await setup();
  await ask(s2);
  await s2.merge("refundRequests", "1", { status: "approving", approvingAt: later(2) });
  const shop = fakeShopify();
  const soon = new Date(Date.parse(later(2)) + 60_000).toISOString();
  await assert.rejects(approveRefund(s2, "1", {}, admin, { shopify: shop, now: soon }), /already approving/); // someone is mid-way
  const muchLater = new Date(Date.parse(later(2)) + 10 * 60_000).toISOString();
  await approveRefund(s2, "1", {}, admin, { shopify: shop, now: muchLater });
  assert.equal(shop.calls.length, 1);
});

test("approve: without Shopify connected nothing is claimed", async () => {
  const store = await setup();
  await ask(store);
  await assert.rejects(approveRefund(store, "1", {}, admin, { shopify: { enabled: false }, now: later(2) }), /Shopify dashboard/);
  assert.equal((await store.get("refundRequests", "1")).status, "pending");
});

test("refund webhook: request closes, commission is deducted, access is revoked, exactly once", async () => {
  const store = await setup();
  await ask(store);
  await approveRefund(store, "1", {}, admin, { shopify: fakeShopify(), now: later(2) });
  assert.equal((await listLibrary(store, BUYER)).items.length, 1);

  const res = await handleRefund(store, { refund: shopifyRefund(1), webhookId: "wr1", now: later(3) });
  assert.equal(res.reversedPaise, 21000);
  await completeRefundRequest(store, { orderId: 1, refundId: 9, reversedPaise: res.reversedPaise, now: later(3) });

  const r = await store.get("refundRequests", "1");
  assert.equal(r.status, "refunded");
  assert.equal(r.commissionReversedPaise, 21000);
  const c = await store.get("commissions", "1");
  assert.equal(c.state, "reversed");
  assert.equal(c.reversedPaise, 21000);
  assert.equal((await listLibrary(store, BUYER)).items.length, 0);

  // Shopify retries the webhook: nothing is counted twice.
  const again = await handleRefund(store, { refund: shopifyRefund(1), webhookId: "wr1", now: later(4) });
  assert.equal(again.duplicate, true);
  assert.equal((await completeRefundRequest(store, { orderId: 1, refundId: 9, now: later(4) })).updated, false);
  assert.equal((await store.get("commissions", "1")).reversedPaise, 21000);
});

test("commission already paid out becomes a clawback the next payout nets off", async () => {
  const store = await setup();
  await store.set("settings", "affiliate", { minPayoutPaise: 100 });
  await pay(store, order(2, { token: linkToken() })); // two more sales to net against
  await pay(store, order(3, { token: linkToken() }));
  await promoteDue(store, { now: later(20) });
  const p1 = await createPayout(store, { influencerId: "u1", commissionIds: ["1"], method: "UPI" }, admin, { now: later(21) });
  await markPayoutPaid(store, p1.payoutId, { reference: "UTR-1" }, admin, { now: later(21) });

  // Order #1 was paid out long ago, so ask inside a widened window.
  await store.set("settings", "affiliate", { minPayoutPaise: 100, refundWindowDays: 60 });
  await ask(store, {}, later(22));
  const before = (await listRefundRequests(store, { status: "pending" })).requests[0];
  assert.equal(before.commission.deductionPaise, 21000);
  assert.equal(before.commission.asClawback, true);

  await approveRefund(store, "1", {}, admin, { shopify: fakeShopify(), now: later(22) });
  const res = await handleRefund(store, { refund: shopifyRefund(1), webhookId: "wr2", now: later(23) });
  await completeRefundRequest(store, { orderId: 1, refundId: 9, reversedPaise: res.reversedPaise, now: later(23) });

  const paid = await store.get("commissions", "1");
  assert.equal(paid.state, "paid");
  assert.equal(paid.payoutItemPaise, 21000); // what was paid stays as paid
  assert.equal(paid.clawbackPaise, 21000);
  assert.equal((await influencerSummary(store, "u1")).commission.clawbackOutstandingPaise, 21000);
  const p2 = await createPayout(store, { influencerId: "u1", commissionIds: ["2", "3"], method: "UPI" }, admin, { now: later(24) });
  assert.equal(p2.amountPaise, 42000 - 21000);
  await markPayoutPaid(store, p2.payoutId, { reference: "UTR-2" }, admin, { now: later(24) });
  assert.equal((await influencerSummary(store, "u1")).commission.clawbackOutstandingPaise, 0);
});

test("reject: needs a reason, is final, and the customer sees it", async () => {
  const store = await setup();
  await ask(store);
  await assert.rejects(rejectRefund(store, "1", { reason: "" }, admin), /reason/i);
  await rejectRefund(store, "1", { reason: "Book was fully downloaded" }, admin, { now: later(2) });
  await assert.rejects(rejectRefund(store, "1", { reason: "again" }, admin), /Only a pending/);
  await assert.rejects(approveRefund(store, "1", {}, admin, { shopify: fakeShopify() }), /already rejected/);
  await assert.rejects(ask(store, {}, later(3)), /declined/);
  const { orders } = await listMyOrders(store, BUYER, { now: later(3) });
  assert.equal(orders[0].request.status, "rejected");
  assert.equal(orders[0].request.decisionNote, "Book was fully downloaded");
  assert.equal(store._dump("audit").filter((a) => a.action === "refund_rejected").length, 1);
});

test("a refund made straight in Shopify (no request) is unaffected, and still closes a pending request", async () => {
  const store = await setup();
  assert.equal((await completeRefundRequest(store, { orderId: 1, refundId: 9 })).updated, false);
  assert.equal(await store.get("refundRequests", "1"), null);

  await ask(store);
  const res = await handleRefund(store, { refund: shopifyRefund(1), webhookId: "wr3", now: later(3) });
  await completeRefundRequest(store, { orderId: 1, refundId: 9, reversedPaise: res.reversedPaise, now: later(3) });
  assert.equal((await store.get("refundRequests", "1")).status, "refunded");
});

test("buildRefundTransactions keeps only real payments", () => {
  const t = buildRefundTransactions("gid://shopify/Order/1", [
    { gateway: "razorpay", parentTransaction: { id: "gid://shopify/OrderTransaction/7" }, amountSet: { shopMoney: { amount: "2100.0" } } },
    { gateway: "razorpay", parentTransaction: { id: "x" }, amountSet: { shopMoney: { amount: "0.0" } } },
    { gateway: "manual", parentTransaction: null, amountSet: { shopMoney: { amount: "5.0" } } },
  ]);
  assert.deepEqual(t, [{ orderId: "gid://shopify/Order/1", gateway: "razorpay", kind: "REFUND", parentId: "gid://shopify/OrderTransaction/7", amount: "2100.0" }]);
});

/* ---------------- HTTP layer ---------------- */

async function serve(store, shopify = fakeShopify()) {
  const users = {
    "tok-admin": { uid: "a1", email: admin.email, emailVerified: true, role: "super_admin", perms: [] },
    "tok-riya": { uid: "u1", email: "riya@example.com", emailVerified: true },
  };
  const customers = { verify: async (t) => { if (t !== "cust-buyer") throw new HttpError(401, "Please sign in again."); return { email: BUYER }; } };
  const handler = createHandler({
    store, config: { attributionSecret: SECRET, webhookSecret: WEBHOOK, allowedOrigins: [] },
    verifyIdToken: async (t) => { if (!users[t]) throw new Error("bad"); return users[t]; },
    shopify, customers, authService: {}, clock: () => later(1),
  });
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { token, body, headers = {} } = {}) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token.startsWith("cust") ? token : `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  return { call, close: () => server.close() };
}
const sign = (raw) => crypto.createHmac("sha256", WEBHOOK).update(raw).digest("base64");

test("http: customer and admin endpoints are protected, and the whole flow works end to end", async () => {
  const store = await setup();
  const shopify = fakeShopify();
  const { call, close } = await serve(store, shopify);
  try {
    assert.equal((await call("GET", "/api/account/orders")).status, 401);
    assert.equal((await call("GET", "/api/account/orders", { token: "cust-wrong" })).status, 401);
    assert.equal((await call("POST", "/api/admin/refunds/1/approve", { token: "tok-riya", body: {} })).status, 403);
    assert.equal((await call("GET", "/api/admin/refunds", { token: "tok-riya" })).status, 403);
    assert.equal((await call("GET", "/api/admin/refunds")).status, 401);

    const list = await call("GET", "/api/account/orders", { token: "cust-buyer" });
    assert.equal(list.json.orders[0].refund.canRequest, true);
    assert.equal((await call("POST", "/api/account/orders/1/refund-request", { token: "cust-buyer", body: {} })).status, 400);
    const req = await call("POST", "/api/account/orders/1/refund-request", { token: "cust-buyer", body: { reason: "Changed my mind" } });
    assert.equal(req.status, 200);
    assert.equal((await call("POST", "/api/account/orders/1/refund-request", { token: "cust-buyer", body: { reason: "again" } })).status, 400);

    const adminList = await call("GET", "/api/admin/refunds?status=pending", { token: "tok-admin" });
    assert.equal(adminList.json.requests.length, 1);
    assert.equal(adminList.json.requests[0].commission.deductionPaise, 21000);

    assert.equal((await call("POST", "/api/admin/refunds/1/approve", { token: "tok-admin", body: {} })).status, 200);
    assert.equal(shopify.calls.length, 1);

    // Shopify confirms the refund: the signed webhook deducts the commission and closes the request.
    const raw = JSON.stringify(shopifyRefund(1));
    const hook = await call("POST", "/api/webhooks/shopify", { body: raw, headers: { "X-Shopify-Hmac-Sha256": sign(raw), "X-Shopify-Topic": "refunds/create", "X-Shopify-Webhook-Id": "wh-r1" } });
    assert.equal(hook.status, 200);
    assert.equal((await store.get("refundRequests", "1")).status, "refunded");
    assert.equal((await store.get("commissions", "1")).state, "reversed");
  } finally { close(); }
});

test("http: approving with Shopify disconnected explains what to do", async () => {
  const store = await setup();
  await ask(store);
  const { call, close } = await serve(store, { enabled: false });
  try {
    const r = await call("POST", "/api/admin/refunds/1/approve", { token: "tok-admin", body: {} });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /Shopify dashboard/);
  } finally { close(); }
});

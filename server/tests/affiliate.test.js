import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { createMemoryStore } from "../src/store.memory.js";
import { toPaise, bpsOf } from "../src/util.js";
import { signToken, verifyToken } from "../src/token.js";
import { handleOrderPaid, handleRefund, handleFullReversal } from "../src/orders.js";
import { approveCommissions, promoteDue, createPayout, markPayoutPaid, adjustCommission, cancelPayout } from "../src/lifecycle.js";
import { changeStatus, applyAsInfluencer, recordClick, setInfluencerRate, setProductRate } from "../src/influencers.js";
import { influencerSummary, toCsv, REPORTS } from "../src/reports.js";
import { createHandler } from "../src/api.js";
import { createShopifyAdmin } from "../src/shopify.js";
import { createAuthService } from "../src/auth.js";
import { verifyShopifySessionToken, createIdentity } from "../src/shopifySession.js";
import { createStaticHandler } from "../src/static.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SECRET = "test-attribution-secret";
const WEBHOOK = "test-webhook-secret";
const admin = { uid: "a1", email: "admin@aa100xtech.com" };
const T0 = "2026-10-01T10:00:00.000Z";
const later = (days) => new Date(Date.parse(T0) + days * 86400000).toISOString();

async function activeInfluencer(store, over = {}) {
  await store.set("influencers", "u1", {
    uid: "u1", email: "riya@example.com", name: "Riya", status: "active", code: "RIYA1234", couponCode: "RIYA10",
    commissionOverride: null, payout: { method: "upi", upi: "riya@upi" }, createdAt: T0, history: [], ...over,
  });
}

let nextId = 1000;
function order({ price = "2100.00", qty = 1, token, codes = [], email = "buyer@example.com", discount = "0.00", id } = {}) {
  const oid = id || ++nextId;
  const gross = (Number(price) * qty).toFixed(2);
  return {
    id: oid, name: `#${oid}`, email, currency: "INR", created_at: T0, taxes_included: false,
    total_line_items_price: gross, total_discounts: discount, subtotal_price: (Number(gross) - Number(discount)).toFixed(2),
    total_price: (Number(gross) - Number(discount)).toFixed(2), total_tax: "0.00",
    discount_codes: codes.map((code) => ({ code })),
    note_attributes: token ? [{ name: "cm_ref", value: token }] : [],
    line_items: [{ id: oid * 10, product_id: 555, title: "Masterbook", quantity: qty, price, total_discount: discount, tax_lines: [] }],
  };
}
const linkToken = (over = {}) => signToken({ i: "u1", c: "click1", t: Date.parse(T0), x: Date.parse(T0) + 30 * 86400000, ...over }, SECRET);
const pay = (store, o, webhookId) => handleOrderPaid(store, { order: o, webhookId, secret: SECRET, now: T0 });

test("money helpers use integers", () => {
  assert.equal(toPaise("2100.00"), 210000);
  assert.equal(toPaise("0.1"), 10);
  assert.equal(toPaise("19.995"), 2000);
  assert.equal(toPaise("-5.50"), -550);
  assert.equal(bpsOf(210000, 1000), 21000);
  assert.throws(() => toPaise("abc"));
});

test("attribution tokens cannot be forged or edited", () => {
  const t = linkToken();
  assert.equal(verifyToken(t, SECRET).i, "u1");
  assert.equal(verifyToken(t, "other"), null);
  const [body, sig] = t.split(".");
  const evil = Buffer.from(JSON.stringify({ i: "attacker", x: 9e15 })).toString("base64url");
  assert.equal(verifyToken(`${evil}.${sig}`, SECRET), null);
  assert.equal(verifyToken("garbage", SECRET), null);
});

test("paid order via link creates exactly one commission, even if the webhook repeats", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  const o = order({ token: linkToken() });
  const first = await pay(store, o, "wh-1");
  const again = await pay(store, o, "wh-1");
  const otherId = await pay(store, o, "wh-2");
  assert.equal(first.commissioned, true);
  assert.equal(again.duplicate, true);
  assert.equal(otherId.duplicate, true);
  const comms = store._dump("commissions");
  assert.equal(comms.length, 1);
  assert.equal(comms[0].grossPaise, 21000); // 10% of 2100
  assert.equal(comms[0].state, "pending");
  assert.equal(store._dump("orders").length, 1);
});

test("direct sales earn no commission", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order(), "wh-d");
  assert.equal(store._dump("commissions").length, 0);
  assert.equal(store._dump("orders")[0].attribution.influencerId, null);
});

test("expired, forged and inactive-partner tokens are not credited", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ token: linkToken({ x: Date.parse(T0) - 1000 }) }), "w1");
  await pay(store, order({ token: "x.y" }), "w2");
  await store.merge("influencers", "u1", { status: "suspended" });
  await pay(store, order({ token: linkToken() }), "w3");
  assert.equal(store._dump("commissions").length, 0);
});

test("coupon alone attributes; link and coupon from same partner is one commission", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ codes: ["riya10"] }), "w1");
  await pay(store, order({ token: linkToken(), codes: ["RIYA10"] }), "w2");
  const comms = store._dump("commissions");
  assert.equal(comms.length, 2);
  assert.deepEqual(comms.map((c) => c.attribution.source).sort(), ["coupon", "link+coupon"]);
});

test("conflict between two partners follows the admin rule", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await store.set("influencers", "u2", { uid: "u2", email: "sam@example.com", name: "Sam", status: "active", code: "SAM1", couponCode: "SAM10", createdAt: T0 });
  await pay(store, order({ token: linkToken(), codes: ["SAM10"], id: 1 }), "c1");
  assert.equal(store._dump("commissions")[0].influencerId, "u2"); // default rule: coupon wins
  await store.set("settings", "affiliate", { conflictRule: "link" });
  await pay(store, order({ token: linkToken(), codes: ["SAM10"], id: 2 }), "c2");
  assert.equal(store.get("commissions", "2") && (await store.get("commissions", "2")).influencerId, "u1");
});

test("self-referral is blocked and logged; 'flag' mode keeps it for review", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ token: linkToken(), email: "Riya@Example.com", id: 1 }), "s1");
  assert.equal(store._dump("commissions").length, 0);
  assert.equal(store._dump("audit").filter((a) => a.action === "suspicious_referral").length, 1);
  await store.set("settings", "affiliate", { selfReferral: "flag" });
  await pay(store, order({ token: linkToken(), email: "riya@example.com", id: 2 }), "s2");
  const c = await store.get("commissions", "2");
  assert.equal(c.flagged, true);
  // flagged commissions are not auto-approved
  const r = await promoteDue(store, { now: later(100) });
  assert.equal(r.payable, 0);
  assert.equal((await approveCommissions(store, ["2"], admin, { now: later(100) })).approved, 0);
  assert.equal((await approveCommissions(store, ["2"], admin, { force: true, now: later(100) })).approved, 1);
});

test("rates: influencer override beats product override beats default; ineligible products earn nothing", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await setProductRate(store, 555, { rate: { type: "percent", value: 20 } }, admin, { now: T0 });
  await pay(store, order({ token: linkToken(), id: 1 }), "r1");
  assert.equal((await store.get("commissions", "1")).grossPaise, 42000); // 20%
  await setInfluencerRate(store, "u1", { type: "fixed", value: 150 }, admin, { now: T0 });
  await pay(store, order({ token: linkToken(), qty: 2, id: 2 }), "r2");
  assert.equal((await store.get("commissions", "2")).grossPaise, 30000); // ₹150 x 2
  await setProductRate(store, 555, { eligible: false }, admin, { now: T0 });
  await pay(store, order({ token: linkToken(), id: 3 }), "r3");
  assert.equal(await store.get("commissions", "3"), null);
});

test("net base excludes discounts; gross base ignores them", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ token: linkToken(), discount: "210.00", id: 1 }), "n1");
  assert.equal((await store.get("commissions", "1")).grossPaise, 18900); // 10% of 1890
  await store.set("settings", "affiliate", { commissionBase: "gross" });
  await pay(store, order({ token: linkToken(), discount: "210.00", id: 2 }), "n2");
  assert.equal((await store.get("commissions", "2")).grossPaise, 21000);
});

test("partial then full refund reverse commission proportionally and idempotently", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ token: linkToken(), qty: 2, id: 7 }), "p1");
  const refund = (id, qty, amount) => ({ id, order_id: 7, refund_line_items: [{ line_item_id: 70, quantity: qty }], transactions: [{ kind: "refund", status: "success", amount }] });
  const r1 = await handleRefund(store, { refund: refund(1, 1, "2100.00"), now: T0 });
  assert.equal(r1.reversedPaise, 21000);
  assert.equal((await handleRefund(store, { refund: refund(1, 1, "2100.00"), now: T0 })).duplicate, true);
  let c = await store.get("commissions", "7");
  assert.equal(c.reversedPaise, 21000);
  assert.equal(c.state, "pending");
  await handleRefund(store, { refund: refund(2, 1, "2100.00"), now: T0 });
  c = await store.get("commissions", "7");
  assert.equal(c.reversedPaise, 42000);
  assert.equal(c.state, "reversed");
  const o = await store.get("orders", "7");
  assert.equal(o.status, "refunded");
  assert.equal(o.lines[0].refundedQty, 2);
});

test("a refund that arrives before the order is retried, not lost", async () => {
  const store = createMemoryStore();
  await assert.rejects(handleRefund(store, { refund: { id: 1, order_id: 99, transactions: [] } }), (e) => e.retry === true);
});

test("cancellation and chargeback reverse the whole commission", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ token: linkToken(), id: 4 }), "x1");
  await handleFullReversal(store, { orderId: 4, topic: "orders/cancelled", now: T0 });
  assert.equal((await store.get("commissions", "4")).state, "reversed");
});

test("lifecycle: hold period, payout minimum, payout, paid state", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ token: linkToken(), id: 1 }), "l1"); // ₹210 commission
  await pay(store, order({ token: linkToken(), qty: 3, id: 2 }), "l2"); // ₹630 commission
  assert.equal((await promoteDue(store, { now: later(5) })).payable, 0); // still on hold (14 days)
  assert.equal((await promoteDue(store, { now: later(15) })).payable, 2);
  assert.equal((await store.get("commissions", "1")).state, "payable");
  await assert.rejects(createPayout(store, { influencerId: "u1", commissionIds: ["1"], method: "UPI" }, admin, { now: later(16) }), /minimum payout/);
  const { payoutId, amountPaise } = await createPayout(store, { influencerId: "u1", commissionIds: ["1", "2"], method: "UPI" }, admin, { now: later(16) });
  assert.equal(amountPaise, 84000);
  await assert.rejects(createPayout(store, { influencerId: "u1", commissionIds: ["1"], method: "UPI" }, admin), /not payable/);
  await assert.rejects(markPayoutPaid(store, payoutId, {}, admin), /reference/i);
  await markPayoutPaid(store, payoutId, { reference: "UTR123456", paidAt: later(17) }, admin, { now: later(17) });
  const s = await influencerSummary(store, "u1");
  assert.equal(s.commission.paidPaise, 84000);
  assert.equal(s.commission.payablePaise, 0);
  assert.equal(s.unitsSold, 4);
  await assert.rejects(markPayoutPaid(store, payoutId, { reference: "again" }, admin), /already paid/);
  const actions = store._dump("audit").map((a) => a.action);
  assert.ok(actions.includes("payout_created") && actions.includes("payout_paid"));
});

test("cancelling a payout releases its commissions for a new payout", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ token: linkToken(), qty: 2, id: 1 }), "z1");
  await pay(store, order({ token: linkToken(), qty: 2, id: 2 }), "z2");
  await promoteDue(store, { now: later(20) });
  const p = await createPayout(store, { influencerId: "u1", commissionIds: ["1", "2"], method: "UPI" }, admin, { now: later(21) });
  await assert.rejects(cancelPayout(store, p.payoutId, "", admin), /reason/i);
  await cancelPayout(store, p.payoutId, "Wrong UPI ID", admin, { now: later(22) });
  assert.equal((await store.get("commissions", "1")).payoutId, null);
  const again = await createPayout(store, { influencerId: "u1", commissionIds: ["1", "2"], method: "UPI" }, admin, { now: later(23) });
  assert.equal(again.amountPaise, 84000);
});

test("refund after payment becomes a clawback netted off the next payout; paid record is never rewritten", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await store.set("settings", "affiliate", { minPayoutPaise: 100 });
  await pay(store, order({ token: linkToken(), id: 1 }), "k1"); // 210
  await pay(store, order({ token: linkToken(), qty: 2, id: 2 }), "k2"); // 420
  await promoteDue(store, { now: later(20) });
  const p1 = await createPayout(store, { influencerId: "u1", commissionIds: ["1"], method: "UPI" }, admin, { now: later(21) });
  await markPayoutPaid(store, p1.payoutId, { reference: "UTR-1" }, admin, { now: later(21) });
  await handleRefund(store, { refund: { id: 5, order_id: 1, refund_line_items: [{ line_item_id: 10, quantity: 1 }], transactions: [{ kind: "refund", amount: "2100.00" }] }, now: later(22) });
  const paid = await store.get("commissions", "1");
  assert.equal(paid.state, "paid");
  assert.equal(paid.payoutItemPaise, 21000); // what was actually paid is untouched
  assert.equal(paid.clawbackPaise, 21000);
  const s = await influencerSummary(store, "u1");
  assert.equal(s.commission.clawbackOutstandingPaise, 21000);
  const p2 = await createPayout(store, { influencerId: "u1", commissionIds: ["2"], method: "UPI" }, admin, { now: later(23) });
  assert.equal(p2.amountPaise, 42000 - 21000);
  await markPayoutPaid(store, p2.payoutId, { reference: "UTR-2" }, admin, { now: later(23) });
  assert.equal((await influencerSummary(store, "u1")).commission.clawbackOutstandingPaise, 0);
});

test("adjustments need a reason and are audited with before/after", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ token: linkToken(), id: 1 }), "j1");
  await assert.rejects(adjustCommission(store, "1", { deltaPaise: -1000, reason: "" }, admin), /reason/i);
  const r = await adjustCommission(store, "1", { deltaPaise: -1000, reason: "Goodwill refund" }, admin, { now: later(1) });
  assert.deepEqual(r, { beforePaise: 21000, afterPaise: 20000 });
  const a = store._dump("audit").find((x) => x.action === "commission_adjusted");
  assert.equal(a.details.reason, "Goodwill refund");
  assert.equal(a.by, admin.email);
});

test("application and approval flow issues code + coupon and records history", async () => {
  const store = createMemoryStore();
  const user = { uid: "u9", email: "New@Example.com", emailVerified: true };
  await assert.rejects(applyAsInfluencer(store, { ...user, emailVerified: false }, { name: "N", pitch: "x" }), /verify/);
  await applyAsInfluencer(store, user, { name: "Nia Rao", pitch: "50k followers", payout: { method: "upi", upi: "nia@upi" } }, { now: T0 });
  await assert.rejects(applyAsInfluencer(store, user, { name: "Nia", pitch: "x" }), /already applied/);
  const calls = [];
  const shopify = { enabled: true, createDiscountCode: async (a) => { calls.push(a); return { id: "gid://shopify/DiscountCodeNode/1" }; } };
  await assert.rejects(changeStatus(store, "u9", { action: "suspend" }, admin, { shopify }), /Cannot suspend/);
  const r = await changeStatus(store, "u9", { action: "approve", note: "Looks good" }, admin, { shopify, now: T0 });
  assert.equal(r.status, "active");
  assert.match(r.code, /^NIAR\d{4}$/);
  assert.equal(calls[0].code, r.couponCode);
  assert.equal(calls[0].percentBps, 1000);
  const inf = await store.get("influencers", "u9");
  assert.equal(inf.history.length, 2);
  await changeStatus(store, "u9", { action: "suspend", note: "Policy" }, admin, { now: T0 });
  assert.equal((await store.get("influencers", "u9")).status, "suspended");
  assert.ok(store._dump("audit").filter((a) => a.action === "influencer_status_changed").length === 2);
});

test("clicks are logged server-side and only for active partners", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  const r = await recordClick(store, { code: "riya1234", landing: "/products", ip: "1.2.3.4" }, { secret: SECRET, now: T0 });
  assert.equal(verifyToken(r.token, SECRET).i, "u1");
  assert.equal(store._dump("clicks").length, 1);
  await assert.rejects(recordClick(store, { code: "NOPE" }, { secret: SECRET }), /Not found/);
  assert.equal((await influencerSummary(store, "u1")).clicks, 1);
});

test("CSV export neutralises spreadsheet formulas and converts paise to rupees", () => {
  const csv = toCsv([{ influencer: "=HYPERLINK(1)", amountPaise: 12345 }]);
  assert.match(csv, /"'=HYPERLINK\(1\)"/);
  assert.match(csv, /"123.45"/);
  assert.match(csv, /"amount \(INR\)"/);
});

test("reports reconcile with the underlying records", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await pay(store, order({ token: linkToken(), qty: 2, id: 1 }), "q1");
  await pay(store, order({ id: 2 }), "q2");
  await handleRefund(store, { refund: { id: 1, order_id: 1, refund_line_items: [{ line_item_id: 10, quantity: 1 }], transactions: [{ kind: "refund", amount: "2100.00" }] }, now: T0 });
  const [row] = await REPORTS.influencers(store, {});
  assert.equal(row.unitsSold, 2);
  assert.equal(row.grossSalesPaise, 420000);
  assert.equal(row.refundedPaise, 210000);
  assert.equal(row.netSalesPaise, 210000);
  assert.equal(row.commissionEarnedPaise, 21000);
  const [sales] = await REPORTS.sales(store, {});
  assert.equal(sales.orders, 2);
  assert.equal(sales.unitsSold, 3);
});

/* ---------------- HTTP layer ---------------- */

async function serve(store, over = {}) {
  const users = {
    "tok-admin": { uid: "a1", email: "admin@aa100xtech.com", emailVerified: true, role: "super_admin", perms: [] },
    "tok-fin": { uid: "a2", email: "fin@aa100xtech.com", emailVerified: true, role: "admin", perms: ["finance"] },
    "tok-riya": { uid: "u1", email: "riya@example.com", emailVerified: true },
    "tok-other": { uid: "u2", email: "other@example.com", emailVerified: true },
  };
  const handler = createHandler({
    store, config: { attributionSecret: SECRET, webhookSecret: WEBHOOK, allowedOrigins: ["https://creatormoves365.in"] },
    verifyIdToken: async (t) => { if (!users[t]) throw new Error("bad"); return users[t]; }, shopify: { enabled: false }, authService: createAuthService({ apiKey: "k", fetchImpl: over.fetchImpl || (async () => ({ ok: true, json: async () => ({}) })) }), clock: () => T0, ...over,
  });
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { token, body, headers = {} } = {}) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => null), headers: res.headers };
  };
  return { call, close: () => server.close() };
}

const sign = (raw) => crypto.createHmac("sha256", WEBHOOK).update(raw).digest("base64");

test("webhook: rejects bad signatures, accepts good ones, is idempotent", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  const { call, close } = await serve(store);
  try {
    const raw = JSON.stringify(order({ token: linkToken(), id: 31 }));
    const bad = await call("POST", "/api/webhooks/shopify", { body: raw, headers: { "X-Shopify-Hmac-Sha256": "AAAA", "X-Shopify-Topic": "orders/paid" } });
    assert.equal(bad.status, 401);
    const missing = await call("POST", "/api/webhooks/shopify", { body: raw, headers: { "X-Shopify-Topic": "orders/paid" } });
    assert.equal(missing.status, 401);
    const h = { "X-Shopify-Hmac-Sha256": sign(raw), "X-Shopify-Topic": "orders/paid", "X-Shopify-Webhook-Id": "w-1" };
    assert.equal((await call("POST", "/api/webhooks/shopify", { body: raw, headers: h })).status, 200);
    const second = await call("POST", "/api/webhooks/shopify", { body: raw, headers: h });
    assert.equal(second.json.duplicate, true);
    assert.equal(store._dump("commissions").length, 1);
    // tampered body fails the signature
    const tampered = raw.replace("2100.00", "1.00");
    assert.equal((await call("POST", "/api/webhooks/shopify", { body: tampered, headers: h })).status, 401);
    // early refund asks Shopify to retry
    const rraw = JSON.stringify({ id: 1, order_id: 999, transactions: [] });
    const rr = await call("POST", "/api/webhooks/shopify", { body: rraw, headers: { "X-Shopify-Hmac-Sha256": sign(rraw), "X-Shopify-Topic": "refunds/create" } });
    assert.equal(rr.status, 409);
  } finally { close(); }
});

test("api: authentication and role checks on every protected endpoint", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  const { call, close } = await serve(store);
  try {
    assert.equal((await call("GET", "/api/me")).status, 401);
    assert.equal((await call("GET", "/api/me", { token: "bogus" })).status, 401);
    for (const path of ["/api/admin/influencers", "/api/admin/commissions", "/api/admin/payouts", "/api/admin/settings", "/api/admin/audit", "/api/admin/reports/sales"]) {
      assert.equal((await call("GET", path, { token: "tok-riya" })).status, 403, path);
    }
    assert.equal((await call("GET", "/api/admin/influencers", { token: "tok-admin" })).status, 200);
    // finance-only admin: payouts yes, influencer approvals no
    assert.equal((await call("GET", "/api/admin/payouts", { token: "tok-fin" })).status, 200);
    assert.equal((await call("GET", "/api/admin/influencers", { token: "tok-fin" })).status, 403);
    assert.equal((await call("POST", "/api/admin/influencers/u1/status", { token: "tok-fin", body: { action: "suspend" } })).status, 403);
    assert.equal((await call("GET", "/api/admin/reports/sales", { token: "tok-fin" })).status, 200);
  } finally { close(); }
});

test("api: influencers see only their own data, never customer emails", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await store.set("influencers", "u2", { uid: "u2", email: "other@example.com", name: "Other", status: "active", code: "OTH1", couponCode: "OTH10", createdAt: T0 });
  await pay(store, order({ token: linkToken(), id: 1 }), "a1");
  await pay(store, order({ token: linkToken({ i: "u2" }), id: 2, email: "secret@customer.com" }), "a2");
  const { call, close } = await serve(store);
  try {
    const mine = await call("GET", "/api/influencer/sales", { token: "tok-riya" });
    assert.equal(mine.json.sales.length, 1);
    assert.equal(mine.json.sales[0].order, "#1");
    assert.ok(!JSON.stringify(mine.json).includes("buyer@example.com"));
    const theirs = await call("GET", "/api/influencer/commissions", { token: "tok-other" });
    assert.equal(theirs.json.commissions.length, 1);
    assert.equal(theirs.json.commissions[0].order, "#2");
    const dash = await call("GET", "/api/influencer/dashboard", { token: "tok-riya" });
    assert.equal(dash.json.summary.unitsSold, 1);
    // no ID parameter exists that could reach another partner's records
    assert.equal((await call("GET", "/api/influencer/sales?influencerId=u2", { token: "tok-riya" })).json.sales.length, 1);
    // someone who has not applied
    store._dump("influencers");
    const users404 = await serve(store, { verifyIdToken: async () => ({ uid: "nobody", email: "n@x.com", emailVerified: true }) });
    assert.equal((await users404.call("GET", "/api/influencer/dashboard", { token: "t" })).status, 404);
    users404.close();
  } finally { close(); }
});

test("api: public click endpoint issues a signed token and rejects unknown codes", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  const { call, close } = await serve(store);
  try {
    const ok = await call("POST", "/api/public/click", { body: { code: "RIYA1234", landing: "/products" } });
    assert.equal(ok.status, 200);
    assert.equal(verifyToken(ok.json.token, SECRET).i, "u1");
    assert.equal((await call("POST", "/api/public/click", { body: { code: "ZZZZ" } })).status, 404);
    assert.equal((await call("POST", "/api/public/click", { body: "{not json" })).status, 400);
    const cors = await call("GET", "/api/health", { headers: { Origin: "https://creatormoves365.in" } });
    assert.equal(cors.headers.get("access-control-allow-origin"), "https://creatormoves365.in");
    const noCors = await call("GET", "/api/health", { headers: { Origin: "https://evil.example" } });
    assert.equal(noCors.headers.get("access-control-allow-origin"), null);
  } finally { close(); }
});

test("api: admin settings change is validated and audited", async () => {
  const store = createMemoryStore();
  const { call, close } = await serve(store);
  try {
    assert.equal((await call("PUT", "/api/admin/settings", { token: "tok-admin", body: { holdDays: -3 } })).status, 400);
    assert.equal((await call("PUT", "/api/admin/settings", { token: "tok-admin", body: { defaultRate: { type: "percent", value: 150 } } })).status, 400);
    const ok = await call("PUT", "/api/admin/settings", { token: "tok-admin", body: { holdDays: 7, defaultRate: { type: "percent", value: 12.5 }, minPayoutRupees: 1000 } });
    assert.equal(ok.json.settings.holdDays, 7);
    assert.equal(ok.json.settings.defaultRate.bps, 1250);
    assert.equal(ok.json.settings.minPayoutPaise, 100000);
    assert.equal(store._dump("audit").filter((a) => a.action === "settings_changed").length, 1);
  } finally { close(); }
});

test("Shopify admin client fetches and caches a client-credentials token", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: init.body, headers: init.headers });
    if (url.endsWith("/oauth/access_token")) return { ok: true, json: async () => ({ access_token: "shpat_x", expires_in: 86399 }) };
    return { ok: true, json: async () => ({ data: { discountCodeBasicCreate: { codeDiscountNode: { id: "gid://1" }, userErrors: [] } } }) };
  };
  const admin = createShopifyAdmin({ domain: "s.myshopify.com", clientId: "id", clientSecret: "sec", version: "2026-07", fetchImpl });
  assert.equal(admin.enabled, true);
  await admin.createDiscountCode({ code: "A1", percentBps: 1000, title: "t" });
  await admin.createDiscountCode({ code: "A2", percentBps: 1000, title: "t" });
  assert.equal(calls.filter((c) => c.url.endsWith("/oauth/access_token")).length, 1);
  assert.equal(JSON.parse(calls[0].body).grant_type, "client_credentials");
  assert.equal(calls[1].headers["X-Shopify-Access-Token"], "shpat_x");
  assert.equal(createShopifyAdmin({ domain: "s", version: "v" }).enabled, false);
});

test("auth proxy: sign-in, sign-up, reset and refresh go through the server", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, body: init.body });
    if (url.includes("signInWithPassword")) {
      const b = JSON.parse(init.body);
      if (b.password === "wrongpassword") return { ok: false, status: 400, json: async () => ({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }) };
      return { ok: true, json: async () => ({ idToken: "id1", refreshToken: "rf1", expiresIn: "3600", localId: "u1", email: b.email }) };
    }
    if (url.includes("signUp")) return { ok: true, json: async () => ({ idToken: "id2", refreshToken: "rf2", expiresIn: "3600", localId: "u2", email: "n@x.com" }) };
    if (url.includes("securetoken")) return { ok: true, json: async () => ({ id_token: "id3", refresh_token: "rf3", expires_in: "3600", user_id: "u1" }) };
    return { ok: true, json: async () => ({}) };
  };
  const { call, close } = await serve(createMemoryStore(), { fetchImpl });
  try {
    const ok = await call("POST", "/api/auth/partner/signin", { body: { email: "A@B.com", password: "password1" } });
    assert.equal(ok.status, 200);
    assert.deepEqual([ok.json.idToken, ok.json.uid, ok.json.email], ["id1", "u1", "a@b.com"]);
    assert.match(seen[0].url, /key=k$/);
    const wrong = await call("POST", "/api/auth/partner/signin", { body: { email: "a@b.com", password: "wrongpassword" } });
    assert.equal(wrong.status, 400);
    assert.match(wrong.json.error, /Incorrect email or password/);
    assert.equal((await call("POST", "/api/auth/partner/signin", { body: { email: "nope", password: "password1" } })).status, 400);
    assert.equal((await call("POST", "/api/auth/partner/signup", { body: { email: "n@x.com", password: "short" } })).status, 400);
    seen.length = 0;
    const up = await call("POST", "/api/auth/partner/signup", { body: { email: "n@x.com", password: "password1" } });
    assert.equal(up.json.idToken, "id2");
    assert.ok(seen.some((s) => s.url.includes("sendOobCode") && s.body.includes("VERIFY_EMAIL"))); // verification email sent
    assert.equal((await call("POST", "/api/auth/partner/reset", { body: { email: "n@x.com" } })).json.ok, true);
    const rf = await call("POST", "/api/auth/partner/refresh", { body: { refreshToken: "rf1" } });
    assert.deepEqual([rf.json.idToken, rf.json.refreshToken], ["id3", "rf3"]);
    assert.equal((await call("POST", "/api/auth/partner/resend", {})).status, 401);
    assert.equal((await call("POST", "/api/auth/partner/resend", { token: "tok-riya", body: {} })).status, 200);
  } finally { close(); }
});

test("auth proxy: reset never reveals whether an email exists; missing key is reported", async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "EMAIL_NOT_FOUND" } }) });
  const svc = createAuthService({ apiKey: "k", fetchImpl });
  assert.deepEqual(await svc.reset({ email: "ghost@x.com" }), { ok: true });
  await assert.rejects(createAuthService({ apiKey: "" }).signIn({ email: "a@b.com", password: "password1" }), /not configured/);
});

test("static server: serves the site, falls back to index.html, blocks path traversal", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-"));
  fs.mkdirSync(path.join(dir, "assets"));
  fs.writeFileSync(path.join(dir, "index.html"), "<h1>home</h1>");
  fs.writeFileSync(path.join(dir, "assets", "app-AbCd1234.js"), "x");
  fs.writeFileSync(path.join(path.dirname(dir), "secret.txt"), "nope");
  const server = http.createServer(createStaticHandler(dir));
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.match(await (await fetch(`${base}/`)).text(), /home/);
    assert.match(await (await fetch(`${base}/partner`)).text(), /home/); // client-side route
    const asset = await fetch(`${base}/assets/app-AbCd1234.js`);
    assert.match(asset.headers.get("cache-control"), /immutable/);
    assert.equal((await fetch(`${base}/missing.png`)).status, 404);
    const raw = await new Promise((resolve) => {
      http.get({ host: "127.0.0.1", port: server.address().port, path: "/..%2fsecret.txt" }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => resolve({ status: r.statusCode, b })); });
    });
    assert.ok(!raw.b.includes("nope"));
  } finally { server.close(); }
});

/* ---------------- Shopify admin (embedded app) ---------------- */

const SHOP = { clientId: "client-123", clientSecret: "shh-secret", shopDomain: "my-store.myshopify.com" };
function shopifyToken(over = {}, secret = SHOP.clientSecret, header = { alg: "HS256", typ: "JWT" }) {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: "https://my-store.myshopify.com/admin", dest: "https://my-store.myshopify.com", aud: SHOP.clientId, sub: "42", exp: now + 60, nbf: now - 5, iat: now, jti: "j", sid: "s", ...over };
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${b(header)}.${b(claims)}`;
  return `${body}.${crypto.createHmac("sha256", secret).update(body).digest("base64url")}`;
}

test("Shopify session tokens: only a valid token for OUR app and OUR store is accepted", () => {
  assert.equal(verifyShopifySessionToken(shopifyToken(), SHOP).sub, "42");
  assert.equal(verifyShopifySessionToken(shopifyToken({}, "other-secret"), SHOP), null); // wrong signature
  assert.equal(verifyShopifySessionToken(shopifyToken({ aud: "another-app" }), SHOP), null);
  assert.equal(verifyShopifySessionToken(shopifyToken({ dest: "https://evil.myshopify.com", iss: "https://evil.myshopify.com/admin" }), SHOP), null);
  assert.equal(verifyShopifySessionToken(shopifyToken({ iss: "https://other.myshopify.com/admin" }), SHOP), null); // iss/dest mismatch
  const past = Math.floor(Date.now() / 1000) - 120;
  assert.equal(verifyShopifySessionToken(shopifyToken({ exp: past }), SHOP), null);
  assert.equal(verifyShopifySessionToken(shopifyToken({ nbf: Math.floor(Date.now() / 1000) + 600 }), SHOP), null);
  assert.equal(verifyShopifySessionToken(shopifyToken({}, SHOP.clientSecret, { alg: "none" }), SHOP), null);
  assert.equal(verifyShopifySessionToken("a.b.c", SHOP), null);
  assert.equal(verifyShopifySessionToken(shopifyToken(), { ...SHOP, clientSecret: "" }), null);
});

test("Shopify staff open the admin with no separate login; Firebase tokens still work; forged tokens do not", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  const verify = createIdentity({
    firebaseVerify: async (t) => { if (t === "tok-riya") return { uid: "u1", email: "riya@example.com", emailVerified: true }; throw new Error("bad"); },
    shopify: SHOP,
  });
  const { call, close } = await serve(store, { verifyIdToken: verify });
  try {
    const staff = shopifyToken();
    const list = await call("GET", "/api/admin/influencers", { token: staff });
    assert.equal(list.status, 200);
    assert.equal((await call("GET", "/api/admin/reports/sales", { token: staff })).status, 200);
    const who = await call("GET", "/api/me", { token: staff });
    assert.equal(who.json.role, "admin");
    // actions by Shopify staff are attributed in the audit log
    await call("PUT", "/api/admin/settings", { token: staff, body: { holdDays: 3 } });
    assert.equal(store._dump("audit").find((a) => a.action === "settings_changed").by, "Shopify staff 42");
    // influencers using their own login still cannot reach admin
    assert.equal((await call("GET", "/api/admin/influencers", { token: "tok-riya" })).status, 403);
    // forged / wrong-store tokens are rejected
    assert.equal((await call("GET", "/api/admin/influencers", { token: shopifyToken({}, "guess") })).status, 401);
    assert.equal((await call("GET", "/api/admin/influencers", { token: shopifyToken({ dest: "https://evil.myshopify.com", iss: "https://evil.myshopify.com/admin" }) })).status, 401);
  } finally { close(); }
});

test("static server: /shopify-admin gets App Bridge + framing for Shopify only; other pages refuse framing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><html><head><title>x</title></head><body>app</body></html>");
  const on = http.createServer(createStaticHandler(dir, { embed: { clientId: "client-123" } }));
  const off = http.createServer(createStaticHandler(dir));
  await Promise.all([new Promise((r) => on.listen(0, r)), new Promise((r) => off.listen(0, r))]);
  try {
    const u = `http://127.0.0.1:${on.address().port}`;
    const emb = await fetch(`${u}/shopify-admin?embedded=1&host=abc`);
    const html = await emb.text();
    assert.match(html, /<head><meta name="shopify-api-key" content="client-123" \/><script src="https:\/\/cdn\.shopify\.com\/shopifycloud\/app-bridge\.js"><\/script>/);
    assert.match(emb.headers.get("content-security-policy"), /frame-ancestors https:\/\/admin\.shopify\.com https:\/\/\*\.myshopify\.com/);
    assert.equal(emb.headers.get("cache-control"), "no-store");
    const normal = await fetch(`${u}/partner`);
    assert.equal(normal.headers.get("content-security-policy"), "frame-ancestors 'self'");
    assert.ok(!(await normal.text()).includes("shopify-api-key"));
    assert.equal((await fetch(`http://127.0.0.1:${off.address().port}/shopify-admin`)).status, 404); // not configured: not exposed
  } finally { on.close(); off.close(); }
});

/* ---------------- partner and admin logins are separate ---------------- */

const fakeJwt = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
function firebaseFake() {
  // Two accounts in the same Firebase user list: one admin (has a role claim), one partner (none).
  const accounts = {
    "boss@aa100xtech.com": { password: "adminpass1", claims: { role: "super_admin", perms: [] } },
    "riya@example.com": { password: "partnerpass1", claims: {} },
  };
  return async (url, init) => {
    const body = init.body.startsWith("{") ? JSON.parse(init.body) : Object.fromEntries(new URLSearchParams(init.body));
    if (url.includes("signInWithPassword")) {
      const a = accounts[body.email];
      if (!a || a.password !== body.password) return { ok: false, status: 400, json: async () => ({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }) };
      return { ok: true, json: async () => ({ idToken: fakeJwt({ email: body.email, ...a.claims }), refreshToken: `rt:${body.email}`, expiresIn: "3600", localId: body.email, email: body.email }) };
    }
    if (url.includes("securetoken")) {
      const email = String(body.refresh_token).replace("rt:", "");
      return { ok: true, json: async () => ({ id_token: fakeJwt({ email, ...accounts[email].claims }), refresh_token: body.refresh_token, expires_in: "3600", user_id: email }) };
    }
    return { ok: true, json: async () => ({}) };
  };
}

test("separate logins: an admin password does not work on the partner login, and a partner password does not work on the admin login", async () => {
  const { call, close } = await serve(createMemoryStore(), { fetchImpl: firebaseFake() });
  try {
    const admin = { email: "boss@aa100xtech.com", password: "adminpass1" };
    const partner = { email: "riya@example.com", password: "partnerpass1" };
    // each account works on its own login
    assert.equal((await call("POST", "/api/auth/admin/signin", { body: admin })).status, 200);
    assert.equal((await call("POST", "/api/auth/partner/signin", { body: partner })).status, 200);
    // and is refused on the other
    const adminOnPartner = await call("POST", "/api/auth/partner/signin", { body: admin });
    assert.equal(adminOnPartner.status, 403);
    assert.match(adminOnPartner.json.error, /admin account/i);
    assert.equal(adminOnPartner.json.idToken, undefined); // no session is handed out
    const partnerOnAdmin = await call("POST", "/api/auth/admin/signin", { body: partner });
    assert.equal(partnerOnAdmin.status, 403);
    assert.match(partnerOnAdmin.json.error, /does not have admin access/i);
    assert.equal(partnerOnAdmin.json.idToken, undefined);
    // wrong password is still a normal sign-in error on both
    assert.equal((await call("POST", "/api/auth/admin/signin", { body: { ...admin, password: "nope-nope-1" } })).status, 400);
  } finally { close(); }
});

test("separate logins: a session of one kind cannot be renewed through the other kind's endpoint", async () => {
  const { call, close } = await serve(createMemoryStore(), { fetchImpl: firebaseFake() });
  try {
    assert.equal((await call("POST", "/api/auth/admin/refresh", { body: { refreshToken: "rt:boss@aa100xtech.com" } })).status, 200);
    assert.equal((await call("POST", "/api/auth/partner/refresh", { body: { refreshToken: "rt:boss@aa100xtech.com" } })).status, 403);
    assert.equal((await call("POST", "/api/auth/partner/refresh", { body: { refreshToken: "rt:riya@example.com" } })).status, 200);
    assert.equal((await call("POST", "/api/auth/admin/refresh", { body: { refreshToken: "rt:riya@example.com" } })).status, 403);
  } finally { close(); }
});

test("separate logins: admin accounts cannot be created through sign-up, and the old shared endpoints are gone", async () => {
  const { call, close } = await serve(createMemoryStore(), { fetchImpl: firebaseFake() });
  try {
    assert.equal((await call("POST", "/api/auth/admin/signup", { body: { email: "x@y.com", password: "password1" } })).status, 404);
    for (const old of ["signin", "signup", "refresh"]) {
      assert.equal((await call("POST", `/api/auth/${old}`, { body: { email: "boss@aa100xtech.com", password: "adminpass1", refreshToken: "x" } })).status, 404);
    }
    // a freshly registered partner has no role, so cannot use the admin login
    const up = await call("POST", "/api/auth/partner/signup", { body: { email: "new@x.com", password: "password1" } });
    assert.equal(up.status, 200);
  } finally { close(); }
});

test("an admin token cannot use the partner area, and a partner token cannot use the admin area", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  const { call, close } = await serve(store);
  try {
    for (const path of ["/api/influencer/dashboard", "/api/influencer/sales", "/api/influencer/commissions", "/api/influencer/payouts"]) {
      const r = await call("GET", path, { token: "tok-admin" });
      assert.equal(r.status, 403, path);
      assert.match(r.json.error, /Admin accounts cannot use the partner area/);
    }
    assert.equal((await call("POST", "/api/influencer/apply", { token: "tok-admin", body: { name: "x", pitch: "y".repeat(30) } })).status, 403);
    assert.equal((await call("GET", "/api/influencer/dashboard", { token: "tok-riya" })).status, 200);
    assert.equal((await call("GET", "/api/admin/influencers", { token: "tok-riya" })).status, 403);
  } finally { close(); }
});

import { HttpError, bad, notFound, nowIso, str, addDays } from "./util.js";
import { loadSettings } from "./settings.js";
import { effective, isLocked } from "./commission.js";
import { normEmail } from "./library.js";

// Customer refund requests.
//
// The customer asks, an admin approves, and Shopify actually returns the money. Shopify then sends the
// refunds/create webhook, and handleRefund (orders.js) reverses the influencer's commission exactly as it
// always has: a commission still in hold is reduced, one already paid becomes a clawback that the next
// payout nets off. This file never touches commissions itself, so a refund can only be counted once,
// whether it was started here or directly in the Shopify dashboard.
//
// One request per order (document id = order id). Whole orders only. A declined request is final.

export const REFUND_WINDOW_DEFAULT_DAYS = 7;
const CLAIM_STALE_MS = 5 * 60_000; // an "approving" claim older than this is assumed to be a crashed attempt

const audit = (tx, by, action, orderId, details, now) =>
  tx.add("audit", { at: now, by: by.email || by.uid || by, byUid: by.uid || null, action, entity: `refundRequests/${orderId}`, details });

const validOrderId = (orderId) => {
  const id = String(orderId || "");
  if (!/^\d{1,20}$/.test(id)) throw notFound("Order not found.");
  return id;
};

const BLOCKED_BY_REQUEST = {
  pending: "Your refund request is being reviewed.",
  approving: "Your refund request is being processed.",
  approved: "Your refund has been approved and is on its way.",
  refunded: "This order has already been refunded.",
  rejected: "Your refund request was declined. Please contact support if you have questions.",
};

// Can this customer ask for a refund on this order right now?
export function refundEligibility(order, request, settings, now) {
  const deadline = order.paidAt ? addDays(order.paidAt, settings.refundWindowDays) : null;
  if (request) return { eligible: false, deadline, reason: BLOCKED_BY_REQUEST[request.status] || "A refund request already exists for this order." };
  if (order.status !== "paid") return { eligible: false, deadline, reason: "This order can no longer be refunded." };
  if (!deadline || Date.parse(now) > Date.parse(deadline)) return { eligible: false, deadline, reason: `The ${settings.refundWindowDays}-day refund window for this order has passed.` };
  return { eligible: true, deadline, reason: null };
}

export async function requestRefund(store, { email, orderId, reason }, { now = nowIso() } = {}) {
  const id = validOrderId(orderId);
  const why = str(reason, { required: true, max: 500, name: "A reason" });
  const settings = await loadSettings(store);
  return store.transaction(async (tx) => {
    const order = await tx.get("orders", id);
    // Same message for "not yours" and "does not exist", so order numbers cannot be probed.
    if (!order || normEmail(order.email) !== normEmail(email)) throw notFound("Order not found.");
    const existing = await tx.get("refundRequests", id);
    const el = refundEligibility(order, existing, settings, now);
    if (!el.eligible) throw bad(el.reason);
    tx.set("refundRequests", id, {
      orderId: id, orderName: order.name, email: normEmail(email), reason: why,
      amountPaise: order.totalPaise, currency: order.currency || "INR",
      influencerId: (order.attribution && order.attribution.influencerId) || null,
      status: "pending", requestedAt: now,
      history: [{ at: now, status: "pending", by: "customer", note: why }],
    });
    audit(tx, "customer", "refund_requested", id, { email: normEmail(email), amountPaise: order.totalPaise }, now);
    return { orderId: id, status: "pending", deadline: el.deadline };
  });
}

// The customer's orders with what they can do about each one. Found through their library access, the same
// way the library does, so e-mail capitalisation in the order cannot hide an order.
export async function listMyOrders(store, email, { now = nowIso() } = {}) {
  const settings = await loadSettings(store);
  const access = await store.query("access", { where: [["email", "==", normEmail(email)]] });
  const ids = [...new Set(access.map((a) => a.orderId))];
  const out = [];
  for (const id of ids) {
    const order = await store.get("orders", id);
    if (!order || normEmail(order.email) !== normEmail(email)) continue;
    const request = await store.get("refundRequests", id);
    const el = refundEligibility(order, request, settings, now);
    out.push({
      orderId: id, name: order.name, paidAt: order.paidAt, totalPaise: order.totalPaise, currency: order.currency,
      status: order.status, items: order.lines.map((l) => l.title),
      refund: { canRequest: el.eligible, deadline: el.deadline, message: el.reason },
      request: request ? { status: request.status, requestedAt: request.requestedAt, decisionNote: request.status === "rejected" ? request.decisionNote || null : null } : null,
    });
  }
  return { orders: out.sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1)) };
}

/* ---------- admin ---------- */

// Each request comes with what it will do to the influencer's commission, so the admin sees the cost
// before approving. Nothing here is shown to customers.
export async function listRefundRequests(store, { status } = {}) {
  const where = status ? [["status", "==", status]] : [];
  const rows = await store.query("refundRequests", { where, orderBy: ["requestedAt", "desc"], limit: 300 });
  const out = [];
  for (const r of rows) {
    const c = await store.get("commissions", r.orderId);
    out.push({
      ...r,
      commission: c ? {
        influencerId: c.influencerId, influencerCode: c.influencerCode, state: c.state,
        // What is still at stake (before the refund) and what has already been taken off (after it).
        deductionPaise: effective(c), asClawback: isLocked(c),
        reversedPaise: c.reversedPaise || 0, clawbackPaise: c.clawbackPaise || 0,
        clawbackOutstandingPaise: Math.max(0, (c.clawbackPaise || 0) - (c.clawbackSettledPaise || 0)),
      } : null,
    });
  }
  return { requests: out };
}

export async function approveRefund(store, id, { note } = {}, admin, { shopify, now = nowIso() } = {}) {
  if (!shopify || !shopify.enabled) {
    throw new HttpError(503, "Shopify is not connected, so the refund cannot be issued from here. Refund the order in the Shopify dashboard instead; this request will complete by itself.", "shopify_off");
  }
  const by = admin.email || admin.uid;
  const decisionNote = str(note, { max: 500 });

  // Claim the request first so two admins cannot both send money.
  const claimed = await store.transaction(async (tx) => {
    const r = await tx.get("refundRequests", String(id));
    if (!r) throw notFound("Refund request not found.");
    const stale = r.status === "approving" && Date.parse(now) - Date.parse(r.approvingAt || 0) > CLAIM_STALE_MS;
    if (r.status !== "pending" && !stale) throw bad(`This request is already ${r.status}.`);
    const order = await tx.get("orders", r.orderId);
    if (!order || order.status !== "paid") throw bad("This order can no longer be refunded.");
    tx.merge("refundRequests", r.id, { status: "approving", approvingAt: now, approvingBy: by, lastError: null });
    return r;
  });

  let refund;
  try {
    refund = await shopify.refundOrder({ orderId: claimed.orderId, note: `Refund request ${claimed.orderName}` });
  } catch (e) {
    await store.merge("refundRequests", claimed.id, { status: "pending", lastError: String(e.message || e).slice(0, 300) });
    throw new HttpError(502, `Shopify could not issue the refund: ${e.message}. Nothing was refunded. You can try again, or refund the order in the Shopify dashboard and this request will complete by itself.`, "shopify_failed");
  }

  await store.transaction(async (tx) => {
    const r = await tx.get("refundRequests", claimed.id);
    // Shopify's refunds/create webhook can arrive before this line runs and already close the request as
    // "refunded". Never move a request backwards, or it stays on "approved" forever.
    const done = r.status === "refunded";
    tx.merge("refundRequests", claimed.id, {
      ...(done ? {} : { status: "approved" }),
      decidedAt: now, decidedBy: by, decisionNote: decisionNote || null, shopifyRefundId: refund.id || null,
      history: [...(r.history || []), { at: now, status: "approved", by, note: decisionNote }],
    });
    audit(tx, admin, "refund_approved", claimed.orderId, { amountPaise: claimed.amountPaise, shopifyRefundId: refund.id || null }, now);
  });
  return { status: "approved" };
}

export async function rejectRefund(store, id, { reason }, admin, { now = nowIso() } = {}) {
  const why = str(reason, { required: true, max: 500, name: "A reason" });
  const by = admin.email || admin.uid;
  return store.transaction(async (tx) => {
    const r = await tx.get("refundRequests", String(id));
    if (!r) throw notFound("Refund request not found.");
    if (r.status !== "pending") throw bad(`Only a pending request can be declined (this one is ${r.status}).`);
    tx.merge("refundRequests", r.id, {
      status: "rejected", decidedAt: now, decidedBy: by, decisionNote: why,
      history: [...(r.history || []), { at: now, status: "rejected", by, note: why }],
    });
    audit(tx, admin, "refund_rejected", r.orderId, { reason: why }, now);
    return { status: "rejected" };
  });
}

// Called from the refunds/create webhook after handleRefund has run. Closes the request once the whole
// order is refunded. Also covers refunds made directly in the Shopify dashboard.
export async function completeRefundRequest(store, { orderId, refundId, reversedPaise, now = nowIso() }) {
  const id = String(orderId);
  return store.transaction(async (tx) => {
    const r = await tx.get("refundRequests", id);
    if (!r || r.status === "refunded" || r.status === "rejected") return { updated: false };
    const order = await tx.get("orders", id);
    if (!order || order.status !== "refunded") return { updated: false };
    tx.merge("refundRequests", id, {
      status: "refunded", refundedAt: now, refundId: String(refundId),
      ...(reversedPaise !== undefined ? { commissionReversedPaise: reversedPaise } : {}),
      history: [...(r.history || []), { at: now, status: "refunded", by: "system", note: `Shopify refund ${refundId}` }],
    });
    return { updated: true };
  });
}

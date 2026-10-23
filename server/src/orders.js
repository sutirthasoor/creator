import { toPaise, addDays, nowIso } from "./util.js";
import { loadSettings } from "./settings.js";
import { resolveAttribution } from "./attribution.js";
import { computeCommission, reduceCommission, effective } from "./commission.js";
import { accessDocsForOrder, accessId } from "./library.js";

class RetryLater extends Error {
  constructor(msg) { super(msg); this.retry = true; }
}
export { RetryLater };

async function loadProductRates(store, order) {
  const out = {};
  for (const li of order.line_items || []) {
    if (li.product_id == null) continue;
    const id = String(li.product_id);
    if (!(id in out)) out[id] = await store.get("productRates", id);
  }
  return out;
}

// orders/paid: record the sale, attribute it, and create exactly one commission.
// Safe to receive twice: the webhook id and the order id are both checked inside the transaction.
export async function handleOrderPaid(store, { order, webhookId, secret, now = nowIso() }) {
  const orderId = String(order.id);
  const eventKey = webhookId || `orders-paid:${orderId}`;
  const settings = await loadSettings(store);
  const attribution = await resolveAttribution(store, order, settings, secret);

  let commission = null;
  if (attribution.attributed) {
    const productRates = await loadProductRates(store, order);
    const calc = computeCommission({ order, influencer: attribution.influencer, productRates, settings });
    if (calc.totalPaise > 0) {
      const created = order.created_at || now;
      commission = {
        orderId, orderName: order.name || orderId, influencerId: attribution.influencer.id,
        influencerCode: attribution.influencer.code, state: "pending", currency: order.currency || "INR",
        grossPaise: calc.totalPaise, adjustmentPaise: 0, reversedPaise: 0, clawbackPaise: 0, clawbackSettledPaise: 0,
        lines: calc.lines, flagged: attribution.flagged, payoutId: null,
        attribution: { source: attribution.source, clickId: attribution.clickId, couponCode: attribution.couponCode, flags: attribution.flags },
        ruleSnapshot: {
          commissionBase: settings.commissionBase, excludeTax: settings.excludeTax, holdDays: settings.holdDays,
          defaultRate: settings.defaultRate, influencerOverride: attribution.influencer.commissionOverride || null,
        },
        holdUntil: addDays(created, settings.holdDays), refundIds: [], createdAt: now,
        history: [{ at: now, from: null, to: "pending", by: "system", note: `Order ${order.name || orderId} paid` }],
      };
    }
  }

  const lines = (order.line_items || []).map((li) => ({
    lineItemId: String(li.id), productId: li.product_id == null ? null : String(li.product_id),
    title: li.title || "", qty: Number(li.quantity) || 0, unitPaise: toPaise(li.price),
    discountPaise: toPaise(li.total_discount), refundedQty: 0,
  }));
  const grossPaise = toPaise(order.total_line_items_price);
  const orderDoc = {
    orderId, name: order.name || orderId, email: order.email || (order.customer && order.customer.email) || null,
    currency: order.currency || "INR", createdAt: order.created_at || now, paidAt: now,
    grossPaise, discountPaise: toPaise(order.total_discounts), netPaise: toPaise(order.subtotal_price),
    totalPaise: toPaise(order.total_price), taxPaise: toPaise(order.total_tax),
    discountCodes: (order.discount_codes || []).map((d) => String(d.code || "").toUpperCase()),
    lines, status: "paid", refundedPaise: 0, refundIds: [],
    attribution: attribution.attributed
      ? { influencerId: attribution.influencer.id, source: attribution.source, couponCode: attribution.couponCode, flags: attribution.flags }
      : { influencerId: null, blocked: attribution.blocked || null, flags: attribution.flags },
  };

  return store.transaction(async (tx) => {
    const seen = await tx.get("webhookEvents", eventKey);
    const existing = await tx.get("orders", orderId);
    if (seen || existing) return { duplicate: true, orderId };
    tx.set("orders", orderId, orderDoc);
    for (const a of accessDocsForOrder(order, now)) tx.set("access", a.id, a.data); // unlocks the e-books for this customer
    if (commission) tx.set("commissions", orderId, commission);
    if (attribution.blocked || (attribution.attributed && attribution.flagged)) {
      tx.add("audit", {
        at: now, by: "system", action: "suspicious_referral", entity: `orders/${orderId}`,
        influencerId: attribution.influencerId || attribution.influencer.id, details: { flags: attribution.flags, blocked: attribution.blocked || null },
      });
    }
    tx.set("webhookEvents", eventKey, { topic: "orders/paid", orderId, at: now });
    return { duplicate: false, orderId, commissioned: Boolean(commission) };
  });
}

// refunds/create: reduce net revenue and reverse the matching share of commission.
export async function handleRefund(store, { refund, webhookId, now = nowIso() }) {
  const orderId = String(refund.order_id);
  const refundId = String(refund.id);
  const eventKey = webhookId || `refunds-create:${refundId}`;
  const txns = (refund.transactions || []).filter((t) => t.kind === "refund" && (!t.status || t.status === "success"));
  const refundedPaise = txns.reduce((s, t) => s + toPaise(t.amount), 0);

  return store.transaction(async (tx) => {
    const seen = await tx.get("webhookEvents", eventKey);
    const order = await tx.get("orders", orderId);
    if (seen) return { duplicate: true };
    if (!order) throw new RetryLater(`Order ${orderId} not recorded yet`);
    if ((order.refundIds || []).includes(refundId)) return { duplicate: true };
    const commission = await tx.get("commissions", orderId);

    const items = refund.refund_line_items || [];
    const orderLines = order.lines.map((l) => ({ ...l }));
    for (const it of items) {
      const l = orderLines.find((x) => x.lineItemId === String(it.line_item_id));
      if (l) l.refundedQty = Math.min(l.qty, l.refundedQty + (Number(it.quantity) || 0));
    }
    const orderPatch = {
      lines: orderLines, refundedPaise: order.refundedPaise + refundedPaise, refundIds: [...order.refundIds, refundId],
      status: order.refundedPaise + refundedPaise >= order.totalPaise ? "refunded" : "partially_refunded",
    };
    // Books that were fully refunded (or every book, if the whole order was refunded) are locked again.
    const lockIds = new Set(orderLines.filter((l) => l.productId && (orderPatch.status === "refunded" || l.refundedQty >= l.qty)).map((l) => l.productId));
    const locks = [];
    for (const p of lockIds) { const a = await tx.get("access", accessId(orderId, p)); if (a && a.status === "active") locks.push(a.id); }
    tx.merge("orders", orderId, orderPatch);
    for (const id of locks) tx.merge("access", id, { status: "revoked", revokedAt: now, revokedReason: "refund" });

    let cut = 0;
    if (commission) {
      const c = { ...commission, lines: commission.lines.map((l) => ({ ...l })), refundIds: [...(commission.refundIds || []), refundId] };
      let want = 0;
      if (items.length) {
        for (const it of items) {
          const l = c.lines.find((x) => x.lineItemId === String(it.line_item_id));
          if (!l) continue;
          const q = Math.min(Number(it.quantity) || 0, l.qty - l.refundedQty);
          if (q <= 0) continue;
          const amt = q === l.qty - l.refundedQty ? l.amountPaise - l.reversedPaise : Math.round((l.amountPaise * q) / l.qty);
          l.refundedQty += q;
          l.reversedPaise += amt;
          want += amt;
        }
      } else if (order.totalPaise > 0) {
        want = Math.round((c.grossPaise * refundedPaise) / order.totalPaise);
      }
      cut = reduceCommission(c, want, { kind: "reversal", by: "system", note: `Refund ${refundId}`, now });
      tx.set("commissions", orderId, c);
      if (cut > 0) {
        tx.add("audit", {
          at: now, by: "system", action: "commission_reversed", entity: `commissions/${orderId}`, influencerId: c.influencerId,
          details: { refundId, reversedPaise: cut, effectiveAfter: effective(c) },
        });
      }
    }
    tx.set("webhookEvents", eventKey, { topic: "refunds/create", orderId, refundId, at: now });
    return { duplicate: false, reversedPaise: cut };
  });
}

// orders/cancelled and disputes/create (chargeback): reverse whatever is left.
export async function handleFullReversal(store, { orderId, topic, ref, webhookId, now = nowIso() }) {
  orderId = String(orderId);
  const eventKey = webhookId || `${topic}:${ref || orderId}`;
  return store.transaction(async (tx) => {
    const seen = await tx.get("webhookEvents", eventKey);
    const order = await tx.get("orders", orderId);
    if (seen) return { duplicate: true };
    if (!order) throw new RetryLater(`Order ${orderId} not recorded yet`);
    const commission = await tx.get("commissions", orderId);
    const locks = [];
    for (const p of new Set((order.lines || []).map((l) => l.productId).filter(Boolean))) {
      const a = await tx.get("access", accessId(orderId, p));
      if (a && a.status === "active") locks.push(a.id);
    }
    let cut = 0;
    for (const id of locks) tx.merge("access", id, { status: "revoked", revokedAt: now, revokedReason: topic === "disputes/create" ? "chargeback" : "cancelled" });
    tx.merge("orders", orderId, { status: topic === "disputes/create" ? "chargeback" : "cancelled" });
    if (commission) {
      const c = { ...commission, lines: commission.lines.map((l) => ({ ...l })) };
      cut = reduceCommission(c, effective(c), { kind: "reversal", by: "system", note: topic === "disputes/create" ? "Chargeback" : "Order cancelled", now });
      tx.set("commissions", orderId, c);
      tx.add("audit", {
        at: now, by: "system", action: "commission_reversed", entity: `commissions/${orderId}`, influencerId: c.influencerId,
        details: { topic, reversedPaise: cut },
      });
    }
    tx.set("webhookEvents", eventKey, { topic, orderId, at: now });
    return { duplicate: false, reversedPaise: cut };
  });
}

import { nowIso, addDays } from "./util.js";
import { handleRefund, handleFullReversal } from "./orders.js";
import { completeRefundRequest } from "./refunds.js";

// Safety net for refunds. Normally Shopify's refunds/create webhook reverses the commission and ends the
// customer's access. But if that webhook was never set up, was switched off by Shopify after repeated failures,
// or the server was down for too long, a refunded order would stay unlocked and the partner would keep the
// commission. This asks Shopify directly which refunds exist for recent orders and applies any that were missed.
//
// Safe to run as often as you like: handleRefund ignores a refund it has already applied (by refund id), so a
// refund can never be deducted twice, whether it arrived by webhook or from here.
export async function reconcileRefunds(store, shopify, { lookbackDays = 60, limit = 120, now = nowIso() } = {}) {
  if (!shopify || !shopify.enabled || typeof shopify.fetchOrderRefunds !== "function") {
    return { skipped: "Shopify is not connected.", checked: 0, applied: 0, reversedPaise: 0 };
  }
  const since = addDays(now, -lookbackDays);
  const open = [
    ...(await store.query("orders", { where: [["status", "==", "paid"]] })),
    ...(await store.query("orders", { where: [["status", "==", "partially_refunded"]] })),
  ]
    .filter((o) => o.paidAt >= since)
    .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))
    .slice(0, limit);
  if (!open.length) return { checked: 0, applied: 0, reversedPaise: 0 };

  const remote = await shopify.fetchOrderRefunds(open.map((o) => o.orderId));
  let applied = 0;
  let reversedPaise = 0;
  const errors = [];
  for (const o of open) {
    const info = remote.get(o.orderId);
    if (!info) continue;
    try {
      for (const refund of info.refunds) {
        if ((o.refundIds || []).includes(String(refund.id))) continue;
        const r = await handleRefund(store, { refund, webhookId: `reconcile:refund:${refund.id}`, now });
        if (r.duplicate) continue;
        await completeRefundRequest(store, { orderId: o.orderId, refundId: refund.id, reversedPaise: r.reversedPaise, now });
        applied += 1;
        reversedPaise += r.reversedPaise || 0;
        console.log(`[reconcile] applied missed refund ${refund.id} on order ${o.name} (commission reversed ${r.reversedPaise || 0} paise)`);
      }
      if (info.cancelled && o.status === "paid") {
        const r = await handleFullReversal(store, { orderId: o.orderId, topic: "orders/cancelled", webhookId: `reconcile:cancel:${o.orderId}`, now });
        if (!r.duplicate) { applied += 1; reversedPaise += r.reversedPaise || 0; console.log(`[reconcile] applied missed cancellation of order ${o.name}`); }
      }
    } catch (e) {
      errors.push({ orderId: o.orderId, error: String(e.message || e).slice(0, 200) });
      console.error(`[reconcile] order ${o.name} failed`, e);
    }
  }
  return { checked: open.length, applied, reversedPaise, ...(errors.length ? { errors } : {}) };
}

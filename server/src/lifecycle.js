import { bad, notFound, nowIso, str } from "./util.js";
import { loadSettings } from "./settings.js";
import { effective, isLocked, reduceCommission, stamp } from "./commission.js";

const audit = (tx, admin, action, entity, details, now) =>
  tx.add("audit", { at: now, by: admin.email || admin.uid, byUid: admin.uid, action, entity, details });

// Pending -> Approved. Flagged commissions need an explicit admin decision.
export async function approveCommissions(store, ids, admin, { force = false, now = nowIso() } = {}) {
  if (!Array.isArray(ids) || !ids.length) throw bad("Choose at least one commission.");
  return store.transaction(async (tx) => {
    const docs = [];
    for (const id of ids) {
      const c = await tx.get("commissions", String(id));
      if (!c) throw notFound(`Commission ${id} not found.`);
      docs.push(c);
    }
    let approved = 0;
    for (const c of docs) {
      if (c.state !== "pending") continue;
      if (c.flagged && !force) continue;
      const next = { ...c };
      stamp(next, "approved", admin.email || admin.uid, "Approved by admin", now);
      tx.set("commissions", c.id, next);
      audit(tx, admin, "commission_approved", `commissions/${c.id}`, { orderId: c.orderId, amountPaise: effective(c) }, now);
      approved += 1;
    }
    return { approved, skipped: docs.length - approved };
  });
}

// Scheduled job: once the hold period ends, commissions become payable.
// With auto-approve on, unflagged pending ones are approved first.
export async function promoteDue(store, { now = nowIso() } = {}) {
  const settings = await loadSettings(store);
  let approved = 0;
  let payable = 0;
  if (settings.autoApprove) {
    const due = await store.query("commissions", { where: [["state", "==", "pending"], ["holdUntil", "<=", now]] });
    for (const c of due) {
      if (c.flagged) continue;
      await store.transaction(async (tx) => {
        const cur = await tx.get("commissions", c.id);
        if (!cur || cur.state !== "pending") return;
        const n = { ...cur };
        stamp(n, "approved", "system", "Auto-approved after hold period", now);
        stamp(n, "payable", "system", "Hold period ended", now);
        tx.set("commissions", c.id, n);
        approved += 1;
        payable += 1;
      });
    }
  }
  const ready = await store.query("commissions", { where: [["state", "==", "approved"], ["holdUntil", "<=", now]] });
  for (const c of ready) {
    await store.transaction(async (tx) => {
      const cur = await tx.get("commissions", c.id);
      if (!cur || cur.state !== "approved") return;
      const n = { ...cur };
      stamp(n, "payable", "system", "Hold period ended", now);
      tx.set("commissions", c.id, n);
      payable += 1;
    });
  }
  return { approved, payable };
}

// Manual correction with a mandatory reason. Records before/after in the audit log.
export async function adjustCommission(store, id, { deltaPaise, reason }, admin, { now = nowIso() } = {}) {
  const why = str(reason, { required: true, max: 500, name: "A reason" });
  const delta = Number(deltaPaise);
  if (!Number.isInteger(delta) || delta === 0) throw bad("Adjustment must be a non-zero amount.");
  return store.transaction(async (tx) => {
    const c = await tx.get("commissions", String(id));
    if (!c) throw notFound("Commission not found.");
    const n = { ...c, history: [...(c.history || [])] };
    const before = effective(n);
    if (delta < 0) {
      reduceCommission(n, -delta, { kind: "adjustment", by: admin.email || admin.uid, note: `Adjustment: ${why}`, now });
    } else {
      if (isLocked(n)) throw bad("A paid or payout-locked commission cannot be increased. Record a separate adjustment instead.");
      if (n.state === "reversed") stamp(n, "pending", admin.email || admin.uid, "Reinstated by adjustment", now);
      n.adjustmentPaise = (n.adjustmentPaise || 0) + delta;
      n.history.push({ at: now, from: n.state, to: n.state, by: admin.email || admin.uid, note: `Adjustment +${delta} paise: ${why}` });
    }
    tx.set("commissions", c.id, n);
    audit(tx, admin, "commission_adjusted", `commissions/${c.id}`, { reason: why, beforePaise: before, afterPaise: effective(n), deltaPaise: delta }, now);
    return { beforePaise: before, afterPaise: effective(n) };
  });
}

const outstandingClawback = (c) => Math.max(0, (c.clawbackPaise || 0) - (c.clawbackSettledPaise || 0));

// Create a payout record for one influencer from selected payable commissions.
// Outstanding clawbacks (refunds after payment) are netted off the total.
export async function createPayout(store, { influencerId, commissionIds, method, notes }, admin, { now = nowIso() } = {}) {
  if (!Array.isArray(commissionIds) || !commissionIds.length) throw bad("Select at least one commission.");
  const m = str(method, { required: true, max: 40, name: "Payout method" });
  const settings = await loadSettings(store);
  return store.transaction(async (tx) => {
    const inf = await tx.get("influencers", String(influencerId));
    if (!inf) throw notFound("Influencer not found.");
    const picked = [];
    for (const id of commissionIds) {
      const c = await tx.get("commissions", String(id));
      if (!c) throw notFound(`Commission ${id} not found.`);
      if (c.influencerId !== inf.id) throw bad("A commission belongs to a different influencer.");
      if (c.state !== "payable" || c.payoutId) throw bad(`Order ${c.orderName} is not payable (state: ${c.state}).`);
      picked.push(c);
    }
    const owed = (await tx.query("commissions", { where: [["influencerId", "==", inf.id]] })).filter((c) => outstandingClawback(c) > 0);
    const subtotal = picked.reduce((s, c) => s + effective(c), 0);
    const clawbackItems = owed.map((c) => ({ commissionId: c.id, amountPaise: outstandingClawback(c) }));
    const clawback = clawbackItems.reduce((s, i) => s + i.amountPaise, 0);
    const amountPaise = subtotal - clawback;
    if (amountPaise <= 0) throw bad("Nothing to pay after refunds are netted off.");
    if (amountPaise < settings.minPayoutPaise) throw bad(`Below the minimum payout of ₹${settings.minPayoutPaise / 100}.`);
    const payoutId = tx.add("payouts", {
      influencerId: inf.id, influencerName: inf.name, status: "processing", method: m, notes: str(notes, { max: 500 }),
      subtotalPaise: subtotal, clawbackPaise: clawback, amountPaise, currency: "INR",
      items: picked.map((c) => ({ commissionId: c.id, orderName: c.orderName, amountPaise: effective(c) })),
      clawbackItems, createdAt: now, createdBy: admin.email || admin.uid, reference: null, paidAt: null,
    });
    for (const c of picked) {
      tx.set("commissions", c.id, { ...c, payoutId, payoutItemPaise: effective(c) });
    }
    audit(tx, admin, "payout_created", `payouts/${payoutId}`, { influencerId: inf.id, amountPaise, commissionIds, method: m }, now);
    return { payoutId, amountPaise };
  });
}

// Record the transfer: UTR/reference and date are required. Commissions become Paid.
export async function markPayoutPaid(store, payoutId, { reference, paidAt, method }, admin, { now = nowIso() } = {}) {
  const ref = str(reference, { required: true, max: 120, name: "Transaction reference" });
  const when = paidAt ? new Date(paidAt) : new Date(now);
  if (Number.isNaN(when.getTime())) throw bad("Payment date is invalid.");
  return store.transaction(async (tx) => {
    const p = await tx.get("payouts", String(payoutId));
    if (!p) throw notFound("Payout not found.");
    if (p.status !== "processing") throw bad(`This payout is already ${p.status}.`);
    const byId = new Map();
    for (const it of p.items) byId.set(it.commissionId, await tx.get("commissions", it.commissionId));
    for (const it of p.clawbackItems || []) {
      if (!byId.has(it.commissionId)) byId.set(it.commissionId, await tx.get("commissions", it.commissionId));
    }
    const paidIds = new Set(p.items.map((i) => i.commissionId));
    const settled = new Map((p.clawbackItems || []).map((i) => [i.commissionId, i.amountPaise]));
    for (const [id, c] of byId) {
      const n = { ...c };
      if (paidIds.has(id)) {
        stamp(n, "paid", admin.email || admin.uid, `Paid via payout ${p.id} (${ref})`, now);
        n.paidAt = when.toISOString();
      }
      if (settled.has(id)) n.clawbackSettledPaise = (n.clawbackSettledPaise || 0) + settled.get(id);
      tx.set("commissions", id, n);
    }
    tx.merge("payouts", p.id, { status: "paid", reference: ref, paidAt: when.toISOString(), method: str(method, { max: 40 }) || p.method, paidBy: admin.email || admin.uid });
    audit(tx, admin, "payout_paid", `payouts/${p.id}`, { amountPaise: p.amountPaise, reference: ref, method: method || p.method }, now);
    return { status: "paid" };
  });
}

export async function cancelPayout(store, payoutId, reason, admin, { now = nowIso() } = {}) {
  const why = str(reason, { required: true, max: 500, name: "A reason" });
  return store.transaction(async (tx) => {
    const p = await tx.get("payouts", String(payoutId));
    if (!p) throw notFound("Payout not found.");
    if (p.status !== "processing") throw bad(`Only a processing payout can be cancelled (this one is ${p.status}).`);
    const comms = [];
    for (const it of p.items) comms.push(await tx.get("commissions", it.commissionId));
    for (const c of comms) tx.set("commissions", c.id, { ...c, payoutId: null, payoutItemPaise: null });
    tx.merge("payouts", p.id, { status: "cancelled", cancelReason: why, cancelledAt: now });
    audit(tx, admin, "payout_cancelled", `payouts/${p.id}`, { reason: why }, now);
    return { status: "cancelled" };
  });
}

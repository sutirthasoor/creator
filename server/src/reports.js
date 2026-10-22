import { effective } from "./commission.js";

const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
const inRange = (iso, { from, to }) => (!from || iso >= from) && (!to || iso <= `${to}T23:59:59.999Z` || iso <= to);

// Everything an influencer or admin needs about one influencer, computed from the same
// commission/order records the payouts use, so totals always reconcile.
export async function influencerSummary(store, influencerId) {
  const commissions = await store.query("commissions", { where: [["influencerId", "==", influencerId]] });
  const orders = await store.query("orders", { where: [["attribution.influencerId", "==", influencerId]] });
  const clicks = await store.count("clicks", [["influencerId", "==", influencerId]]);
  const by = (state) => sum(commissions.filter((c) => c.state === state), effective);
  const outstanding = sum(commissions, (c) => Math.max(0, (c.clawbackPaise || 0) - (c.clawbackSettledPaise || 0)));
  const units = sum(orders, (o) => sum(o.lines, (l) => l.qty));
  const refundedUnits = sum(orders, (o) => sum(o.lines, (l) => l.refundedQty));
  const grossSales = sum(orders, (o) => o.grossPaise);
  const refunded = sum(orders, (o) => o.refundedPaise);
  const payable = by("payable");
  return {
    clicks, orders: orders.length, unitsSold: units, refundedUnits, validUnits: units - refundedUnits,
    conversionRate: clicks ? orders.length / clicks : 0,
    grossSalesPaise: grossSales, refundedPaise: refunded, netSalesPaise: grossSales - refunded,
    commission: {
      earnedPaise: sum(commissions, effective), pendingPaise: by("pending"), approvedPaise: by("approved"), payablePaise: payable,
      paidPaise: sum(commissions.filter((c) => c.state === "paid"), (c) => c.payoutItemPaise || 0),
      reversedPaise: sum(commissions, (c) => c.reversedPaise || 0),
      clawbackOutstandingPaise: outstanding, balancePayablePaise: payable - outstanding,
    },
  };
}

export async function salesOverview(store, range) {
  const orders = (await store.query("orders")).filter((o) => inRange(o.paidAt, range));
  const gross = sum(orders, (o) => o.grossPaise);
  const refunds = sum(orders, (o) => o.refundedPaise);
  const net = sum(orders, (o) => o.netPaise) - refunds;
  return [{
    orders: orders.length, unitsSold: sum(orders, (o) => sum(o.lines, (l) => l.qty)), grossSalesPaise: gross,
    discountsPaise: sum(orders, (o) => o.discountPaise), refundsPaise: refunds, netSalesPaise: net,
    averageOrderValuePaise: orders.length ? Math.round(sum(orders, (o) => o.totalPaise) / orders.length) : 0,
  }];
}

export async function ebookPerformance(store, range) {
  const orders = (await store.query("orders")).filter((o) => inRange(o.paidAt, range));
  const commissions = await store.query("commissions");
  const rows = new Map();
  for (const o of orders) {
    for (const l of o.lines) {
      const key = l.productId || l.title;
      const r = rows.get(key) || { product: l.title, units: 0, refundedUnits: 0, grossPaise: 0, affiliateSharePaise: 0 };
      r.units += l.qty;
      r.refundedUnits += l.refundedQty;
      r.grossPaise += l.unitPaise * l.qty - l.discountPaise;
      rows.set(key, r);
    }
  }
  for (const c of commissions) {
    for (const l of c.lines) {
      const r = rows.get(l.productId || l.title);
      if (r) r.affiliateSharePaise += l.amountPaise - l.reversedPaise;
    }
  }
  return [...rows.values()];
}

export async function influencerPerformance(store, { influencerId } = {}) {
  const list = influencerId ? [await store.get("influencers", influencerId)] : await store.query("influencers", { where: [["status", "in", ["active", "suspended"]]] });
  const rows = [];
  for (const inf of list.filter(Boolean)) {
    const s = await influencerSummary(store, inf.id);
    rows.push({
      influencer: inf.name, referralId: inf.code, status: inf.status, clicks: s.clicks, orders: s.orders, conversionRate: s.conversionRate,
      unitsSold: s.unitsSold, grossSalesPaise: s.grossSalesPaise, refundedPaise: s.refundedPaise, netSalesPaise: s.netSalesPaise,
      commissionEarnedPaise: s.commission.earnedPaise, pendingPaise: s.commission.pendingPaise + s.commission.approvedPaise,
      payablePaise: s.commission.balancePayablePaise, paidPaise: s.commission.paidPaise, reversedPaise: s.commission.reversedPaise,
    });
  }
  return rows;
}

export async function commissionLiability(store, { influencerId } = {}) {
  const where = influencerId ? [["influencerId", "==", influencerId]] : [];
  const commissions = await store.query("commissions", { where });
  const names = new Map((await store.query("influencers")).map((i) => [i.id, i.name]));
  const rows = new Map();
  for (const c of commissions) {
    const r = rows.get(c.influencerId) || { influencer: names.get(c.influencerId) || c.influencerId, pendingPaise: 0, approvedPaise: 0, payablePaise: 0, paidPaise: 0, reversedPaise: 0 };
    if (c.state === "pending") r.pendingPaise += effective(c);
    if (c.state === "approved") r.approvedPaise += effective(c);
    if (c.state === "payable") r.payablePaise += effective(c);
    if (c.state === "paid") r.paidPaise += c.payoutItemPaise || 0;
    r.reversedPaise += c.reversedPaise || 0;
    rows.set(c.influencerId, r);
  }
  return [...rows.values()];
}

export async function payoutReport(store, range) {
  const payouts = (await store.query("payouts")).filter((p) => inRange(p.createdAt, range));
  return payouts.map((p) => ({
    influencer: p.influencerName, amountPaise: p.amountPaise, method: p.method, status: p.status, paidAt: p.paidAt || "",
    reference: p.reference || "", entries: p.items.map((i) => i.orderName).join(" "),
  }));
}

export async function refundReport(store, range) {
  const orders = (await store.query("orders")).filter((o) => o.refundedPaise > 0 && inRange(o.paidAt, range));
  const rows = [];
  for (const o of orders) {
    const c = await store.get("commissions", o.orderId);
    rows.push({
      order: o.name, products: o.lines.map((l) => l.title).join(", "), refundedPaise: o.refundedPaise,
      influencerId: o.attribution.influencerId || "", commissionReversedPaise: c ? c.reversedPaise || 0 : 0,
      clawbackPaise: c ? c.clawbackPaise || 0 : 0,
    });
  }
  return rows;
}

export const REPORTS = { sales: salesOverview, ebooks: ebookPerformance, influencers: influencerPerformance, liability: commissionLiability, payouts: payoutReport, refunds: refundReport };

// Money columns (…Paise) are exported in rupees so spreadsheets read naturally.
export function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (key, v) => {
    let t = v === null || v === undefined ? "" : key.endsWith("Paise") ? (v / 100).toFixed(2) : String(v);
    if (/^[=+\-@]/.test(t)) t = `'${t}`; // stops spreadsheet formula injection
    return `"${t.replaceAll('"', '""')}"`;
  };
  const head = cols.map((c) => `"${c.replace(/Paise$/, " (INR)")}"`).join(",");
  return [head, ...rows.map((r) => cols.map((c) => cell(c, r[c])).join(","))].join("\r\n");
}

import { toPaise, bpsOf } from "./util.js";

export const effective = (c) => Math.max(0, c.grossPaise + (c.adjustmentPaise || 0) - (c.reversedPaise || 0));
export const isLocked = (c) => c.state === "paid" || Boolean(c.payoutId);

export function describeRate(rate) {
  if (!rate) return "";
  return rate.type === "percent" ? `${(rate.bps / 100).toString()}%` : `₹${(rate.paise / 100).toFixed(2)} per unit`;
}

// Pick the rate for one product: influencer override, then per-product override, then default.
function pickRate(influencer, productRate, settings) {
  if (productRate && productRate.eligible === false) return { rate: null, source: "ineligible" };
  if (influencer.commissionOverride) return { rate: influencer.commissionOverride, source: "influencer" };
  if (productRate && productRate.type) return { rate: { type: productRate.type, bps: productRate.bps, paise: productRate.paise }, source: "product" };
  return { rate: settings.defaultRate, source: "default" };
}

// Line-by-line commission with a snapshot of the rule used, so later rate changes never
// rewrite history.
export function computeCommission({ order, influencer, productRates, settings }) {
  const lines = [];
  let total = 0;
  for (const li of order.line_items || []) {
    const qty = Number(li.quantity) || 0;
    if (qty < 1) continue;
    const grossPaise = toPaise(li.price) * qty;
    const discount = toPaise(li.total_discount);
    let netPaise = grossPaise - discount;
    if (settings.excludeTax && order.taxes_included) {
      netPaise -= (li.tax_lines || []).reduce((s, t) => s + toPaise(t.price), 0);
    }
    netPaise = Math.max(0, netPaise);
    const base = settings.commissionBase === "gross" ? grossPaise : netPaise;
    const productId = li.product_id == null ? null : String(li.product_id);
    const { rate, source } = pickRate(influencer, productId ? productRates[productId] : null, settings);
    let amountPaise = 0;
    if (rate) amountPaise = rate.type === "percent" ? bpsOf(base, rate.bps) : rate.paise * qty;
    amountPaise = Math.min(amountPaise, base);
    total += amountPaise;
    lines.push({
      lineItemId: String(li.id), productId, title: li.title || "", qty,
      grossPaise, netPaise, basePaise: base, rate, rateSource: source,
      amountPaise, reversedPaise: 0, refundedQty: 0,
    });
  }
  return { lines, totalPaise: total };
}

export const stamp = (c, to, by, note, now) => {
  c.history = [...(c.history || []), { at: now, from: c.state, to, by, note: note || "" }];
  c.state = to;
};

// Take money off a commission (refund, cancellation, or a negative admin adjustment).
// Commissions already paid or sitting in a payout are never silently edited: the amount
// is recorded as a clawback that the next payout nets off.
export function reduceCommission(c, amount, { kind, by, note, now }) {
  const cut = Math.min(Math.max(0, amount), effective(c));
  if (cut === 0) return 0;
  if (kind === "adjustment") c.adjustmentPaise = (c.adjustmentPaise || 0) - cut;
  else c.reversedPaise = (c.reversedPaise || 0) + cut;
  const locked = isLocked(c);
  if (locked) c.clawbackPaise = (c.clawbackPaise || 0) + cut;
  c.history = [...(c.history || []), { at: now, from: c.state, to: c.state, by, note: `${note || kind}: -${cut} paise${locked ? " (clawback)" : ""}` }];
  if (!locked && effective(c) === 0) stamp(c, "reversed", by, note || "Fully reversed", now);
  return cut;
}

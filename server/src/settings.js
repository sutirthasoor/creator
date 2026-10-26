import { bad, normalizeRate } from "./util.js";

// Seed values only. The admin edits the live copy in Firestore (settings/affiliate);
// nothing here is read after the first save except as a fallback for missing keys.
export const DEFAULT_SETTINGS = {
  defaultRate: { type: "percent", bps: 1000 },
  commissionBase: "net", // "net" (after discounts) or "gross" (before discounts)
  excludeTax: true,
  holdDays: 14,
  autoApprove: true,
  minPayoutPaise: 50000,
  attributionWindowDays: 30,
  conflictRule: "coupon", // when link and coupon belong to different partners: "coupon" or "link"
  selfReferral: "block", // "block" or "flag"
  couponDiscountBps: 1000,
  refundWindowDays: 7, // customers can request a refund this many days after paying
};

export async function loadSettings(store) {
  const saved = (await store.get("settings", "affiliate")) || {};
  const { id, ...rest } = saved;
  return { ...DEFAULT_SETTINGS, ...rest };
}

export function validateSettings(input, current) {
  const s = { ...current };
  const int = (v, name, min, max) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw bad(`${name} must be a whole number between ${min} and ${max}.`);
    return n;
  };
  if (input.defaultRate) s.defaultRate = normalizeRate(input.defaultRate, "Default commission");
  if (input.commissionBase !== undefined) {
    if (!["net", "gross"].includes(input.commissionBase)) throw bad("Commission base must be net or gross.");
    s.commissionBase = input.commissionBase;
  }
  if (input.excludeTax !== undefined) s.excludeTax = Boolean(input.excludeTax);
  if (input.autoApprove !== undefined) s.autoApprove = Boolean(input.autoApprove);
  if (input.holdDays !== undefined) s.holdDays = int(input.holdDays, "Hold period (days)", 0, 365);
  if (input.attributionWindowDays !== undefined) s.attributionWindowDays = int(input.attributionWindowDays, "Attribution window (days)", 1, 365);
  if (input.minPayoutRupees !== undefined) s.minPayoutPaise = int(input.minPayoutRupees, "Minimum payout (rupees)", 0, 10000000) * 100;
  if (input.couponDiscountPercent !== undefined) {
    const p = Number(input.couponDiscountPercent);
    if (!Number.isFinite(p) || p < 0 || p > 100) throw bad("Coupon discount must be between 0 and 100%.");
    s.couponDiscountBps = Math.round(p * 100);
  }
  if (input.refundWindowDays !== undefined) s.refundWindowDays = int(input.refundWindowDays, "Refund window (days)", 0, 90);
  if (input.conflictRule !== undefined) {
    if (!["coupon", "link"].includes(input.conflictRule)) throw bad("Conflict rule must be coupon or link.");
    s.conflictRule = input.conflictRule;
  }
  if (input.selfReferral !== undefined) {
    if (!["block", "flag"].includes(input.selfReferral)) throw bad("Self-referral handling must be block or flag.");
    s.selfReferral = input.selfReferral;
  }
  return s;
}

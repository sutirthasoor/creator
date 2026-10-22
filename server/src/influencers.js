import { bad, forbidden, notFound, nowIso, randomDigits, str, normalizeRate, sha256 } from "./util.js";
import { signToken } from "./token.js";
import { loadSettings } from "./settings.js";

const audit = (tx, admin, action, entity, details, now) =>
  tx.add("audit", { at: now, by: admin.email || admin.uid, byUid: admin.uid, action, entity, details });

const SOCIAL_KEYS = ["instagram", "youtube", "tiktok", "twitter", "website"];

function cleanSocial(input = {}) {
  const out = {};
  for (const k of SOCIAL_KEYS) out[k] = str(input[k], { max: 200 });
  return out;
}

function cleanPayout(input = {}) {
  const method = str(input.method, { max: 20 }) || "upi";
  if (!["upi", "bank"].includes(method)) throw bad("Payout method must be UPI or bank.");
  return {
    method, upi: str(input.upi, { max: 80 }), accountName: str(input.accountName, { max: 120 }),
    accountNumber: str(input.accountNumber, { max: 40 }), ifsc: str(input.ifsc, { max: 20 }).toUpperCase(),
  };
}

// An influencer sends an application. One per signed-in account, verified email only.
export async function applyAsInfluencer(store, user, form, { now = nowIso() } = {}) {
  if (!user.emailVerified) throw forbidden("Please verify your email address before applying.");
  const existing = await store.get("influencers", user.uid);
  if (existing) throw bad("You have already applied.");
  const doc = {
    uid: user.uid, email: String(user.email || "").toLowerCase(), name: str(form.name, { required: true, max: 120, name: "Name" }),
    phone: str(form.phone, { max: 20 }), social: cleanSocial(form.social),
    audience: str(form.audience, { max: 60 }), pitch: str(form.pitch, { required: true, max: 1000, name: "Tell us about your audience" }),
    payout: cleanPayout(form.payout), status: "submitted", code: null, couponCode: null, commissionOverride: null,
    createdAt: now, history: [{ at: now, from: null, to: "submitted", by: user.email, note: "Applied" }],
  };
  await store.transaction(async (tx) => {
    if (await tx.get("influencers", user.uid)) throw bad("You have already applied.");
    tx.set("influencers", user.uid, doc);
    tx.add("audit", { at: now, by: user.email, byUid: user.uid, action: "influencer_applied", entity: `influencers/${user.uid}`, details: {} });
  });
  return { status: "submitted" };
}

export async function updateOwnProfile(store, uid, form, { now = nowIso() } = {}) {
  const cur = await store.get("influencers", uid);
  if (!cur) throw notFound("No influencer profile.");
  const patch = {
    name: form.name !== undefined ? str(form.name, { required: true, max: 120, name: "Name" }) : cur.name,
    phone: form.phone !== undefined ? str(form.phone, { max: 20 }) : cur.phone,
    social: form.social ? cleanSocial(form.social) : cur.social,
    payout: form.payout ? cleanPayout(form.payout) : cur.payout,
  };
  await store.merge("influencers", uid, patch);
  if (form.payout) await store.add("audit", { at: now, by: cur.email, byUid: uid, action: "payout_details_changed", entity: `influencers/${uid}`, details: {} });
  return { ok: true };
}

async function uniqueCode(store, name) {
  const base = (name.replace(/[^a-z]/gi, "").toUpperCase() + "CM").slice(0, 4);
  for (let i = 0; i < 20; i += 1) {
    const code = `${base}${randomDigits(4)}`;
    const [byCode] = await store.query("influencers", { where: [["code", "==", code]], limit: 1 });
    const [byCoupon] = await store.query("influencers", { where: [["couponCode", "==", code]], limit: 1 });
    if (!byCode && !byCoupon) return code;
  }
  throw new Error("Could not generate a unique code");
}

const TRANSITIONS = {
  review: { from: ["submitted"], to: "under_review" },
  approve: { from: ["submitted", "under_review"], to: "active" },
  reject: { from: ["submitted", "under_review"], to: "rejected" },
  suspend: { from: ["active"], to: "suspended" },
  reactivate: { from: ["suspended"], to: "active" },
  reconsider: { from: ["rejected"], to: "under_review" },
};

// Admin changes an influencer's status. Approval issues the referral code and coupon.
// `shopify` creates the discount code in Shopify (best effort; the sync status is recorded).
export async function changeStatus(store, id, { action, note, couponCode }, admin, { shopify, settings, now = nowIso() } = {}) {
  const rule = TRANSITIONS[action];
  if (!rule) throw bad("Unknown action.");
  const cfg = settings || (await loadSettings(store));
  const inf = await store.get("influencers", String(id));
  if (!inf) throw notFound("Influencer not found.");
  if (!rule.from.includes(inf.status)) throw bad(`Cannot ${action} an influencer who is ${inf.status}.`);

  let code = inf.code;
  let coupon = inf.couponCode;
  let couponSync = inf.couponSync || null;
  if (action === "approve" && !code) {
    code = await uniqueCode(store, inf.name);
    const wanted = str(couponCode, { max: 30 }).toUpperCase().replace(/[^A-Z0-9]/g, "");
    coupon = wanted || code;
    if (wanted) {
      const [clash] = await store.query("influencers", { where: [["couponCode", "==", coupon]], limit: 1 });
      if (clash) throw bad("That coupon code is already used.");
    }
    couponSync = { state: "pending" };
    if (shopify && shopify.enabled) {
      try {
        const r = await shopify.createDiscountCode({ code: coupon, percentBps: cfg.couponDiscountBps, title: `Creator Moves 365 – ${inf.name}` });
        couponSync = { state: "created", shopifyId: r.id };
      } catch (e) {
        couponSync = { state: "failed", error: String(e.message).slice(0, 200) };
      }
    }
  }

  await store.transaction(async (tx) => {
    const cur = await tx.get("influencers", inf.id);
    if (cur.status !== inf.status) throw bad("This influencer changed while you were working. Reload and try again.");
    const history = [...(cur.history || []), { at: now, from: cur.status, to: rule.to, by: admin.email || admin.uid, note: str(note, { max: 500 }) }];
    tx.merge("influencers", inf.id, { status: rule.to, code, couponCode: coupon, couponSync, history, approvedAt: action === "approve" ? now : cur.approvedAt || null });
    audit(tx, admin, "influencer_status_changed", `influencers/${inf.id}`, { from: cur.status, to: rule.to, note: str(note, { max: 500 }), code, coupon }, now);
  });
  return { status: rule.to, code, couponCode: coupon, couponSync };
}

// Per-influencer commission override ("per-influencer override" from the PRD).
export async function setInfluencerRate(store, id, rateInput, admin, { now = nowIso() } = {}) {
  const inf = await store.get("influencers", String(id));
  if (!inf) throw notFound("Influencer not found.");
  const rate = rateInput === null ? null : normalizeRate(rateInput, "Commission rate");
  await store.transaction(async (tx) => {
    tx.merge("influencers", inf.id, { commissionOverride: rate });
    audit(tx, admin, "influencer_rate_changed", `influencers/${inf.id}`, { before: inf.commissionOverride || null, after: rate }, now);
  });
  return { commissionOverride: rate };
}

export async function setProductRate(store, productId, input, admin, { now = nowIso() } = {}) {
  const id = str(String(productId), { required: true, max: 40, name: "Product id" });
  const before = await store.get("productRates", id);
  const doc = { eligible: input.eligible !== false, title: str(input.title, { max: 200 }) };
  if (input.rate) Object.assign(doc, normalizeRate(input.rate, "Commission rate"));
  await store.transaction(async (tx) => {
    tx.set("productRates", id, doc);
    audit(tx, admin, "product_rate_changed", `productRates/${id}`, { before: before || null, after: doc }, now);
  });
  return doc;
}

// A visitor arrives through a referral link. Server logs the click and issues the signed token.
export async function recordClick(store, { code, landing, referrer, ip }, { secret, now = nowIso() }) {
  const clean = str(code, { max: 20 }).toUpperCase();
  if (!clean) throw notFound();
  const [inf] = await store.query("influencers", { where: [["code", "==", clean]], limit: 1 });
  if (!inf || inf.status !== "active") throw notFound();
  const settings = await loadSettings(store);
  const clickId = await store.add("clicks", {
    influencerId: inf.id, code: clean, at: now, landing: str(landing, { max: 300 }), referrer: str(referrer, { max: 300 }),
    ipHash: sha256(`${secret}:${ip || ""}`),
  });
  const expires = Date.parse(now) + settings.attributionWindowDays * 86400000;
  return { token: signToken({ i: inf.id, c: clickId, t: Date.parse(now), x: expires }, secret), expiresAt: new Date(expires).toISOString() };
}

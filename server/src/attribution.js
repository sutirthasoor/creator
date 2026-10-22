import { verifyToken } from "./token.js";

const norm = (s) => String(s || "").trim().toLowerCase();

// Decide who (if anyone) gets credit for a paid order. Rules from the PRD:
// link + coupon from the same partner = one commission; different partners = admin rule;
// no partner = direct sale; self-referral is blocked or flagged.
export async function resolveAttribution(store, order, settings, secret) {
  const flags = [];
  let link = null;
  let coupon = null;

  const attr = (order.note_attributes || []).find((a) => a.name === "cm_ref");
  if (attr) {
    const p = verifyToken(attr.value, secret);
    if (!p) flags.push("invalid_token");
    else if (Date.parse(order.created_at || new Date().toISOString()) > p.x) flags.push("token_expired");
    else {
      const inf = await store.get("influencers", p.i);
      if (inf && inf.status === "active") link = { influencer: inf, clickId: p.c };
      else flags.push("link_partner_inactive");
    }
  }

  for (const d of order.discount_codes || []) {
    const code = String(d.code || "").toUpperCase();
    const [inf] = await store.query("influencers", { where: [["couponCode", "==", code]], limit: 1 });
    if (inf) {
      if (inf.status === "active") { coupon = { influencer: inf, code }; break; }
      flags.push("coupon_partner_inactive");
    }
  }

  if (!link && !coupon) return { attributed: false, flags };

  let chosen;
  let source;
  if (link && coupon) {
    if (link.influencer.id === coupon.influencer.id) {
      chosen = link.influencer; source = "link+coupon";
    } else {
      flags.push("link_coupon_conflict");
      if (settings.conflictRule === "link") { chosen = link.influencer; source = "link"; }
      else { chosen = coupon.influencer; source = "coupon"; }
    }
  } else if (link) { chosen = link.influencer; source = "link"; }
  else { chosen = coupon.influencer; source = "coupon"; }

  const buyer = norm(order.email || (order.customer && order.customer.email));
  const self = buyer && buyer === norm(chosen.email);
  if (self) {
    flags.push("self_referral");
    if (settings.selfReferral === "block") {
      return { attributed: false, blocked: "self_referral", influencerId: chosen.id, flags };
    }
  }

  return {
    attributed: true,
    influencer: chosen,
    source,
    clickId: link ? link.clickId : null,
    couponCode: coupon ? coupon.code : null,
    flagged: flags.some((f) => f === "self_referral" || f === "link_coupon_conflict"),
    flags,
  };
}

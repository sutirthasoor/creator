import { PARTNER } from "./partnerConfig.js";

// A referral link looks like https://creatormoves365.in/products/masterbook?ref=CODE.
// The server logs the click and returns a signed token; we keep it until it expires and
// attach it to the Shopify cart so the paid order can be credited to the right partner.
const KEY = "cm365.ref";

const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && Date.parse(v.expiresAt) > Date.now() ? v : null;
  } catch {
    return null;
  }
};

export const getReferralToken = () => (read() ? read().token : null);

export async function captureReferral() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("ref");
  if (!code) return;
  url.searchParams.delete("ref");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  if (!/^[A-Za-z0-9]{3,20}$/.test(code)) return;
  try {
    const res = await fetch(`${PARTNER.apiBase}/public/click`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, landing: url.pathname, referrer: document.referrer }),
    });
    if (!res.ok) return;
    const data = await res.json();
    // Last click wins: a new valid referral replaces an older one.
    localStorage.setItem(KEY, JSON.stringify({ token: data.token, expiresAt: data.expiresAt }));
  } catch {
    /* tracking must never get in the way of browsing */
  }
}

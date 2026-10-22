import { SHOPIFY } from "./config.js";

export function formatMoney(m, locale = SHOPIFY.locale) {
  if (!m) return "";
  const n = Number(m.amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: m.currencyCode,
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${m.amount} ${m.currencyCode}`;
  }
}

export function discountPercent(price, compareAt) {
  if (!price || !compareAt) return 0;
  const p = Number(price.amount);
  const c = Number(compareAt.amount);
  return c > p && c > 0 ? Math.round((1 - p / c) * 100) : 0;
}

export function humanize(s) {
  return s ? String(s).toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "";
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(SHOPIFY.locale, { day: "numeric", month: "short", year: "numeric" });
}

// Shopify CDN images accept ?width=; leave any other URL (e.g. local demo assets) untouched.
export function sizedImage(url, width) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    if (!/shopify/i.test(u.hostname)) return url;
    u.searchParams.set("width", String(width));
    return u.toString();
  } catch {
    return url;
  }
}

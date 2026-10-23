import crypto from "node:crypto";
import { Readable } from "node:stream";
import { HttpError, bad, forbidden, notFound } from "./util.js";
import { signToken, verifyToken } from "./token.js";

// E-book library: a paid order unlocks the books in it for that customer's email. The book itself is a PDF
// link (Google Drive or any https link) that only the admin sees; the server streams it to the reader,
// so the link is never sent to the browser.

export const HANDLED = Symbol("handled");
export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const accessId = (orderId, productId) => `${orderId}_${productId}`;
const READ_MINUTES = 15;

// One access record per product in a paid order.
export function accessDocsForOrder(order, now) {
  const email = normEmail(order.email || (order.customer && order.customer.email));
  if (!email) return [];
  const out = new Map();
  for (const li of order.line_items || []) {
    if (li.product_id == null) continue;
    const productId = String(li.product_id);
    if (out.has(productId)) continue;
    out.set(productId, {
      id: accessId(order.id, productId),
      data: { email, orderId: String(order.id), orderName: order.name || String(order.id), productId, title: li.title || "", status: "active", grantedAt: now },
    });
  }
  return [...out.values()];
}

/* ---------- who is this customer? (asks Shopify, so we never trust the browser's word) ---------- */

export function createCustomerVerifier({ shopDomain, apiVersion, storefrontToken, graphqlUrl, fetchImpl = fetch, now = Date.now }) {
  const cache = new Map();
  let discovered = null;
  const unauth = () => new HttpError(401, "Please sign in again.");

  async function customerEndpoint() {
    if (graphqlUrl) return graphqlUrl;
    if (discovered) return discovered;
    const fallback = `https://${shopDomain}/customer/api/${apiVersion}/graphql`;
    try {
      const r = await fetchImpl(`https://${shopDomain}/.well-known/customer-account-api`, { headers: { Accept: "application/json" } });
      if (r.ok) {
        const j = await r.json();
        if (j && j.graphql_api) { discovered = j.graphql_api; return discovered; }
      }
    } catch { /* use the fallback */ }
    return fallback;
  }

  async function lookup(token, mode) {
    if (mode === "classic") {
      if (!storefrontToken) throw new HttpError(503, "The library is not set up for classic accounts (SHOPIFY_STOREFRONT_TOKEN is missing).");
      const r = await fetchImpl(`https://${shopDomain}/api/${apiVersion}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": storefrontToken },
        body: JSON.stringify({ query: "query($t:String!){customer(customerAccessToken:$t){email}}", variables: { t: token } }),
      });
      if (!r.ok) throw unauth();
      const j = await r.json();
      return j && j.data && j.data.customer && j.data.customer.email;
    }
    const r = await fetchImpl(await customerEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: token },
      body: JSON.stringify({ query: "{ customer { emailAddress { emailAddress } } }" }),
    });
    if (!r.ok) throw unauth();
    const j = await r.json();
    const c = j && j.data && j.data.customer;
    return c && c.emailAddress && c.emailAddress.emailAddress;
  }

  return {
    async verify(token, mode) {
      const m = mode === "classic" ? "classic" : "oauth";
      if (!token || typeof token !== "string" || token.length > 4096) throw unauth();
      const key = crypto.createHash("sha256").update(`${m}:${token}`).digest("hex");
      const hit = cache.get(key);
      if (hit && hit.until > now()) return { email: hit.email };
      let email;
      try { email = await lookup(token, m); } catch (e) { if (e instanceof HttpError) throw e; throw unauth(); }
      email = normEmail(email);
      if (!email) throw unauth();
      if (cache.size > 2000) cache.clear();
      cache.set(key, { email, until: now() + 5 * 60_000 });
      return { email };
    },
  };
}

/* ---------- book links ---------- */

// Turns what the admin pasted into the address the server downloads from. Returns null if it is not usable.
export function resolveSource(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "drive.google.com" || host === "docs.google.com") {
    const m = /\/d\/([\w-]{10,})/.exec(u.pathname);
    const id = m ? m[1] : u.searchParams.get("id");
    if (!id || !/^[\w-]{10,}$/.test(id)) return null;
    return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  }
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  return u.toString();
}

export async function listEbooks(store) {
  const rows = await store.query("ebooks");
  return rows.map((r) => ({ productId: r.id, title: r.title || "", ready: Boolean(r.url), hasLink: Boolean(r.url), updatedAt: r.updatedAt || null }));
}

export async function setEbook(store, productId, body, user, { now }) {
  if (!/^\d{1,20}$/.test(String(productId))) throw bad("That is not a valid product ID.");
  const url = String(body.url || "").trim();
  if (url && !resolveSource(url)) throw bad("Paste a Google Drive link (shared as 'Anyone with the link') or another https link to the PDF.");
  const title = String(body.title || "").trim().slice(0, 200);
  await store.transaction(async (tx) => {
    tx.set("ebooks", String(productId), { title, url, updatedAt: now });
    tx.add("audit", { at: now, by: user.email, byUid: user.uid, action: url ? "ebook_link_set" : "ebook_link_cleared", entity: `ebooks/${productId}`, details: { title } });
  });
  return { ok: true, productId: String(productId), ready: Boolean(url) };
}

/* ---------- the customer's library ---------- */

async function activeAccess(store, email) {
  const rows = await store.query("access", { where: [["email", "==", normEmail(email)]] });
  return rows.filter((r) => r.status === "active").sort((a, b) => (a.grantedAt < b.grantedAt ? 1 : -1));
}

export async function listLibrary(store, email) {
  const rows = await activeAccess(store, email);
  const seen = new Set();
  const items = [];
  for (const r of rows) {
    if (seen.has(r.productId)) continue;
    seen.add(r.productId);
    const book = await store.get("ebooks", r.productId);
    items.push({ productId: r.productId, title: (book && book.title) || r.title || "E-book", orderName: r.orderName, grantedAt: r.grantedAt, ready: Boolean(book && book.url) });
  }
  return { items };
}

export async function openBook(store, email, productId, { secret, now = Date.now() }) {
  const rows = await activeAccess(store, email);
  const owned = rows.find((r) => r.productId === String(productId));
  if (!owned) throw forbidden("This book is not in your library. If you just paid, wait a minute and refresh.");
  const book = await store.get("ebooks", String(productId));
  if (!book || !book.url) throw new HttpError(409, "This book is being prepared. Please check back soon.");
  const token = signToken({ e: normEmail(email), p: String(productId), x: now + READ_MINUTES * 60_000 }, secret);
  return { token, title: book.title || owned.title || "E-book", minutes: READ_MINUTES };
}

// Streams the PDF to the browser. The signed address works for a few minutes, and access is checked again each time.
export async function streamBook(store, token, { secret, now = Date.now(), fetchImpl = fetch, res, headers = {}, frameOrigins = [] }) {
  const t = verifyToken(token, secret);
  if (!t || !t.e || !t.p || !(t.x > now)) throw new HttpError(401, "This reading link has expired. Open the book again from your library.");
  const rows = await activeAccess(store, t.e);
  if (!rows.some((r) => r.productId === t.p)) throw forbidden("You no longer have access to this book.");
  const book = await store.get("ebooks", t.p);
  const src = book && book.url ? resolveSource(book.url) : null;
  if (!src) throw notFound("This book is not available right now.");

  let r;
  try { r = await fetchImpl(src, { redirect: "follow", headers: { "User-Agent": "CreatorMoves365-Reader" } }); } catch { throw new HttpError(502, "The book could not be loaded. Please try again."); }
  const type = (r.headers.get("content-type") || "").toLowerCase();
  if (!r.ok || !r.body || /text\/html/.test(type)) {
    throw new HttpError(502, "The book file could not be opened. The link must be a PDF shared as 'Anyone with the link'.");
  }
  const out = {
    ...headers,
    "Content-Type": "application/pdf",
    "Content-Disposition": 'inline; filename="ebook.pdf"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `frame-ancestors 'self' ${frameOrigins.join(" ")}`.trim(),
  };
  const len = r.headers.get("content-length");
  if (len) out["Content-Length"] = len;
  res.writeHead(200, out);
  const stream = Readable.fromWeb(r.body);
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
  return HANDLED;
}

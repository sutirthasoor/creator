import { HttpError, bad, forbidden, notFound, nowIso, str, normalizeRate } from "./util.js";
import { loadSettings, validateSettings, DEFAULT_SETTINGS } from "./settings.js";
import { verifyWebhook } from "./shopify.js";
import { handleOrderPaid, handleRefund, handleFullReversal } from "./orders.js";
import { approveCommissions, promoteDue, adjustCommission, createPayout, markPayoutPaid, cancelPayout } from "./lifecycle.js";
import { applyAsInfluencer, updateOwnProfile, changeStatus, setInfluencerRate, setProductRate, recordClick } from "./influencers.js";
import { influencerSummary, REPORTS, toCsv } from "./reports.js";

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
};

function readRaw(req) {
  if (req.rawBody) return Promise.resolve(Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody));
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 2_000_000) { reject(new HttpError(413, "Request too large.")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Simple per-instance limiter for the public and sensitive endpoints.
function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const h = (hits.get(key) || []).filter((t) => now - t < windowMs);
    h.push(now);
    hits.set(key, h);
    if (hits.size > 5000) hits.clear();
    if (h.length > max) throw new HttpError(429, "Too many requests. Please slow down.");
  };
}

const ADMIN_ROLES = ["super_admin", "admin"];

export function createHandler({ store, config, verifyIdToken, shopify, authService, clock = nowIso }) {
  const routes = [];
  const add = (method, path, opts, fn) => routes.push({ method, parts: path.split("/").filter(Boolean), opts, fn });
  const clickLimit = limiter(30, 60_000);
  const applyLimit = limiter(10, 3_600_000);
  const authLimit = limiter(20, 600_000);

  const requirePerm = (user, perm) => {
    if (!ADMIN_ROLES.includes(user.role)) throw forbidden();
    if (user.role === "super_admin") return;
    const need = Array.isArray(perm) ? perm : [perm];
    if (!need.some((p) => (user.perms || []).includes(p))) throw forbidden("Your role does not include this area.");
  };

  /* ---------- public ---------- */
  add("GET", "/api/health", { auth: false }, async () => ({ ok: true }));

  add("POST", "/api/public/click", { auth: false }, async ({ body, ip }) => {
    clickLimit(ip);
    return recordClick(store, { code: body.code, landing: body.landing, referrer: body.referrer, ip }, { secret: config.attributionSecret, now: clock() });
  });

  // Sign-in proxy (Firebase Authentication REST), so the browser only ever talks to this server.
  // Partners and admins have SEPARATE sign-in endpoints. Each refuses the other kind of account, both when
  // signing in and when renewing a session, so an admin password does not open the partner area and a
  // partner password does not open the admin area. Accounts are told apart by the "role" claim that
  // only scripts/make-admin.js can set.
  const claimsOf = (idToken) => {
    try { return JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString()); } catch { return {}; }
  };
  const isAdminToken = (idToken) => ADMIN_ROLES.includes(claimsOf(idToken).role);
  const KIND = {
    partner: (session) => { if (isAdminToken(session.idToken)) throw forbidden("This is an admin account. Use the admin sign-in."); return session; },
    admin: (session) => { if (!isAdminToken(session.idToken)) throw forbidden("This account does not have admin access."); return session; },
  };
  const authRoute = (path, fn) => add("POST", path, { auth: false }, async (ctx) => { authLimit(ctx.ip); return fn(ctx); });
  const resend = ({ headers }) => {
    const h = headers.authorization || "";
    if (!h.startsWith("Bearer ")) throw new HttpError(401, "Please sign in.");
    return authService.resendVerification(h.slice(7));
  };
  for (const kind of ["partner", "admin"]) {
    const check = KIND[kind];
    authRoute(`/api/auth/${kind}/signin`, async ({ body }) => check(await authService.signIn(body)));
    authRoute(`/api/auth/${kind}/refresh`, async ({ body }) => check(await authService.refresh(body)));
    authRoute(`/api/auth/${kind}/reset`, ({ body }) => authService.reset(body));
    authRoute(`/api/auth/${kind}/resend`, resend);
  }
  // Only partners can create their own account. Admin accounts are created by the owner with scripts/make-admin.js.
  authRoute("/api/auth/partner/signup", ({ body }) => authService.signUp(body));

  add("POST", "/api/webhooks/shopify", { auth: false, raw: true }, async ({ raw, headers, body }) => {
    if (!verifyWebhook(raw, headers["x-shopify-hmac-sha256"], config.webhookSecret)) throw new HttpError(401, "Invalid signature.");
    const topic = headers["x-shopify-topic"];
    const webhookId = headers["x-shopify-webhook-id"];
    const now = clock();
    switch (topic) {
      case "orders/paid": return handleOrderPaid(store, { order: body, webhookId, secret: config.attributionSecret, now });
      case "refunds/create": return handleRefund(store, { refund: body, webhookId, now });
      case "orders/cancelled": return handleFullReversal(store, { orderId: body.id, topic, webhookId, now });
      case "disputes/create": return handleFullReversal(store, { orderId: body.order_id, topic, ref: body.id, webhookId, now });
      default: return { ignored: topic };
    }
  });

  /* ---------- signed-in user ---------- */
  add("GET", "/api/me", {}, async ({ user }) => {
    const inf = await store.get("influencers", user.uid);
    return { uid: user.uid, email: user.email, emailVerified: user.emailVerified, role: user.role || null, perms: user.perms || [],
      influencer: inf ? { name: inf.name, status: inf.status, code: inf.code, couponCode: inf.couponCode } : null };
  });

  add("POST", "/api/influencer/apply", {}, async ({ user, body }) => {
    applyLimit(user.uid);
    return applyAsInfluencer(store, user, body, { now: clock() });
  });

  const requireInfluencer = async (user) => {
    const inf = await store.get("influencers", user.uid);
    if (!inf) throw notFound("You have not applied yet.");
    return inf;
  };

  add("GET", "/api/influencer/dashboard", {}, async ({ user }) => {
    const inf = await requireInfluencer(user);
    const settings = await loadSettings(store);
    const base = { status: inf.status, name: inf.name, email: inf.email, phone: inf.phone, social: inf.social, payout: inf.payout, code: inf.code, couponCode: inf.couponCode };
    if (inf.status !== "active") return { profile: base, summary: null };
    return {
      profile: base, summary: await influencerSummary(store, inf.id),
      terms: { holdDays: settings.holdDays, attributionWindowDays: settings.attributionWindowDays, minPayoutPaise: settings.minPayoutPaise,
        rate: inf.commissionOverride || settings.defaultRate, couponDiscountBps: settings.couponDiscountBps },
    };
  });

  // An influencer sees only their own records, and never customer emails.
  add("GET", "/api/influencer/sales", {}, async ({ user }) => {
    const inf = await requireInfluencer(user);
    const orders = await store.query("orders", { where: [["attribution.influencerId", "==", inf.id]], orderBy: ["paidAt", "desc"], limit: 200 });
    return { sales: orders.map((o) => ({ order: o.name, date: o.paidAt, status: o.status, source: o.attribution.source, items: o.lines.map((l) => ({ title: l.title, qty: l.qty, refundedQty: l.refundedQty })), amountPaise: o.netPaise, refundedPaise: o.refundedPaise })) };
  });

  add("GET", "/api/influencer/commissions", {}, async ({ user }) => {
    const inf = await requireInfluencer(user);
    const rows = await store.query("commissions", { where: [["influencerId", "==", inf.id]], orderBy: ["createdAt", "desc"], limit: 200 });
    return { commissions: rows.map((c) => ({ order: c.orderName, date: c.createdAt, state: c.state, grossPaise: c.grossPaise, reversedPaise: c.reversedPaise, adjustmentPaise: c.adjustmentPaise || 0, holdUntil: c.holdUntil })) };
  });

  add("GET", "/api/influencer/payouts", {}, async ({ user }) => {
    const inf = await requireInfluencer(user);
    const rows = await store.query("payouts", { where: [["influencerId", "==", inf.id]], orderBy: ["createdAt", "desc"], limit: 100 });
    return { payouts: rows.map((p) => ({ date: p.paidAt || p.createdAt, status: p.status, method: p.method, amountPaise: p.amountPaise, reference: p.reference, orders: p.items.map((i) => i.orderName) })) };
  });

  add("PUT", "/api/influencer/profile", {}, async ({ user, body }) => updateOwnProfile(store, user.uid, body, { now: clock() }));

  /* ---------- admin ---------- */
  add("GET", "/api/admin/settings", { perm: "partners" }, async () => ({ settings: await loadSettings(store), defaults: DEFAULT_SETTINGS }));
  add("PUT", "/api/admin/settings", { perm: "partners" }, async ({ user, body }) => {
    const before = await loadSettings(store);
    const after = validateSettings(body, before);
    await store.transaction(async (tx) => {
      tx.set("settings", "affiliate", after);
      tx.add("audit", { at: clock(), by: user.email, byUid: user.uid, action: "settings_changed", entity: "settings/affiliate", details: { before, after } });
    });
    return { settings: after };
  });

  add("GET", "/api/admin/influencers", { perm: "partners" }, async ({ query }) => {
    const where = query.status ? [["status", "==", query.status]] : [];
    let rows = await store.query("influencers", { where, orderBy: ["createdAt", "desc"], limit: 500 });
    const q = (query.q || "").toLowerCase();
    if (q) rows = rows.filter((r) => [r.name, r.email, r.code, r.couponCode].some((v) => String(v || "").toLowerCase().includes(q)));
    const out = [];
    for (const r of rows) {
      const { payout, ...safe } = r;
      out.push({ ...safe, summary: r.status === "active" || r.status === "suspended" ? await influencerSummary(store, r.id) : null });
    }
    return { influencers: out };
  });

  add("GET", "/api/admin/influencers/:id", { perm: "partners" }, async ({ params }) => {
    const inf = await store.get("influencers", params.id);
    if (!inf) throw notFound();
    return {
      influencer: inf, summary: await influencerSummary(store, inf.id),
      commissions: await store.query("commissions", { where: [["influencerId", "==", inf.id]], orderBy: ["createdAt", "desc"], limit: 200 }),
      payouts: await store.query("payouts", { where: [["influencerId", "==", inf.id]], orderBy: ["createdAt", "desc"], limit: 100 }),
    };
  });

  add("POST", "/api/admin/influencers/:id/status", { perm: "partners" }, async ({ user, params, body }) =>
    changeStatus(store, params.id, body, user, { shopify, now: clock() }));

  add("PUT", "/api/admin/influencers/:id/rate", { perm: "partners" }, async ({ user, params, body }) =>
    setInfluencerRate(store, params.id, body.clear ? null : body.rate, user, { now: clock() }));

  add("GET", "/api/admin/product-rates", { perm: "partners" }, async () => ({ rates: await store.query("productRates") }));
  add("PUT", "/api/admin/product-rates/:productId", { perm: "partners" }, async ({ user, params, body }) =>
    setProductRate(store, params.productId, body, user, { now: clock() }));

  add("GET", "/api/admin/commissions", { perm: "partners" }, async ({ query }) => {
    const where = [];
    if (query.state) where.push(["state", "==", query.state]);
    if (query.influencerId) where.push(["influencerId", "==", query.influencerId]);
    return { commissions: await store.query("commissions", { where, orderBy: ["createdAt", "desc"], limit: 500 }) };
  });
  add("POST", "/api/admin/commissions/approve", { perm: "partners" }, async ({ user, body }) =>
    approveCommissions(store, body.ids, user, { force: Boolean(body.force), now: clock() }));
  add("POST", "/api/admin/commissions/:id/adjust", { perm: "finance" }, async ({ user, params, body }) =>
    adjustCommission(store, params.id, body, user, { now: clock() }));
  add("POST", "/api/admin/jobs/promote", { perm: "finance" }, async () => promoteDue(store, { now: clock() }));

  add("GET", "/api/admin/payouts", { perm: "finance" }, async ({ query }) => {
    const where = query.status ? [["status", "==", query.status]] : [];
    return { payouts: await store.query("payouts", { where, orderBy: ["createdAt", "desc"], limit: 300 }) };
  });
  add("POST", "/api/admin/payouts", { perm: "finance" }, async ({ user, body }) => createPayout(store, body, user, { now: clock() }));
  add("POST", "/api/admin/payouts/:id/paid", { perm: "finance" }, async ({ user, params, body }) => markPayoutPaid(store, params.id, body, user, { now: clock() }));
  add("POST", "/api/admin/payouts/:id/cancel", { perm: "finance" }, async ({ user, params, body }) => cancelPayout(store, params.id, body.reason, user, { now: clock() }));

  add("GET", "/api/admin/reports/:name", { perm: ["partners", "finance"] }, async ({ params, query }) => {
    const fn = REPORTS[params.name];
    if (!fn) throw notFound("Unknown report.");
    const rows = await fn(store, { from: query.from, to: query.to, influencerId: query.influencerId });
    return query.format === "csv" ? { csv: toCsv(rows), filename: `${params.name}-${(query.from || "all")}.csv` } : { rows };
  });

  add("GET", "/api/admin/audit", { perm: "finance" }, async ({ query }) => {
    const where = query.action ? [["action", "==", query.action]] : [];
    return { entries: await store.query("audit", { where, orderBy: ["at", "desc"], limit: 300 }) };
  });

  /* ---------- plumbing ---------- */
  function match(route, method, parts) {
    if (route.method !== method || route.parts.length !== parts.length) return null;
    const params = {};
    for (let i = 0; i < parts.length; i += 1) {
      const p = route.parts[i];
      if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(parts[i]);
      else if (p !== parts[i]) return null;
    }
    return params;
  }

  const allowed = (origin) => origin && (config.allowedOrigins || []).includes(origin);

  return async function handler(req, res) {
    const origin = req.headers.origin;
    const cors = allowed(origin)
      ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS" }
      : {};
    try {
      if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
      const url = new URL(req.url, "http://x");
      const parts = url.pathname.split("/").filter(Boolean);
      let route = null;
      let params = null;
      for (const r of routes) {
        params = match(r, req.method, parts);
        if (params) { route = r; break; }
      }
      if (!route) return json(res, 404, { error: "Not found." }, cors);

      const raw = ["POST", "PUT"].includes(req.method) ? await readRaw(req) : Buffer.alloc(0);
      let body = {};
      if (raw.length) {
        try { body = JSON.parse(raw.toString("utf8")); } catch { throw bad("Request body must be JSON."); }
      }

      let user = null;
      if (route.opts.auth !== false) {
        const h = req.headers.authorization || "";
        if (!h.startsWith("Bearer ")) throw new HttpError(401, "Please sign in.");
        user = await verifyIdToken(h.slice(7)).catch(() => null);
        if (!user) throw new HttpError(401, "Your session has expired. Please sign in again.");
        if (route.opts.perm) requirePerm(user, route.opts.perm);
        if (url.pathname.startsWith("/api/influencer/") && ADMIN_ROLES.includes(user.role)) {
          throw forbidden("Admin accounts cannot use the partner area. Use a partner account.");
        }
      }
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      const result = await route.fn({ user, params, query: Object.fromEntries(url.searchParams), body, raw, headers: req.headers, ip });
      return json(res, 200, result, cors);
    } catch (e) {
      if (e instanceof HttpError) return json(res, e.status, { error: e.message, code: e.code }, cors);
      if (e && e.retry) return json(res, 409, { error: e.message, retry: true }, cors); // Shopify retries non-2xx
      console.error("Unhandled error", e);
      return json(res, 500, { error: "Something went wrong on our side." }, cors);
    }
  };
}

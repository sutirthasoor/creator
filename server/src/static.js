import fs from "node:fs";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".woff": "font/woff", ".txt": "text/plain; charset=utf-8", ".map": "application/json",
};

// Serves the built storefront (npm run build -> dist) with single-page-app fallback, so one
// Node service hosts the site, the partner area, the admin panel and the API on one domain.
// opts.embed: { clientId } turns on the Shopify-admin page (/shopify-admin): it may be framed by Shopify,
// and App Bridge is loaded first in <head> as Shopify requires. Every other page refuses to be framed.
export function createStaticHandler(root, opts = {}) {
  const base = path.resolve(root);
  const exists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  return function serve(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400); return res.end(); }
    const embedded = rel === "/shopify-admin" || rel === "/shopify-admin/";
    if (embedded) {
      if (!opts.embed || !opts.embed.clientId) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
      let html;
      try { html = fs.readFileSync(path.join(base, "index.html"), "utf8"); } catch { res.writeHead(404); return res.end(); }
      const tags = `<meta name="shopify-api-key" content="${String(opts.embed.clientId).replace(/[^A-Za-z0-9_-]/g, "")}" /><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>`;
      html = html.replace(/<head[^>]*>/i, (m) => `${m}${tags}`);
      res.writeHead(200, {
        "Content-Type": TYPES[".html"], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "frame-ancestors https://admin.shopify.com https://*.myshopify.com",
      });
      return req.method === "HEAD" ? res.end() : res.end(html);
    }
    let file = path.join(base, rel);
    if (!file.startsWith(base + path.sep) && file !== base) { res.writeHead(403); return res.end(); } // no path traversal
    if (!exists(file)) file = path.extname(rel) ? null : path.join(base, "index.html");
    if (!file || !exists(file)) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    const ext = path.extname(file).toLowerCase();
    const hashed = /\/assets\//.test(file) && /-[A-Za-z0-9_-]{6,}\./.test(path.basename(file));
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "frame-ancestors 'self'",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
    return undefined;
  };
}

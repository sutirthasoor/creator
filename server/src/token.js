import crypto from "node:crypto";

// Attribution token: payload.signature, signed with a server-only secret so a visitor
// cannot forge or edit who gets credit. Expiry (x) is fixed when the token is issued.
const hmac = (body, secret) => crypto.createHmac("sha256", secret).update(body).digest("base64url");

export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

export function verifyToken(token, secret) {
  if (typeof token !== "string" || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(body, secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

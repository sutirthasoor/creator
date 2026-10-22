import crypto from "node:crypto";

// Shopify sends money as decimal strings ("2100.00"). Parse them as text, never as floats,
// and keep every amount as integer paise from here on.
export function toPaise(value) {
  if (value === null || value === undefined || value === "") return 0;
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value).trim());
  if (!m) throw new Error(`Invalid amount: ${value}`);
  const third = (m[3] || "").padEnd(3, "0");
  let paise = Number(m[2]) * 100 + Number(third.slice(0, 2));
  if (third[2] >= "5") paise += 1;
  return m[1] ? -paise : paise;
}

// amount * basis points / 10000, rounded half up, integers only.
export const bpsOf = (amountPaise, bps) => Math.floor((amountPaise * bps + 5000) / 10000);

export const nowIso = () => new Date().toISOString();
export const addDays = (iso, days) => new Date(Date.parse(iso) + days * 86400000).toISOString();
export const sha256 = (text) => crypto.createHash("sha256").update(String(text)).digest("hex");
export const randomDigits = (n) => Array.from({ length: n }, () => crypto.randomInt(0, 10)).join("");
export const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const bad = (msg) => new HttpError(400, msg, "bad_request");
export const forbidden = (msg = "You do not have access to this.") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "Not found.") => new HttpError(404, msg, "not_found");

export function str(v, { max = 200, required = false, name = "value" } = {}) {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw bad(`${name} is required.`);
  if (s.length > max) throw bad(`${name} is too long.`);
  return s;
}

// Admin enters rupees/percent; storage is integer paise / basis points.
export function normalizeRate(input, name = "rate") {
  if (!input || typeof input !== "object") throw bad(`${name} is invalid.`);
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) throw bad(`${name} must be a positive number.`);
  if (input.type === "percent") {
    if (value > 100) throw bad(`${name} cannot exceed 100%.`);
    return { type: "percent", bps: Math.round(value * 100) };
  }
  if (input.type === "fixed") return { type: "fixed", paise: Math.round(value * 100) };
  throw bad(`${name} type must be "percent" or "fixed".`);
}

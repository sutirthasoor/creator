// The customer's e-book library. Talks only to our Node server; the server asks Shopify who the customer is.
import { PARTNER } from "./partnerConfig.js";
import { AUTH_MODE } from "./config.js";
import * as account from "./customerAccount.js";

// OAuth tokens are renewed automatically; the classic token is the one the sign-in gave us.
export async function currentToken(ctxToken) {
  return AUTH_MODE === "oauth" ? account.getValidToken() : ctxToken;
}

async function call(path, token, { method = "GET", body } = {}) {
  if (!token) throw new Error("Please sign in to see your library.");
  let res;
  try {
    res = await fetch(`${PARTNER.apiBase}${path}`, {
      method,
      headers: { Authorization: token, "X-Customer-Mode": AUTH_MODE, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || "Something went wrong."), { status: res.status });
  return json;
}

export const listLibrary = (token) => call("/library", token);
export const openBook = (token, productId) => call(`/library/${encodeURIComponent(productId)}/open`, token, { method: "POST", body: {} });
// Address of the PDF for the reader. It is signed, works for a few minutes, and is checked again on every request.
export const bookUrl = (readToken) => `${PARTNER.apiBase}/library/file/${readToken}`;

// Shopify Customer Account API: OAuth 2.0 authorization-code flow with PKCE (public client).
// This is how headless storefronts sign customers in now that Shopify has deprecated
// legacy (email + password) customer accounts.
// Docs: https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api
import { SHOPIFY, CUSTOMER } from "./config.js";

const TOKENS_KEY = "cm365.customer.tokens"; // localStorage
const FLOW_KEY = "cm365.customer.flow"; // sessionStorage, one login attempt

const get = (store, key) => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};
const set = (store, key, value) => {
  try {
    store.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};
const del = (store, key) => {
  try {
    store.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

export const redirectUri = () => `${window.location.origin}/auth/callback`;

/* ------------------------------ endpoints ------------------------------ */

let endpointsPromise;

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function getEndpoints() {
  const fallbackGraphql = `https://${SHOPIFY.domain}/customer/api/${SHOPIFY.apiVersion}/graphql`;
  if (CUSTOMER.authUrl && CUSTOMER.tokenUrl) {
    return Promise.resolve({
      authorization: CUSTOMER.authUrl,
      token: CUSTOMER.tokenUrl,
      logout: CUSTOMER.logoutUrl || null,
      graphql: CUSTOMER.graphqlUrl || fallbackGraphql,
    });
  }
  if (!endpointsPromise) {
    endpointsPromise = (async () => {
      const base = `https://${SHOPIFY.domain}`;
      try {
        const [oidc, api] = await Promise.all([
          fetchJson(`${base}/.well-known/openid-configuration`),
          fetchJson(`${base}/.well-known/customer-account-api`).catch(() => null),
        ]);
        return {
          authorization: oidc.authorization_endpoint,
          token: oidc.token_endpoint,
          logout: oidc.end_session_endpoint || null,
          graphql: CUSTOMER.graphqlUrl || (api && api.graphql_api) || fallbackGraphql,
        };
      } catch {
        throw new Error(
          "Could not load Shopify's sign-in settings. Add the endpoint URLs from your Headless channel to .env (see README)."
        );
      }
    })().catch((err) => {
      endpointsPromise = undefined;
      throw err;
    });
  }
  return endpointsPromise;
}

/* -------------------------------- PKCE -------------------------------- */

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const randomString = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(digest);
}

function decodeJwt(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return null;
  }
}

/* ------------------------------ login flow ------------------------------ */

export async function beginLogin({ returnTo = "/account" } = {}) {
  if (!CUSTOMER.clientId) throw new Error("Customer sign-in is not configured.");
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Secure sign-in needs HTTPS. Open the site over https:// and try again.");
  }
  const ep = await getEndpoints();
  const verifier = randomString(48);
  const state = randomString(16);
  const nonce = randomString(16);
  set(sessionStorage, FLOW_KEY, JSON.stringify({ state, nonce, verifier, returnTo }));

  const url = new URL(ep.authorization);
  url.search = new URLSearchParams({
    scope: "openid email customer-account-api:full",
    client_id: CUSTOMER.clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    state,
    nonce,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: "S256",
  }).toString();
  window.location.assign(url.toString());
}

function saveTokens(t) {
  set(
    localStorage,
    TOKENS_KEY,
    JSON.stringify({
      accessToken: t.access_token,
      refreshToken: t.refresh_token || null,
      idToken: t.id_token || null,
      expiresAt: Date.now() + Number(t.expires_in || 0) * 1000,
    })
  );
}

const loadTokens = () => {
  try {
    return JSON.parse(get(localStorage, TOKENS_KEY) || "null");
  } catch {
    return null;
  }
};

export const clearTokens = () => del(localStorage, TOKENS_KEY);

async function postToken(endpoint, params) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`Shopify could not complete sign-in (${res.status}).`);
  return res.json();
}

// Called on /auth/callback with the query string Shopify redirected back with.
export async function handleCallback(search) {
  const params = new URLSearchParams(search);
  if (params.get("error")) throw new Error(params.get("error_description") || "Sign-in was cancelled.");

  let flow = null;
  try {
    flow = JSON.parse(get(sessionStorage, FLOW_KEY) || "null");
  } catch {
    flow = null;
  }
  const code = params.get("code");
  if (!code || !flow || flow.state !== params.get("state")) {
    throw new Error("This sign-in link is no longer valid. Please start again.");
  }
  del(sessionStorage, FLOW_KEY); // one use only

  const ep = await getEndpoints();
  const t = await postToken(ep.token, {
    grant_type: "authorization_code",
    client_id: CUSTOMER.clientId,
    redirect_uri: redirectUri(),
    code,
    code_verifier: flow.verifier,
  });

  const claims = t.id_token ? decodeJwt(t.id_token) : null;
  if (!claims || claims.nonce !== flow.nonce) throw new Error("Sign-in could not be verified. Please try again.");

  saveTokens(t);
  return { returnTo: flow.returnTo || "/account" };
}

async function refresh(tokens) {
  const ep = await getEndpoints();
  const t = await postToken(ep.token, {
    grant_type: "refresh_token",
    client_id: CUSTOMER.clientId,
    refresh_token: tokens.refreshToken,
  });
  saveTokens({ ...t, id_token: t.id_token || tokens.idToken, refresh_token: t.refresh_token || tokens.refreshToken });
  return loadTokens();
}

// Returns a usable access token, refreshing it when needed, or null when signed out.
export async function getValidToken() {
  let tokens = loadTokens();
  if (!tokens || !tokens.accessToken) return null;
  if (tokens.expiresAt - 60000 > Date.now()) return tokens.accessToken;
  if (!tokens.refreshToken) {
    clearTokens();
    return null;
  }
  try {
    tokens = await refresh(tokens);
    return tokens ? tokens.accessToken : null;
  } catch {
    clearTokens();
    return null;
  }
}

export async function logout() {
  const tokens = loadTokens();
  clearTokens();
  if (!tokens || !tokens.idToken) return;
  try {
    const ep = await getEndpoints();
    if (ep.logout) {
      // Shopify returns to the "Logout URI" configured in the Headless channel.
      window.location.assign(`${ep.logout}?${new URLSearchParams({ id_token_hint: tokens.idToken })}`);
    }
  } catch {
    /* local sign-out already happened */
  }
}

/* ------------------------------ customer data ------------------------------ */

const CUSTOMER_QUERY = `
  query Customer {
    customer {
      id displayName firstName lastName
      emailAddress { emailAddress }
      phoneNumber { phoneNumber }
      orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
        nodes { id name processedAt financialStatus totalPrice { amount currencyCode } statusPageUrl }
      }
    }
  }
`;

export async function fetchCustomer() {
  const token = await getValidToken();
  if (!token) throw new Error("You are signed out.");
  const ep = await getEndpoints();
  const res = await fetch(ep.graphql, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: token },
    body: JSON.stringify({ query: CUSTOMER_QUERY }),
  });
  if (res.status === 401) {
    clearTokens();
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!res.ok) throw new Error(`Could not load your account (${res.status}).`);
  const json = await res.json();
  if (json.errors && json.errors.length) throw new Error(json.errors.map((e) => e.message).join(" · "));
  const c = json.data && json.data.customer;
  if (!c) throw new Error("Could not load your account.");
  const email = c.emailAddress && c.emailAddress.emailAddress;
  return {
    id: c.id,
    name: c.displayName || [c.firstName, c.lastName].filter(Boolean).join(" ") || email || "Your account",
    email: email || "",
    phone: (c.phoneNumber && c.phoneNumber.phoneNumber) || "",
    orders: ((c.orders && c.orders.nodes) || []).map((o) => ({
      id: o.id,
      name: o.name,
      processedAt: o.processedAt,
      status: o.financialStatus,
      fulfillment: null,
      total: o.totalPrice,
      statusUrl: o.statusPageUrl,
    })),
  };
}

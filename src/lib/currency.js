// Display-currency converter.
//
// Prices in the catalogue and at checkout are in INR. This module only changes how prices are
// SHOWN: it keeps the visitor's chosen display currency, fetches live exchange rates (cached for
// 12 hours) and falls back to built-in approximate rates if the rate service cannot be reached.
// Checkout always charges in INR, and the storefront says so whenever another currency is selected.
import { useSyncExternalStore } from "react";

export const BASE_CURRENCY = "INR";

export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "en-IE" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "AED", symbol: "AED", name: "UAE Dirham", locale: "en-AE" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
];

// Units of each currency per 1 INR. Approximate; only used until live rates arrive or if they fail.
const FALLBACK_RATES = {
  INR: 1, USD: 0.0114, EUR: 0.0098, GBP: 0.0085, AED: 0.0419, AUD: 0.0176, CAD: 0.0159, SGD: 0.0148,
};

const RATE_URL = "https://open.er-api.com/v6/latest/INR";
const CURRENCY_KEY = "cm365.currency";
const RATES_KEY = "cm365.fx";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

const supported = (code) => CURRENCIES.some((c) => c.code === code);

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}

function loadCachedRates() {
  try {
    const raw = JSON.parse(readStorage(RATES_KEY) || "null");
    if (raw && raw.rates && typeof raw.fetchedAt === "number") return raw;
  } catch {
    /* ignore a corrupt cache */
  }
  return null;
}

const cached = loadCachedRates();
const savedCurrency = readStorage(CURRENCY_KEY);

// Immutable snapshot: a new object is created on every change so React can compare by reference.
let state = {
  currency: supported(savedCurrency) ? savedCurrency : BASE_CURRENCY,
  rates: cached ? { ...FALLBACK_RATES, ...cached.rates } : FALLBACK_RATES,
  live: Boolean(cached),
  updatedAt: cached ? cached.fetchedAt : null,
};

const listeners = new Set();
function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getCurrencyState() {
  return state;
}

export function setCurrency(code) {
  if (!supported(code) || code === state.currency) return;
  writeStorage(CURRENCY_KEY, code);
  setState({ currency: code });
  refreshRates(); // make sure the rate is fresh when someone switches
}

let inflight = null;
export function refreshRates(force = false) {
  const stale = !state.updatedAt || Date.now() - state.updatedAt > MAX_AGE_MS;
  if (!force && !stale) return Promise.resolve();
  if (inflight) return inflight;
  inflight = fetch(RATE_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("rate service unavailable"))))
    .then((data) => {
      if (!data || data.result === "error" || !data.rates) throw new Error("bad rate response");
      const rates = { INR: 1 };
      CURRENCIES.forEach((c) => {
        const v = Number(data.rates[c.code]);
        if (v > 0) rates[c.code] = v;
      });
      const fetchedAt = Date.now();
      writeStorage(RATES_KEY, JSON.stringify({ rates, fetchedAt }));
      setState({ rates: { ...FALLBACK_RATES, ...rates }, live: true, updatedAt: fetchedAt });
    })
    .catch(() => {
      /* keep whatever rates we already have (cached or built-in) */
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function convert(amount, from = BASE_CURRENCY, to = state.currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  if (from === to) return n;
  const rf = state.rates[from];
  const rt = state.rates[to];
  if (!rf || !rt) return n; // unknown currency: leave the amount untouched
  return (n / rf) * rt;
}

export function formatAmount(amount, currency = state.currency) {
  const meta = CURRENCIES.find((c) => c.code === currency);
  const locale = meta ? meta.locale : "en-IN";
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// Price given in INR (or another currency) -> text in the visitor's chosen currency.
export function formatInDisplayCurrency(amount, from = BASE_CURRENCY) {
  return formatAmount(convert(amount, from, state.currency), state.currency);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Components call this so they re-render when the currency or rates change.
export function useCurrency() {
  const snap = useSyncExternalStore(subscribe, getCurrencyState, getCurrencyState);
  return {
    currency: snap.currency,
    isBase: snap.currency === BASE_CURRENCY,
    live: snap.live,
    updatedAt: snap.updatedAt,
    setCurrency,
    // money(2100) -> "$23.94" when USD is selected; money(25, "USD") converts from USD.
    money: (amount, from = BASE_CURRENCY) => formatAmount(convert(amount, from, snap.currency), snap.currency),
  };
}

// Warm the rates as soon as the app loads (no-op while the cache is fresh).
if (typeof window !== "undefined") refreshRates();

// The partner area talks only to the Node server (sign-in included), so there is no Firebase
// key in the browser. Leave VITE_AFFILIATE_API_URL unset when the server also serves the site.
const env = import.meta.env;

export const PARTNER = {
  apiBase: ((env.VITE_AFFILIATE_API_URL || "").trim() || "/api").replace(/\/+$/, ""),
};
export const isPartnerAuthConfigured = true;

import { HttpError, bad, str } from "./util.js";

// Sign-in goes through this server, so the browser never talks to Firebase directly and the
// Firebase web API key stays on the server. Uses Firebase Authentication's REST API (free).
const IDP = "https://identitytoolkit.googleapis.com/v1/accounts";

const MESSAGES = {
  EMAIL_EXISTS: "An account with this email already exists. Try signing in.",
  EMAIL_NOT_FOUND: "Incorrect email or password.",
  INVALID_PASSWORD: "Incorrect email or password.",
  INVALID_LOGIN_CREDENTIALS: "Incorrect email or password.",
  USER_DISABLED: "This account has been disabled. Contact support.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Please wait a few minutes and try again.",
  WEAK_PASSWORD: "Choose a stronger password (at least 6 characters).",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_REFRESH_TOKEN: "Your session has expired. Please sign in again.",
  TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
};

export function createAuthService({ apiKey, fetchImpl = fetch }) {
  async function call(url, body, form = false) {
    if (!apiKey) throw new HttpError(503, "Sign-in is not configured on the server (FIREBASE_WEB_API_KEY).", "not_configured");
    let res;
    try {
      res = await fetchImpl(`${url}${url.includes("?") ? "&" : "?"}key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
        body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
      });
    } catch {
      throw new HttpError(502, "Could not reach the sign-in service. Try again in a moment.", "upstream");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = String((data.error && data.error.message) || "").split(" ")[0];
      throw new HttpError(res.status === 400 ? 400 : 502, MESSAGES[code] || "Something went wrong. Please try again.", "auth");
    }
    return data;
  }

  const session = (d) => ({
    idToken: d.idToken || d.id_token, refreshToken: d.refreshToken || d.refresh_token,
    expiresIn: Number(d.expiresIn || d.expires_in || 3600), uid: d.localId || d.user_id, email: d.email || null,
  });

  const creds = (b) => {
    const email = str(b.email, { required: true, max: 200, name: "Email" }).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw bad("Enter a valid email address.");
    const password = typeof b.password === "string" ? b.password : "";
    if (password.length < 8 || password.length > 200) throw bad("Password must be at least 8 characters.");
    return { email, password };
  };

  return {
    async signUp(b) {
      const { email, password } = creds(b);
      const s = session(await call(`${IDP}:signUp`, { email, password, returnSecureToken: true }));
      await call(`${IDP}:sendOobCode`, { requestType: "VERIFY_EMAIL", idToken: s.idToken }).catch(() => {});
      return s;
    },
    async signIn(b) {
      const { email, password } = creds(b);
      return session(await call(`${IDP}:signInWithPassword`, { email, password, returnSecureToken: true }));
    },
    async reset(b) {
      const email = str(b.email, { required: true, max: 200, name: "Email" }).toLowerCase();
      // Same answer whether or not the account exists, so this cannot be used to probe for emails.
      await call(`${IDP}:sendOobCode`, { requestType: "PASSWORD_RESET", email }).catch((e) => { if (e.status === 503) throw e; });
      return { ok: true };
    },
    async resendVerification(idToken) {
      await call(`${IDP}:sendOobCode`, { requestType: "VERIFY_EMAIL", idToken });
      return { ok: true };
    },
    async refresh(b) {
      const refreshToken = str(b.refreshToken, { required: true, max: 2000, name: "Session" });
      return session(await call("https://securetoken.googleapis.com/v1/token", { grant_type: "refresh_token", refresh_token: refreshToken }, true));
    },
  };
}

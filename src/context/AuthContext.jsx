import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AUTH_MODE, AUTH_NOT_CONNECTED } from "../lib/config.js";
import * as account from "../lib/customerAccount.js";
import * as store from "../lib/shopify.js";

const AuthContext = createContext(null);

const CLASSIC_KEY = "cm365.classicToken";

function loadClassic() {
  try {
    const t = JSON.parse(localStorage.getItem(CLASSIC_KEY) || "null");
    if (t && t.accessToken && new Date(t.expiresAt).getTime() > Date.now() + 60000) return t;
  } catch {
    /* ignore */
  }
  return null;
}
function saveClassic(t) {
  try {
    localStorage.setItem(CLASSIC_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}
function clearClassic() {
  try {
    localStorage.removeItem(CLASSIC_KEY);
  } catch {
    /* ignore */
  }
}

function notConnected() {
  const err = new Error("Customer accounts are not connected yet.");
  err.code = AUTH_NOT_CONNECTED;
  return err;
}

const ANON = { status: "anon", customer: null, token: null };

export function AuthProvider({ children }) {
  const [state, setState] = useState(
    AUTH_MODE === "none" ? ANON : { status: "loading", customer: null, token: null }
  );

  // Restore an existing session on page load.
  useEffect(() => {
    if (AUTH_MODE === "none") return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = AUTH_MODE === "classic" ? (loadClassic() || {}).accessToken : await account.getValidToken();
        if (!token) {
          if (!cancelled) setState(ANON);
          return;
        }
        const customer = AUTH_MODE === "classic" ? await store.classicCustomer(token) : await account.fetchCustomer();
        if (!cancelled) setState({ status: "authed", customer, token });
      } catch {
        if (!cancelled) setState(ANON);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- oauth mode (Shopify new customer accounts) ---- */

  const login = useCallback((returnTo = "/account") => {
    if (AUTH_MODE !== "oauth") return Promise.reject(notConnected());
    return account.beginLogin({ returnTo });
  }, []);

  const completeOAuth = useCallback(async (search) => {
    const { returnTo } = await account.handleCallback(search);
    const customer = await account.fetchCustomer();
    const token = await account.getValidToken();
    setState({ status: "authed", customer, token });
    return returnTo;
  }, []);

  /* ---- classic mode (email + password, legacy accounts only) ---- */

  const signInWithPassword = useCallback(async ({ email, password }) => {
    if (AUTH_MODE !== "classic") throw notConnected();
    const t = await store.classicLogin({ email, password });
    saveClassic(t);
    const customer = await store.classicCustomer(t.accessToken);
    setState({ status: "authed", customer, token: t.accessToken });
  }, []);

  const register = useCallback(
    async (values) => {
      if (AUTH_MODE !== "classic") throw notConnected();
      await store.classicRegister(values);
      await signInWithPassword({ email: values.email, password: values.password });
    },
    [signInWithPassword]
  );

  const recover = useCallback(async (email) => {
    if (AUTH_MODE !== "classic") throw notConnected();
    await store.classicRecover(email);
  }, []);

  const logout = useCallback(async () => {
    setState(ANON);
    if (AUTH_MODE === "classic") clearClassic();
    else if (AUTH_MODE === "oauth") await account.logout();
  }, []);

  const value = useMemo(
    () => ({
      authMode: AUTH_MODE,
      status: state.status,
      customer: state.customer,
      token: state.token,
      isAuthed: state.status === "authed",
      login,
      completeOAuth,
      signInWithPassword,
      register,
      recover,
      logout,
    }),
    [state, login, completeOAuth, signInWithPassword, register, recover, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

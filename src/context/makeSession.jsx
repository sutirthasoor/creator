import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/affiliateApi.js";

// One signed-in session for one kind of account ("partner" or "admin"). The two kinds are built from
// the same code but share no state, storage or tokens.
export function makeSession(auth, name) {
  const Ctx = createContext(null);

  function Provider({ children }) {
    const [me, setMe] = useState(null);
    const [status, setStatus] = useState(auth.readSession() ? "loading" : "guest");
    const [error, setError] = useState(null);

    const load = useCallback(async ({ force = false } = {}) => {
      const s = await auth.freshSession({ force });
      if (!s) { setMe(null); setStatus("guest"); return null; }
      try {
        const data = await api("/me", { as: auth.kind });
        // Belt and braces: the server already refuses the wrong kind of account.
        const isAdmin = ["admin", "super_admin"].includes(data.role);
        if ((auth.kind === "admin") !== isAdmin) { auth.signOut(); setMe(null); setStatus("guest"); return null; }
        setMe(data); setStatus("authed");
        return data;
      } catch (e) {
        if (e.status === 401) { auth.signOut(); setMe(null); setStatus("guest"); }
        else { setError(e.message); setStatus("error"); }
        return null;
      }
    }, []);

    useEffect(() => { if (auth.readSession()) load(); }, [load]);

    const value = useMemo(() => ({
      me, status, error, kind: auth.kind, refresh: load,
      isAdmin: Boolean(me && ["admin", "super_admin"].includes(me.role)),
      async signIn(email, password) { await auth.signIn(email, password); return load(); },
      async signUp(email, password) { await auth.signUp(email, password); return load(); },
      reset: auth.sendPasswordReset,
      resend: auth.resendVerification,
      signOut() { auth.signOut(); setMe(null); setStatus("guest"); },
    }), [me, status, error, load]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  function useSession() {
    const v = useContext(Ctx);
    if (!v) throw new Error(`use${name} must be used inside its provider`);
    return v;
  }
  return { Provider, useSession };
}

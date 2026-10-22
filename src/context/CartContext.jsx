import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isDemo, cartFetch, cartAdd, cartSetQty, cartRemove, cartSetBuyer, cartSetAttributes } from "../lib/commerce.js";
import { getReferralToken } from "../lib/referral.js";
import { useAuth } from "./AuthContext.jsx";

const CartContext = createContext(null);
const ID_KEY = "cm365.cartId";

const readId = () => {
  try {
    return localStorage.getItem(ID_KEY) || null;
  } catch {
    return null;
  }
};
const writeId = (id) => {
  try {
    if (id) localStorage.setItem(ID_KEY, id);
    else localStorage.removeItem(ID_KEY);
  } catch {
    /* storage unavailable: the cart lasts for this visit only */
  }
};

const refAttributes = () => {
  const token = getReferralToken();
  return token ? [{ key: "cm_ref", value: token }] : [];
};

const isStale = (err) => /does not exist|not found|no longer|expired/i.test((err && err.message) || "");

export function CartProvider({ children }) {
  const { token } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const syncedRef = useRef("");

  const commit = useCallback((next) => {
    // A cart without lines is treated as empty; keep the Shopify id for the next add.
    writeId(next ? next.id : null);
    setCart(next);
    return next;
  }, []);

  // Load the saved cart on first render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = readId();
        if (isDemo || id) {
          const existing = await cartFetch(id);
          if (!cancelled) {
            if (existing) setCart(existing);
            else writeId(null);
          }
        }
      } catch {
        /* a stale or unreachable cart simply starts empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Attach the cart to the signed-in customer so the order lands in their account.
  useEffect(() => {
    if (isDemo || !token || !cart || !cart.id) return;
    const key = `${cart.id}:${token}`;
    if (syncedRef.current === key) return;
    syncedRef.current = key;
    cartSetBuyer(cart.id, token)
      .then((next) => next && setCart(next))
      .catch(() => {
        /* best effort: checkout still works as a guest */
      });
  }, [token, cart]);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError((err && err.message) || "Something went wrong. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const add = useCallback(
    (variantId, quantity = 1) =>
      run(async () => {
        const id = readId();
        let next;
        try {
          next = await cartAdd(id, variantId, quantity, refAttributes());
        } catch (err) {
          if (id && isStale(err)) next = await cartAdd(null, variantId, quantity, refAttributes());
          else throw err;
        }
        return commit(next);
      }),
    [run, commit]
  );

  // After a change the cart may be empty. A Shopify cart keeps its id when emptied; the
  // local sample cart has nothing to keep, so it is dropped.
  const afterChange = (next) => commit(next && (next.lines.length > 0 || !isDemo) ? next : null);

  const setQty = useCallback(
    (lineId, quantity) =>
      run(async () => {
        const id = readId();
        const next = quantity < 1 ? await cartRemove(id, lineId) : await cartSetQty(id, lineId, quantity);
        return afterChange(next);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, commit]
  );

  const remove = useCallback(
    (lineId) =>
      run(async () => afterChange(await cartRemove(readId(), lineId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, commit]
  );

  // Make sure the referral token is on the cart just before handing over to Shopify checkout,
  // so a partner link followed after the cart was created is still credited.
  const checkout = useCallback(async () => {
    if (!cart || !cart.checkoutUrl) return;
    const attrs = refAttributes();
    if (attrs.length && !isDemo) {
      try {
        await cartSetAttributes(cart.id, attrs);
      } catch {
        /* checkout must still work if tagging fails */
      }
    }
    window.location.assign(cart.checkoutUrl);
  }, [cart]);

  const reset = useCallback(() => {
    writeId(null);
    syncedRef.current = "";
    setCart(null);
  }, []);

  const value = useMemo(
    () => ({
      cart,
      count: (cart && cart.totalQuantity) || 0,
      loading,
      busy,
      error,
      isDemo,
      add,
      setQty,
      remove,
      checkout,
      reset,
      clearError: () => setError(null),
    }),
    [cart, loading, busy, error, add, setQty, remove, checkout, reset]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

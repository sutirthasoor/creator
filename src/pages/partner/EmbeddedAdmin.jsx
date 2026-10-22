import { useEffect, useState } from "react";
import { setTokenProvider } from "../../lib/affiliateApi.js";
import { AdminConsole } from "./Admin.jsx";
import { Notice, Loading } from "./ui.jsx";

// The affiliate admin as it appears inside the Shopify admin (an embedded app). Shopify's App Bridge,
// loaded by the server before this page, supplies a short-lived session token for every request.
// Shopify decides who can open the app; the server checks the token's signature and store.
export default function EmbeddedAdmin() {
  const [state, setState] = useState("loading");

  useEffect(() => {
    document.title = "Affiliate — Creator Moves 365";
    let cancelled = false;
    let tries = 0;
    const wait = setInterval(async () => {
      tries += 1;
      if (window.shopify && typeof window.shopify.idToken === "function") {
        clearInterval(wait);
        setTokenProvider(() => window.shopify.idToken()); // a fresh token each call: they last about a minute
        try {
          await window.shopify.idToken();
          if (!cancelled) setState("ready");
        } catch {
          if (!cancelled) setState("failed");
        }
      } else if (tries > 40) {
        clearInterval(wait);
        if (!cancelled) setState("outside");
      }
    }, 100);
    return () => { cancelled = true; clearInterval(wait); setTokenProvider(null); };
  }, []);

  return (
    <div className="pt-embedded">
      <h1 className="cm-h2">Affiliate</h1>
      {state === "loading" && <Loading what="Connecting to Shopify" />}
      {state === "outside" && <Notice>Open this page from your Shopify admin (Apps, then Creator Moves 365 Affiliate). It cannot run on its own.</Notice>}
      {state === "failed" && <Notice>Could not confirm your Shopify session. Reload the page.</Notice>}
      {state === "ready" && <AdminConsole can={() => true} layout="tabs" />}
    </div>
  );
}

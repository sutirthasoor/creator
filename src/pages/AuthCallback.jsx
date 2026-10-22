import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CircleAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

/* Shopify redirects back here after sign-in with ?code=…&state=…  */
export default function AuthCallback() {
  const { completeOAuth } = useAuth();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // the one-time code can only be exchanged once
    started.current = true;
    completeOAuth(search)
      .then((returnTo) => navigate(returnTo || "/account", { replace: true }))
      .catch((err) => setError((err && err.message) || "Sign-in could not be completed."));
  }, [completeOAuth, search, navigate]);

  return (
    <div className="public-shell mx-auto px-4 sm:px-6">
      <div className="cm-stub">
        {error ? (
          <div className="cm-state" role="alert">
            <CircleAlert size={28} aria-hidden="true" />
            <h1 className="cm-h2">Sign-in didn’t complete</h1>
            <p>{error}</p>
            <Link className="cm-btn cm-btn-primary" to="/auth">Try again</Link>
          </div>
        ) : (
          <p className="cm-lead" role="status">Finishing sign-in…</p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BookOpen, Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { currentToken, listLibrary } from "../lib/library.js";
import { formatDate } from "../lib/money.js";

export default function Library() {
  const { status, token } = useAuth();
  const [state, setState] = useState({ loading: true, items: [], error: "" });

  useEffect(() => {
    if (status !== "authed") return undefined;
    let off = false;
    (async () => {
      try {
        const data = await listLibrary(await currentToken(token));
        if (!off) setState({ loading: false, items: data.items, error: "" });
      } catch (e) {
        if (!off) setState({ loading: false, items: [], error: e.message });
      }
    })();
    return () => { off = true; };
  }, [status, token]);

  if (status === "loading") {
    return <div className="public-shell mx-auto px-4 sm:px-6"><div className="cm-stub"><p className="cm-lead" aria-live="polite">Loading…</p></div></div>;
  }
  if (status !== "authed") return <Navigate to="/auth" replace state={{ from: "/library" }} />;

  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-page">
        <header className="cm-account-head">
          <div>
            <span className="cm-eyebrow">Your library</span>
            <h1 className="cm-h1">My <span className="cm-gradient-text">e-books</span></h1>
            <p className="cm-lead">Everything you have bought, ready to read on any device after you sign in.</p>
          </div>
        </header>

        {state.loading && <p className="cm-muted" aria-live="polite">Loading your books…</p>}
        {state.error && <p className="cm-flag" role="alert">{state.error}</p>}
        {!state.loading && !state.error && state.items.length === 0 && (
          <div className="cm-card cm-empty">
            <p>No books yet. If you just paid, it can take a minute to appear. Refresh this page.</p>
            <p><Link className="cm-link" to="/products">Browse products</Link></p>
          </div>
        )}

        <ul className="cm-library">
          {state.items.map((b) => (
            <li key={b.productId} className="cm-card cm-library-item">
              <div>
                <h2 className="cm-card-title">{b.title}</h2>
                <p className="cm-muted">Order {b.orderName} · {formatDate(b.grantedAt)}</p>
              </div>
              {b.ready ? (
                <Link className="cm-btn cm-btn-primary" to={`/library/${b.productId}`}><BookOpen size={16} aria-hidden="true" /> Read now</Link>
              ) : (
                <span className="cm-tag"><Clock size={14} aria-hidden="true" /> Being prepared</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

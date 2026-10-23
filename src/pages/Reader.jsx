import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { currentToken, openBook, bookUrl } from "../lib/library.js";

// One address per book (/library/<product id>). Opens only for a signed-in customer who has paid for it.
export default function Reader() {
  const { productId } = useParams();
  const { status, token } = useAuth();
  const [state, setState] = useState({ loading: true, src: "", title: "", error: "" });

  const load = useCallback(async () => {
    setState({ loading: true, src: "", title: "", error: "" });
    try {
      const r = await openBook(await currentToken(token), productId);
      setState({ loading: false, src: bookUrl(r.token), title: r.title, error: "" });
    } catch (e) {
      setState({ loading: false, src: "", title: "", error: e.message });
    }
  }, [token, productId]);

  useEffect(() => { if (status === "authed") load(); }, [status, load]);

  if (status === "loading") {
    return <div className="public-shell mx-auto px-4 sm:px-6"><div className="cm-stub"><p className="cm-lead" aria-live="polite">Loading…</p></div></div>;
  }
  if (status !== "authed") return <Navigate to="/auth" replace state={{ from: `/library/${productId}` }} />;

  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-page">
        <div className="cm-reader-bar">
          <Link className="cm-btn cm-btn-outline cm-btn-sm" to="/library"><ArrowLeft size={15} aria-hidden="true" /> My library</Link>
          <h1 className="cm-h3 cm-reader-title">{state.title}</h1>
          {state.src && (
            <span className="cm-reader-actions">
              <a className="cm-btn cm-btn-outline cm-btn-sm" href={state.src} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" /> Open full screen</a>
              <button type="button" className="cm-btn cm-btn-outline cm-btn-sm" onClick={load}><RefreshCw size={15} aria-hidden="true" /> Reload</button>
            </span>
          )}
        </div>
        {state.loading && <p className="cm-muted" aria-live="polite">Opening your book…</p>}
        {state.error && (
          <div className="cm-card cm-empty" role="alert">
            <p>{state.error}</p>
            <p><Link className="cm-link" to="/library">Back to your library</Link></p>
          </div>
        )}
        {state.src && <iframe className="cm-reader-frame" title={state.title || "E-book"} src={`${state.src}#toolbar=0&navpanes=0`} />}
      </div>
    </div>
  );
}

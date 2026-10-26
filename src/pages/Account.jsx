import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LogOut, Mail, Phone, Receipt, ExternalLink, BookOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { formatMoney, formatDate, humanize } from "../lib/money.js";
import { useCurrency } from "../lib/currency.js";

export default function Account() {
  const { status, customer, logout } = useAuth();
  const { reset } = useCart();
  useCurrency(); // re-render when the display currency changes
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  if (status === "loading") {
    return (
      <div className="public-shell mx-auto px-4 sm:px-6">
        <div className="cm-stub"><p className="cm-lead" aria-live="polite">Loading your account…</p></div>
      </div>
    );
  }
  if (status !== "authed" || !customer) {
    return <Navigate to="/auth" replace state={{ from: "/account" }} />;
  }

  async function signOut() {
    setLeaving(true);
    reset();
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-page">
        <header className="cm-account-head">
          <div>
            <span className="cm-eyebrow">Your account</span>
            <h1 className="cm-h1">Hello, <span className="cm-gradient-text">{customer.name.split(" ")[0]}</span></h1>
          </div>
          <button type="button" className="cm-btn cm-btn-outline" onClick={signOut} disabled={leaving}>
            <LogOut size={16} aria-hidden="true" /> {leaving ? "Signing out…" : "Sign out"}
          </button>
        </header>

        <div className="cm-account-grid">
          <section className="cm-card" aria-labelledby="profile-title">
            <h2 id="profile-title" className="cm-card-title">Details</h2>
            <dl className="cm-details cm-details-flat">
              <div><dt>Name</dt><dd>{customer.name}</dd></div>
              <div><dt><Mail size={15} aria-hidden="true" /> Email</dt><dd>{customer.email}</dd></div>
              {customer.phone && <div><dt><Phone size={15} aria-hidden="true" /> Phone</dt><dd>{customer.phone}</dd></div>}
            </dl>
          </section>

          <section className="cm-card" aria-labelledby="library-title">
            <h2 id="library-title" className="cm-card-title"><BookOpen size={18} aria-hidden="true" /> My library</h2>
            <p className="cm-muted">Read the e-books you have bought.</p>
            <Link className="cm-btn cm-btn-primary" to="/library">Open my library</Link>
          </section>

          <section className="cm-card cm-orders" aria-labelledby="orders-title">
            <h2 id="orders-title" className="cm-card-title"><Receipt size={18} aria-hidden="true" /> Recent orders</h2>
            {customer.orders.length === 0 ? (
              <p className="cm-muted">No orders yet. <Link className="cm-link" to="/products">Browse products</Link></p>
            ) : (
              <ul className="cm-order-list">
                {customer.orders.map((o) => (
                  <li key={o.id}>
                    <div>
                      <strong>{o.name}</strong>
                      <span>{formatDate(o.processedAt)}</span>
                    </div>
                    <span className="cm-tag">{humanize(o.status) || "Processing"}</span>
                    <span className="cm-order-total">{formatMoney(o.total)}</span>
                    {o.statusUrl && (
                      <a className="cm-link" href={o.statusUrl} target="_blank" rel="noopener noreferrer">
                        View <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

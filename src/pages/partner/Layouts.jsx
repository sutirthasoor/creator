import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Crown, LogOut } from "lucide-react";
import { usePartner } from "../../context/PartnerContext.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";

// The partner area and the admin area each have their own slim top bar. They share nothing with the
// storefront header and footer, and nothing with each other.
function Bar({ label, children }) {
  return (
    <header className="pt-bar">
      <div className="pt-bar-inner">
        <span className="pt-bar-brand">
          <span className="pt-bar-logo"><Crown size={18} aria-hidden="true" /></span>
          <span className="pt-bar-text"><strong>Creator Moves 365</strong><span>{label}</span></span>
        </span>
        <div className="pt-bar-actions">{children}</div>
      </div>
    </header>
  );
}

export function PartnerLayout({ children }) {
  const { status, me, signOut } = usePartner();
  useEffect(() => { document.title = "Partner area — Creator Moves 365"; }, []);
  return (
    <div className="pt-app">
      <Bar label="Partner area">
        {status === "authed" && me && (
          <>
            <span className="pt-bar-user">{me.email}</span>
            <button type="button" className="cm-btn cm-btn-outline cm-btn-sm" onClick={signOut}><LogOut size={15} aria-hidden="true" /> Sign out</button>
          </>
        )}
      </Bar>
      <main className="public-shell mx-auto px-4 sm:px-6 pt-main">{children}</main>
    </div>
  );
}

export function AdminLayout({ children }) {
  const { status, me, signOut } = useAdmin();
  useEffect(() => { document.title = "Admin — Creator Moves 365"; }, []);
  return (
    <div className="pt-app">
      <Bar label="Admin">
        {status === "authed" && me && (
          <>
            <span className="pt-bar-user">{me.email}</span>
            <button type="button" className="cm-btn cm-btn-outline cm-btn-sm" onClick={signOut}><LogOut size={15} aria-hidden="true" /> Sign out</button>
          </>
        )}
      </Bar>
      <main className="public-shell mx-auto px-4 sm:px-6 pt-main">{children}</main>
    </div>
  );
}

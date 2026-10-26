import { Link } from "react-router-dom";
import { ScrollText, ArrowRight } from "lucide-react";
import { COMPANY, POLICY } from "../../data/company.js";
import { POLICIES } from "../../data/legal.js";

// /policies: index of every Masterbook policy.
export default function Policies() {
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-legal">
        <header className="cm-legal-head">
          <span className="cm-eyebrow"><ScrollText size={14} aria-hidden="true" /> Legal</span>
          <h1 className="cm-h1">Masterbook policies</h1>
          <p className="cm-legal-meta">Last updated {POLICY.updated} · {COMPANY.legalName} · GSTIN {COMPANY.gstin}</p>
          <p className="cm-lead">Everything about buying, receiving and using the Masterbook, and how we handle your data.</p>
        </header>
        <ul className="cm-legal-index">
          {POLICIES.map((p) => (
            <li key={p.slug}>
              <Link to={p.path}>
                <strong>{p.title}</strong>
                <span>{p.short}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
          <li>
            <Link to="/contact">
              <strong>Contact Us</strong>
              <span>Email, phone and registered address for any question.</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

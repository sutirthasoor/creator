import { Link } from "react-router-dom";
import { FileText, ArrowRight, Mail } from "lucide-react";
import { COMPANY, POLICY } from "../../data/company.js";
import { POLICIES, POLICY_BY_SLUG } from "../../data/legal.js";

// One page per policy (/terms, /privacy, /refund-policy, /shipping-policy).
export default function LegalPage({ slug }) {
  const doc = POLICY_BY_SLUG[slug];
  if (!doc) return null;
  const others = POLICIES.filter((p) => p.slug !== slug);
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <article className="cm-legal">
        <header className="cm-legal-head">
          <span className="cm-eyebrow"><FileText size={14} aria-hidden="true" /> Legal</span>
          <h1 className="cm-h1">{doc.title}</h1>
          <p className="cm-legal-meta">Last updated {POLICY.updated} · {COMPANY.legalName} · GSTIN {COMPANY.gstin}</p>
          <p className="cm-lead">{doc.intro}</p>
        </header>

        <nav className="cm-legal-toc" aria-label="On this page">
          <h2>On this page</h2>
          <ol>
            {doc.sections.map((s, i) => (
              <li key={s.heading}><a href={`#s${i + 1}`}>{s.heading.replace(/^\d+\.\s*/, "")}</a></li>
            ))}
          </ol>
        </nav>

        <div className="cm-legal-body">
          {doc.sections.map((s, i) => (
            <section key={s.heading} id={`s${i + 1}`} className="cm-legal-section">
              <h2>{s.heading}</h2>
              {s.paras && s.paras.map((t, k) => <p key={k}>{t}</p>)}
              {s.list && <ul>{s.list.map((t, k) => <li key={k}>{t}</li>)}</ul>}
            </section>
          ))}
        </div>

        <aside className="cm-legal-contact" aria-label="Contact">
          <Mail size={20} aria-hidden="true" />
          <div>
            <strong>Questions about this policy?</strong>
            <p>{COMPANY.email} · {COMPANY.phoneDisplay} · {COMPANY.addressLines.join(", ")}</p>
          </div>
          <Link className="cm-btn cm-btn-primary" to="/contact">Contact us <ArrowRight size={16} aria-hidden="true" /></Link>
        </aside>

        <nav className="cm-legal-more" aria-label="Other policies">
          {others.map((p) => <Link key={p.slug} to={p.path}>{p.title}</Link>)}
        </nav>
      </article>
    </div>
  );
}

export const Terms = () => <LegalPage slug="terms" />;
export const Privacy = () => <LegalPage slug="privacy" />;
export const RefundPolicy = () => <LegalPage slug="refund-policy" />;
export const ShippingPolicy = () => <LegalPage slug="shipping-policy" />;

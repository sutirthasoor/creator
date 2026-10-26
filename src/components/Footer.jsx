import { Link, useLocation } from "react-router-dom";
import { Crown, Sparkles, ArrowUpRight } from "lucide-react";
import { FOOTER_COLUMNS, LEGAL_LINKS } from "../data/content.js";

export default function Footer() {
  const { pathname } = useLocation();
  const home = pathname === "/";

  return (
    <footer className="site-footer relative isolate w-full overflow-hidden ">
      <div className="site-footer-topline absolute inset-x-0 top-0 h-px" aria-hidden="true" />
      <div className="public-shell relative mx-auto">
        <div className="site-footer-reveal grid gap-6 border-b border-footer-line py-9 sm:py-11 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase text-footer-accent">
              <Sparkles size={24} className="h-3.5 w-3.5" aria-hidden="true" /> Creator resources
            </div>
            <h2 className="font-display text-2xl font-semibold leading-tight text-footer-foreground sm:text-[28px]">
              Make your next move with the Masterbook
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-footer-muted">
              One digital book for content ideas, creative prompts and a repeatable workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 sm:gap-3 lg:justify-end">
            <Link className="site-footer-cta site-footer-cta-primary" to="/products">
              Get the Masterbook <ArrowUpRight size={24} className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link className="site-footer-cta site-footer-cta-secondary" to="/ai">
              Explore AI Library <ArrowUpRight size={24} className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="site-footer-reveal grid gap-9 py-10 sm:py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:gap-16">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="site-footer-logo grid h-11 w-11 shrink-0 place-items-center rounded-lg text-footer-foreground">
                <Crown size={22} aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-semibold text-footer-foreground">Creator Moves 365</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-footer-muted">
              A focused digital publication for your next creative move.
            </p>
            <div className="mt-6 h-px w-16 bg-footer-accent" aria-hidden="true" />
          </div>
          <nav aria-label="Footer navigation" className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-8 text-sm sm:grid-cols-4 sm:gap-x-8">
            {FOOTER_COLUMNS.map((col, ci) => (
              <div key={col.title}>
                <h3 className="mb-3 font-display text-xs font-semibold uppercase text-footer-foreground">{col.title}</h3>
                <div className="flex flex-col items-start gap-1">
                  {col.links.map((l) => {
                    const active = ci === 0 && home && l.to.startsWith("/#"); // original marks the Masterbook hash links active on the home route
                    return (
                      <Link
                        key={l.to}
                        className={`site-footer-link${active ? " active" : ""}`}
                        to={l.to}
                        {...(active ? { "data-status": "active", "aria-current": "page" } : {})}
                      >
                        {l.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="site-footer-reveal flex flex-col gap-3 border-t border-footer-line py-6 text-xs leading-relaxed text-footer-muted md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <span>© 2026 Creator Moves 365 · AA100X Tech</span>
            <nav aria-label="Legal" className="cm-footer-legal">
              {LEGAL_LINKS.map((l) => (
                <Link key={l.to} className="site-footer-link !min-h-0 !py-0" to={l.to}>{l.label}</Link>
              ))}
            </nav>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-2 md:max-w-2xl md:flex-row md:gap-5 md:text-right">
            
            <span>Other catalog listings are demonstration data; prices, terms and partner details are placeholders, not approved business terms.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { useCallback, useEffect, useState } from "react";
import { formatDate, humanize } from "../../lib/money.js";

// Run an async loader and keep { data, error, loading, reload }.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useCallback(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (e) => live && setState({ data: null, error: e.message, loading: false })
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => run(), [run]);
  return { ...state, reload: run };
}

export function Shell({ eyebrow, title, children, actions }) {
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-page">
        <header className="cm-account-head">
          <div>
            {eyebrow && <span className="cm-eyebrow">{eyebrow}</span>}
            <h1 className="cm-h1">{title}</h1>
          </div>
          {actions}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange, label }) {
  return (
    <div className="pt-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={active === t.id} className={`pt-tab${active === t.id ? " is-active" : ""}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Left sidebar for the partner dashboard and the admin panel. On narrow screens it becomes a scrolling strip.
// items: [{ id, label, icon: LucideIcon }]
export function SideNav({ items, active, onChange, label }) {
  return (
    <nav className="pt-side" aria-label={label}>
      <ul className="pt-side-list">
        {items.map(({ id, label: text, icon: Icon }) => (
          <li key={id}>
            <button type="button" className={`pt-side-item${active === id ? " is-active" : ""}`} aria-current={active === id ? "page" : undefined} onClick={() => onChange(id)}>
              {Icon && <Icon size={18} aria-hidden="true" />}
              <span>{text}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SidebarLayout({ nav, children }) {
  return (
    <div className="pt-shell">
      {nav}
      <section className="pt-content">{children}</section>
    </div>
  );
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className={`pt-stat${tone ? ` pt-stat-${tone}` : ""}`}>
      <span className="pt-stat-label">{label}</span>
      <strong className="pt-stat-value">{value}</strong>
      {hint && <span className="pt-stat-hint">{hint}</span>}
    </div>
  );
}

const TONES = {
  active: "good", paid: "good", approved: "info", payable: "info", pending: "warn", submitted: "warn", under_review: "warn", processing: "warn",
  rejected: "bad", suspended: "bad", reversed: "bad", cancelled: "bad", refunded: "bad", chargeback: "bad", partially_refunded: "warn",
};
export const Badge = ({ value }) => <span className={`pt-badge pt-badge-${TONES[value] || "muted"}`}>{humanize(value)}</span>;

export function Notice({ kind = "error", children }) {
  if (!children) return null;
  return <p className={`cm-notice cm-notice-${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</p>;
}

export function Loading({ what = "Loading" }) {
  return <p className="cm-muted" aria-live="polite">{what}…</p>;
}

// columns: [{ key, label, render?, align? }]
export function Table({ columns, rows, empty = "Nothing here yet.", rowKey = (r, i) => r.id || i, onRow }) {
  if (!rows || rows.length === 0) return <p className="cm-muted cm-empty">{empty}</p>;
  return (
    <div className="pt-table-wrap">
      <table className="pt-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={c.align === "right" ? "is-right" : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className={onRow ? "is-click" : undefined} onClick={onRow ? () => onRow(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === "right" ? "is-right" : undefined} data-label={c.label}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const day = (iso) => formatDate(iso);

export function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button" className="cm-btn cm-btn-outline cm-btn-sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Users, Receipt, Banknote, FileText, Percent, ScrollText, BookOpen, RotateCcw } from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import { api, inr, pct, rateText } from "../../lib/affiliateApi.js";
import { Field, TextInput } from "../../components/Field.jsx";
import { Shell, Tabs, SideNav, SidebarLayout, Stat, Badge, Notice, Loading, Table, useLoad, day } from "./ui.jsx";
import { Payouts, Reports, Rules, Audit, Ebooks } from "./AdminMore.jsx";
import { Refunds } from "./RefundAdmin.jsx";

const money = (k) => (r) => inr(r[k]);

function InfluencerDetail({ id, onClose, onChanged }) {
  const { data, error, loading, reload } = useLoad(() => api(`/admin/influencers/${id}`), [id]);
  const [note, setNote] = useState("");
  const [coupon, setCoupon] = useState("");
  const [rate, setRate] = useState({ type: "percent", value: "" });
  const [msg, setMsg] = useState({ kind: "success", text: "" });
  const [busy, setBusy] = useState(false);

  async function act(path, body, method = "POST", done = "Done.") {
    setBusy(true); setMsg({ kind: "success", text: "" });
    try { await api(path, { method, body }); setMsg({ kind: "success", text: done }); setNote(""); await reload(); onChanged(); } catch (e) { setMsg({ kind: "error", text: e.message }); } finally { setBusy(false); }
  }

  if (loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  const { influencer: i, summary: s, commissions } = data;
  const status = (action, label, kind = "outline") => (
    <button key={action} className={`cm-btn cm-btn-${kind}`} disabled={busy} onClick={() => act(`/admin/influencers/${id}/status`, { action, note, couponCode: action === "approve" ? coupon : undefined }, "POST", `${label} done.`)}>{label}</button>
  );
  const actions = {
    submitted: [status("review", "Start review"), status("approve", "Approve", "primary"), status("reject", "Reject")],
    under_review: [status("approve", "Approve", "primary"), status("reject", "Reject")],
    active: [status("suspend", "Suspend")],
    suspended: [status("reactivate", "Reactivate", "primary")],
    rejected: [status("reconsider", "Reconsider")],
  }[i.status] || [];

  return (
    <section className="cm-card pt-detail" aria-label={`Details for ${i.name}`}>
      <div className="pt-detail-head">
        <div><h2 className="cm-card-title">{i.name}</h2><p className="cm-muted">{i.email}{i.phone ? ` · ${i.phone}` : ""}</p></div>
        <div className="cm-actions"><Badge value={i.status} /><button className="cm-btn cm-btn-outline cm-btn-sm" onClick={onClose}>Close</button></div>
      </div>
      <Notice kind={msg.kind}>{msg.text}</Notice>
      <dl className="cm-details cm-details-flat">
        <div><dt>Audience</dt><dd>{i.audience || "–"}</dd></div>
        <div><dt>About</dt><dd>{i.pitch}</dd></div>
        <div><dt>Social</dt><dd>{Object.entries(i.social || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ") || "–"}</dd></div>
        <div><dt>Payout details</dt><dd>{i.payout ? (i.payout.method === "upi" ? `UPI ${i.payout.upi}` : `${i.payout.accountName}, ${i.payout.accountNumber}, ${i.payout.ifsc}`) : "–"}</dd></div>
        {i.code && <div><dt>Referral ID / coupon</dt><dd>{i.code} / {i.couponCode} {i.couponSync && i.couponSync.state !== "created" && <em>(Shopify coupon: {i.couponSync.state}{i.couponSync.error ? ` – ${i.couponSync.error}` : ""})</em>}</dd></div>}
        <div><dt>Commission rate</dt><dd>{i.commissionOverride ? `${rateText(i.commissionOverride)} (custom)` : "Standard rate"}</dd></div>
      </dl>

      {actions.length > 0 && (
        <div className="cm-form">
          <div className="cm-form-grid">
            <Field id="st-note" label="Note (kept in the history)" optional><TextInput id="st-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {["submitted", "under_review"].includes(i.status) && <Field id="st-coupon" label="Custom coupon code" optional hint="Leave blank to use the referral ID."><TextInput id="st-coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} /></Field>}
          </div>
          <div className="cm-actions">{actions}</div>
        </div>
      )}

      {["active", "suspended"].includes(i.status) && (
        <>
          <h3 className="cm-h3">Numbers</h3>
          <div className="pt-stats">
            <Stat label="E-books sold" value={s.unitsSold} hint={`${s.refundedUnits} refunded`} />
            <Stat label="Gross / net sales" value={inr(s.grossSalesPaise)} hint={`Net ${inr(s.netSalesPaise)}`} />
            <Stat label="Earned" value={inr(s.commission.earnedPaise)} />
            <Stat label="Pending + approved" value={inr(s.commission.pendingPaise + s.commission.approvedPaise)} tone="warn" />
            <Stat label="Payable" value={inr(s.commission.balancePayablePaise)} tone="good" hint={s.commission.clawbackOutstandingPaise ? `After ${inr(s.commission.clawbackOutstandingPaise)} clawback` : undefined} />
            <Stat label="Paid" value={inr(s.commission.paidPaise)} />
            <Stat label="Reversed" value={inr(s.commission.reversedPaise)} />
            <Stat label="Clicks / conversion" value={s.clicks} hint={pct(s.conversionRate)} />
          </div>
          <h3 className="cm-h3">Custom commission rate</h3>
          <div className="cm-form-grid cm-inline-form">
            <Field id="rt-type" label="Type"><select id="rt-type" className="cm-input" value={rate.type} onChange={(e) => setRate({ ...rate, type: e.target.value })}><option value="percent">Percent</option><option value="fixed">Fixed ₹ per unit</option></select></Field>
            <Field id="rt-val" label={rate.type === "percent" ? "Percent" : "Rupees"}><TextInput id="rt-val" inputMode="decimal" value={rate.value} onChange={(e) => setRate({ ...rate, value: e.target.value })} /></Field>
          </div>
          <div className="cm-actions">
            <button className="cm-btn cm-btn-primary" disabled={busy || rate.value === ""} onClick={() => act(`/admin/influencers/${id}/rate`, { rate }, "PUT", "Rate saved.")}>Save custom rate</button>
            {i.commissionOverride && <button className="cm-btn cm-btn-outline" disabled={busy} onClick={() => act(`/admin/influencers/${id}/rate`, { clear: true }, "PUT", "Back to the standard rate.")}>Use standard rate</button>}
          </div>
          <h3 className="cm-h3">Commissions</h3>
          <Table rows={commissions} columns={commissionColumns} />
        </>
      )}
      <h3 className="cm-h3">History</h3>
      <Table rows={[...(i.history || [])].reverse()} rowKey={(r, n) => n} columns={[
        { key: "at", label: "When", render: (r) => day(r.at) }, { key: "to", label: "Status", render: (r) => <Badge value={r.to} /> },
        { key: "by", label: "By" }, { key: "note", label: "Note" },
      ]} />
    </section>
  );
}

export const commissionColumns = [
  { key: "orderName", label: "Order" }, { key: "createdAt", label: "Date", render: (r) => day(r.createdAt) },
  { key: "state", label: "Status", render: (r) => <>{<Badge value={r.state} />}{r.flagged && <span className="cm-flag" title="Flagged for review"> ⚑</span>}</> },
  { key: "grossPaise", label: "Commission", align: "right", render: money("grossPaise") },
  { key: "reversedPaise", label: "Reversed", align: "right", render: (r) => (r.reversedPaise ? `−${inr(r.reversedPaise)}` : "–") },
  { key: "net", label: "Net", align: "right", render: (r) => inr(Math.max(0, r.grossPaise + (r.adjustmentPaise || 0) - (r.reversedPaise || 0))) },
  { key: "holdUntil", label: "Payable from", render: (r) => (["pending", "approved"].includes(r.state) ? day(r.holdUntil) : "–") },
];

function Influencers() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const { data, error, loading, reload } = useLoad(() => api(`/admin/influencers?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`), [status, q]);
  return (
    <>
      <div className="pt-toolbar">
        <Field id="f-status" label="Status"><select id="f-status" className="cm-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>{["submitted", "under_review", "active", "suspended", "rejected"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select></Field>
        <Field id="f-q" label="Search"><TextInput id="f-q" placeholder="Name, email, referral ID or coupon" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
      </div>
      {loading ? <Loading /> : error ? <Notice>{error}</Notice> : (
        <Table rows={data.influencers} empty="No influencers match." onRow={(r) => setOpen(r.id)} columns={[
          { key: "name", label: "Influencer", render: (r) => <><strong>{r.name}</strong><br /><span className="cm-muted">{r.email}</span></> },
          { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
          { key: "code", label: "Referral ID", render: (r) => r.code || "–" },
          { key: "units", label: "E-books sold", render: (r) => (r.summary ? r.summary.unitsSold : "–") },
          { key: "net", label: "Net sales", align: "right", render: (r) => (r.summary ? inr(r.summary.netSalesPaise) : "–") },
          { key: "rate", label: "Rate", render: (r) => (r.commissionOverride ? rateText(r.commissionOverride) : "Standard") },
          { key: "earned", label: "Earned", align: "right", render: (r) => (r.summary ? inr(r.summary.commission.earnedPaise) : "–") },
          { key: "paid", label: "Paid", align: "right", render: (r) => (r.summary ? inr(r.summary.commission.paidPaise) : "–") },
          { key: "bal", label: "Balance payable", align: "right", render: (r) => (r.summary ? inr(r.summary.commission.balancePayablePaise) : "–") },
        ]} />
      )}
      {open && <InfluencerDetail id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

function Commissions() {
  const [state, setState] = useState("");
  const [picked, setPicked] = useState([]);
  const [adj, setAdj] = useState(null);
  const [msg, setMsg] = useState({ kind: "success", text: "" });
  const { data, error, loading, reload } = useLoad(() => api(`/admin/commissions?state=${state}`), [state]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function approve(force) {
    try { const r = await api("/admin/commissions/approve", { method: "POST", body: { ids: picked, force } }); setMsg({ kind: "success", text: `${r.approved} approved, ${r.skipped} skipped${r.skipped && !force ? " (flagged ones need a forced approval)" : ""}.` }); setPicked([]); reload(); } catch (e) { setMsg({ kind: "error", text: e.message }); }
  }
  async function adjust(e) {
    e.preventDefault();
    try {
      const paise = Math.round(Number(adj.rupees) * 100);
      await api(`/admin/commissions/${adj.id}/adjust`, { method: "POST", body: { deltaPaise: adj.sign * paise, reason: adj.reason } });
      setAdj(null); setMsg({ kind: "success", text: "Adjustment recorded in the audit log." }); reload();
    } catch (err) { setMsg({ kind: "error", text: err.message }); }
  }

  return (
    <>
      <div className="pt-toolbar">
        <Field id="c-state" label="Status"><select id="c-state" className="cm-input" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All</option>{["pending", "approved", "payable", "paid", "reversed"].map((s) => <option key={s}>{s}</option>)}
        </select></Field>
        <div className="cm-actions">
          <button className="cm-btn cm-btn-primary" disabled={!picked.length} onClick={() => approve(false)}>Approve selected</button>
          <button className="cm-btn cm-btn-outline" disabled={!picked.length} onClick={() => approve(true)}>Approve incl. flagged</button>
        </div>
      </div>
      <Notice kind={msg.kind}>{msg.text}</Notice>
      {adj && (
        <form className="cm-card cm-form cm-narrow" onSubmit={adjust}>
          <h3 className="cm-card-title">Adjust commission for {adj.name}</h3>
          <div className="cm-form-grid">
            <Field id="aj-dir" label="Direction"><select id="aj-dir" className="cm-input" value={adj.sign} onChange={(e) => setAdj({ ...adj, sign: Number(e.target.value) })}><option value={-1}>Reduce</option><option value={1}>Increase</option></select></Field>
            <Field id="aj-amt" label="Amount (₹)"><TextInput id="aj-amt" inputMode="decimal" value={adj.rupees} onChange={(e) => setAdj({ ...adj, rupees: e.target.value })} required /></Field>
          </div>
          <Field id="aj-why" label="Reason (required, saved in the audit log)"><TextInput id="aj-why" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} required /></Field>
          <div className="cm-actions"><button className="cm-btn cm-btn-primary">Record adjustment</button><button type="button" className="cm-btn cm-btn-outline" onClick={() => setAdj(null)}>Cancel</button></div>
        </form>
      )}
      {loading ? <Loading /> : error ? <Notice>{error}</Notice> : (
        <Table rows={data.commissions} empty="No commissions." columns={[
          { key: "pick", label: "", render: (r) => <input type="checkbox" aria-label={`Select ${r.orderName}`} checked={picked.includes(r.id)} disabled={r.state !== "pending"} onChange={() => toggle(r.id)} /> },
          { key: "influencerCode", label: "Partner" }, ...commissionColumns,
          { key: "act", label: "", render: (r) => <button className="cm-btn cm-btn-outline cm-btn-sm" onClick={() => setAdj({ id: r.id, name: r.orderName, sign: -1, rupees: "", reason: "" })}>Adjust</button> },
        ]} />
      )}
    </>
  );
}

// The admin tabs, shared by the website's /admin page and the page embedded in the Shopify admin.
// can(permission) decides which areas show; the server enforces the same rules on every request.
export function AdminConsole({ can, layout = "sidebar" }) {
  const [tab, setTab] = useState("influencers");
  const tabs = [
    can("partners") && { id: "influencers", label: "Influencers", icon: Users },
    can("partners") && { id: "commissions", label: "Commissions", icon: Receipt },
    can("finance") && { id: "payouts", label: "Payouts", icon: Banknote },
    can("finance") && { id: "refunds", label: "Refunds", icon: RotateCcw },
    (can("partners") || can("finance")) && { id: "reports", label: "Reports", icon: FileText },
    (can("partners") || can("finance")) && { id: "ebooks", label: "E-books", icon: BookOpen },
    can("partners") && { id: "rules", label: "Affiliate rules", icon: Percent },
    can("finance") && { id: "audit", label: "Audit log", icon: ScrollText },
  ].filter(Boolean);
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0] && tabs[0].id;
  const body = (
    <>
      {active === "influencers" && <Influencers />}
      {active === "commissions" && <Commissions />}
      {active === "payouts" && <Payouts />}
      {active === "refunds" && <Refunds />}
      {active === "reports" && <Reports />}
      {active === "ebooks" && <Ebooks />}
      {active === "rules" && <Rules />}
      {active === "audit" && <Audit />}
    </>
  );
  if (tabs.length === 0) return <Notice>Your admin role has no areas assigned yet.</Notice>;
  // Inside the Shopify admin, which already has its own sidebar, the sections stay as tabs along the top.
  if (layout === "tabs") return <><Tabs tabs={tabs} active={active} onChange={setTab} label="Admin sections" />{body}</>;
  return (
    <SidebarLayout nav={<SideNav items={tabs} active={active} onChange={setTab} label="Admin sections" />}>
      <h2 className="cm-h2">{tabs.find((t) => t.id === active).label}</h2>
      {body}
    </SidebarLayout>
  );
}

export default function Admin() {
  const { status, me, isAdmin } = useAdmin();
  if (status === "loading") return <Shell title="Affiliate admin"><Loading /></Shell>;
  if (status !== "authed") return <Navigate to="/admin/login" replace state={{ from: "/admin" }} />;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  const can = (p) => me.role === "super_admin" || (me.perms || []).includes(p);
  return (
    <Shell eyebrow="Admin" title="Affiliate admin">
      <AdminConsole can={can} />
    </Shell>
  );
}

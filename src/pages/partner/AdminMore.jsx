import { useState } from "react";
import { api, inr, rateText } from "../../lib/affiliateApi.js";
import { Field, TextInput } from "../../components/Field.jsx";
import { Badge, Notice, Loading, Table, useLoad, day } from "./ui.jsx";

function NewPayout({ onCreated }) {
  const people = useLoad(() => api("/admin/influencers?status=active"));
  const [who, setWho] = useState("");
  const [picked, setPicked] = useState([]);
  const [method, setMethod] = useState("UPI");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState({ kind: "success", text: "" });
  const payable = useLoad(() => (who ? api(`/admin/commissions?state=payable&influencerId=${who}`) : Promise.resolve({ commissions: [] })), [who]);
  const rows = (payable.data ? payable.data.commissions : []).filter((c) => !c.payoutId);
  const total = rows.filter((c) => picked.includes(c.id)).reduce((s, c) => s + Math.max(0, c.grossPaise + (c.adjustmentPaise || 0) - (c.reversedPaise || 0)), 0);

  async function create(e) {
    e.preventDefault();
    try {
      const r = await api("/admin/payouts", { method: "POST", body: { influencerId: who, commissionIds: picked, method, notes } });
      setMsg({ kind: "success", text: `Payout created for ${inr(r.amountPaise)} (after any refund clawbacks). Pay it, then record the reference below.` });
      setPicked([]); payable.reload(); onCreated();
    } catch (err) { setMsg({ kind: "error", text: err.message }); }
  }
  return (
    <form className="cm-card cm-form" onSubmit={create}>
      <h3 className="cm-card-title">Create a payout</h3>
      <Notice kind={msg.kind}>{msg.text}</Notice>
      <div className="cm-form-grid">
        <Field id="np-who" label="Influencer"><select id="np-who" className="cm-input" value={who} onChange={(e) => { setWho(e.target.value); setPicked([]); }}>
          <option value="">Choose…</option>{people.data && people.data.influencers.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
        </select></Field>
        <Field id="np-method" label="Method"><TextInput id="np-method" value={method} onChange={(e) => setMethod(e.target.value)} /></Field>
      </div>
      {who && (payable.loading ? <Loading /> : (
        <Table rows={rows} empty="No payable commissions for this influencer." columns={[
          { key: "pick", label: "", render: (r) => <input type="checkbox" aria-label={`Select ${r.orderName}`} checked={picked.includes(r.id)} onChange={() => setPicked((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))} /> },
          { key: "orderName", label: "Order" }, { key: "createdAt", label: "Date", render: (r) => day(r.createdAt) },
          { key: "net", label: "Amount", align: "right", render: (r) => inr(Math.max(0, r.grossPaise + (r.adjustmentPaise || 0) - (r.reversedPaise || 0))) },
        ]} />
      ))}
      <Field id="np-notes" label="Notes" optional><TextInput id="np-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="cm-actions"><button className="cm-btn cm-btn-primary" disabled={!picked.length}>Create payout ({inr(total)} before clawbacks)</button></div>
    </form>
  );
}

function PayoutRow({ p, onDone }) {
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState("");
  async function paid(e) {
    e.preventDefault();
    try { await api(`/admin/payouts/${p.id}/paid`, { method: "POST", body: { reference: ref, paidAt: date, method: p.method } }); onDone(); } catch (err) { setMsg(err.message); }
  }
  async function cancel() {
    const reason = window.prompt("Why is this payout being cancelled?");
    if (!reason) return;
    try { await api(`/admin/payouts/${p.id}/cancel`, { method: "POST", body: { reason } }); onDone(); } catch (err) { setMsg(err.message); }
  }
  return (
    <form className="cm-card cm-form" onSubmit={paid}>
      <div className="pt-detail-head"><div><strong>{p.influencerName}</strong> · {inr(p.amountPaise)} via {p.method}</div><Badge value={p.status} /></div>
      <p className="cm-muted">{p.items.map((i) => i.orderName).join(", ")}{p.clawbackPaise ? ` · ${inr(p.clawbackPaise)} refund clawback netted off` : ""}</p>
      <Notice>{msg}</Notice>
      <div className="cm-form-grid">
        <Field id={`pr-${p.id}`} label="Transaction reference (UTR)"><TextInput id={`pr-${p.id}`} value={ref} onChange={(e) => setRef(e.target.value)} required /></Field>
        <Field id={`pd-${p.id}`} label="Payment date"><TextInput id={`pd-${p.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      </div>
      <div className="cm-actions"><button className="cm-btn cm-btn-primary">Mark as paid</button><button type="button" className="cm-btn cm-btn-outline" onClick={cancel}>Cancel payout</button></div>
    </form>
  );
}

export function Payouts() {
  const { data, error, loading, reload } = useLoad(() => api("/admin/payouts"));
  if (loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  const open = data.payouts.filter((p) => p.status === "processing");
  const rest = data.payouts.filter((p) => p.status !== "processing");
  return (
    <>
      <NewPayout onCreated={reload} />
      {open.length > 0 && <h3 className="cm-h3">Waiting for payment</h3>}
      {open.map((p) => <PayoutRow key={p.id} p={p} onDone={reload} />)}
      <h3 className="cm-h3">Payout history</h3>
      <Table rows={rest} empty="No completed payouts yet." columns={[
        { key: "paidAt", label: "Date", render: (r) => day(r.paidAt || r.createdAt) }, { key: "influencerName", label: "Influencer" },
        { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> }, { key: "method", label: "Method" },
        { key: "reference", label: "Reference", render: (r) => r.reference || "–" }, { key: "amountPaise", label: "Amount", align: "right", render: (r) => inr(r.amountPaise) },
      ]} />
    </>
  );
}

const REPORT_LIST = [["influencers", "Influencer performance"], ["liability", "Commission liability"], ["sales", "Sales overview"], ["ebooks", "E-book performance"], ["payouts", "Payout report"], ["refunds", "Refund report"]];
const LABELS = (k) => k.replace(/Paise$/, " (₹)").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export function Reports() {
  const [name, setName] = useState("influencers");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = `from=${from}&to=${to}`;
  const { data, error, loading } = useLoad(() => api(`/admin/reports/${name}?${qs}`), [name, from, to]);

  async function download() {
    const r = await api(`/admin/reports/${name}?${qs}&format=csv`);
    const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: r.filename });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  const rows = data ? data.rows : [];
  const cols = rows.length ? Object.keys(rows[0]).map((k) => ({
    key: k, label: LABELS(k), align: k.endsWith("Paise") || typeof rows[0][k] === "number" ? "right" : undefined,
    render: (r) => (k.endsWith("Paise") ? inr(r[k]) : k === "conversionRate" ? `${(r[k] * 100).toFixed(1)}%` : /At$/.test(k) && r[k] ? day(r[k]) : String(r[k] ?? "")),
  })) : [];
  return (
    <>
      <div className="pt-toolbar">
        <Field id="rp-name" label="Report"><select id="rp-name" className="cm-input" value={name} onChange={(e) => setName(e.target.value)}>{REPORT_LIST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field id="rp-from" label="From" optional><TextInput id="rp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field id="rp-to" label="To" optional><TextInput id="rp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <button className="cm-btn cm-btn-outline" onClick={download} disabled={!rows.length}>Download CSV</button>
      </div>
      {loading ? <Loading /> : error ? <Notice>{error}</Notice> : <Table rows={rows} columns={cols} empty="No data for this selection." rowKey={(r, i) => i} />}
    </>
  );
}

export function Rules() {
  const { data, error, loading, reload } = useLoad(() => api("/admin/settings"));
  const rates = useLoad(() => api("/admin/product-rates"));
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState({ kind: "success", text: "" });
  const [pr, setPr] = useState({ id: "", title: "", type: "percent", value: "", eligible: true });
  if (loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  const s = data.settings;
  const v = f || {
    rateType: s.defaultRate.type, rateValue: s.defaultRate.type === "percent" ? s.defaultRate.bps / 100 : s.defaultRate.paise / 100,
    commissionBase: s.commissionBase, excludeTax: s.excludeTax, holdDays: s.holdDays, autoApprove: s.autoApprove,
    minPayoutRupees: s.minPayoutPaise / 100, attributionWindowDays: s.attributionWindowDays, conflictRule: s.conflictRule,
    selfReferral: s.selfReferral, couponDiscountPercent: s.couponDiscountBps / 100,
  };
  const set = (k) => (e) => setF({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    try {
      await api("/admin/settings", { method: "PUT", body: {
        defaultRate: { type: v.rateType, value: Number(v.rateValue) }, commissionBase: v.commissionBase, excludeTax: v.excludeTax,
        holdDays: Number(v.holdDays), autoApprove: v.autoApprove, minPayoutRupees: Number(v.minPayoutRupees),
        attributionWindowDays: Number(v.attributionWindowDays), conflictRule: v.conflictRule, selfReferral: v.selfReferral,
        couponDiscountPercent: Number(v.couponDiscountPercent),
      } });
      setMsg({ kind: "success", text: "Rules saved. They apply to new orders; past commissions keep the rules they were created under." }); setF(null); reload();
    } catch (err) { setMsg({ kind: "error", text: err.message }); }
  }
  async function saveProduct(e) {
    e.preventDefault();
    try {
      await api(`/admin/product-rates/${encodeURIComponent(pr.id)}`, { method: "PUT", body: { title: pr.title, eligible: pr.eligible, rate: pr.value === "" ? undefined : { type: pr.type, value: Number(pr.value) } } });
      setPr({ id: "", title: "", type: "percent", value: "", eligible: true }); rates.reload();
    } catch (err) { setMsg({ kind: "error", text: err.message }); }
  }
  return (
    <>
      <form className="cm-card cm-form" onSubmit={save}>
        <h3 className="cm-card-title">Commission and attribution rules</h3>
        <Notice kind={msg.kind}>{msg.text}</Notice>
        <div className="cm-form-grid">
          <Field id="ru-type" label="Default commission type"><select id="ru-type" className="cm-input" value={v.rateType} onChange={set("rateType")}><option value="percent">Percent of sale</option><option value="fixed">Fixed ₹ per unit</option></select></Field>
          <Field id="ru-val" label={v.rateType === "percent" ? "Default percent" : "Default rupees"}><TextInput id="ru-val" inputMode="decimal" value={v.rateValue} onChange={set("rateValue")} /></Field>
          <Field id="ru-base" label="Commission is calculated on"><select id="ru-base" className="cm-input" value={v.commissionBase} onChange={set("commissionBase")}><option value="net">Net sale (after discounts)</option><option value="gross">Gross sale (before discounts)</option></select></Field>
          <Field id="ru-hold" label="Hold period (days)"><TextInput id="ru-hold" inputMode="numeric" value={v.holdDays} onChange={set("holdDays")} /></Field>
          <Field id="ru-min" label="Minimum payout (₹)"><TextInput id="ru-min" inputMode="numeric" value={v.minPayoutRupees} onChange={set("minPayoutRupees")} /></Field>
          <Field id="ru-win" label="Attribution window (days)"><TextInput id="ru-win" inputMode="numeric" value={v.attributionWindowDays} onChange={set("attributionWindowDays")} /></Field>
          <Field id="ru-cd" label="Coupon discount for customers (%)"><TextInput id="ru-cd" inputMode="decimal" value={v.couponDiscountPercent} onChange={set("couponDiscountPercent")} /></Field>
          <Field id="ru-conf" label="If link and coupon belong to different partners"><select id="ru-conf" className="cm-input" value={v.conflictRule} onChange={set("conflictRule")}><option value="coupon">Credit the coupon owner</option><option value="link">Credit the link owner</option></select></Field>
          <Field id="ru-self" label="Self-referral (partner buys via own link)"><select id="ru-self" className="cm-input" value={v.selfReferral} onChange={set("selfReferral")}><option value="block">Block commission</option><option value="flag">Allow but flag for review</option></select></Field>
        </div>
        <label className="cm-check"><input type="checkbox" checked={v.excludeTax} onChange={set("excludeTax")} /> Leave tax out of the commission base (when prices include tax)</label>
        <label className="cm-check"><input type="checkbox" checked={v.autoApprove} onChange={set("autoApprove")} /> Approve commissions automatically when the hold period ends</label>
        <div className="cm-actions"><button className="cm-btn cm-btn-primary">Save rules</button></div>
      </form>

      <form className="cm-card cm-form" onSubmit={saveProduct}>
        <h3 className="cm-card-title">Per-e-book commission</h3>
        <p className="cm-muted">Overrides the default for one product. Use the numeric product ID from Shopify (the number at the end of the product's admin URL).</p>
        <div className="cm-form-grid">
          <Field id="pp-id" label="Shopify product ID"><TextInput id="pp-id" value={pr.id} onChange={(e) => setPr({ ...pr, id: e.target.value })} required /></Field>
          <Field id="pp-title" label="Label" optional><TextInput id="pp-title" value={pr.title} onChange={(e) => setPr({ ...pr, title: e.target.value })} /></Field>
          <Field id="pp-type" label="Type"><select id="pp-type" className="cm-input" value={pr.type} onChange={(e) => setPr({ ...pr, type: e.target.value })}><option value="percent">Percent</option><option value="fixed">Fixed ₹ per unit</option></select></Field>
          <Field id="pp-val" label="Value" optional><TextInput id="pp-val" inputMode="decimal" value={pr.value} onChange={(e) => setPr({ ...pr, value: e.target.value })} /></Field>
        </div>
        <label className="cm-check"><input type="checkbox" checked={pr.eligible} onChange={(e) => setPr({ ...pr, eligible: e.target.checked })} /> Eligible for affiliate commission</label>
        <div className="cm-actions"><button className="cm-btn cm-btn-primary">Save product rule</button></div>
        <Table rows={rates.data ? rates.data.rates : []} empty="No per-product rules. The default applies." columns={[
          { key: "id", label: "Product ID" }, { key: "title", label: "Label" },
          { key: "rate", label: "Rate", render: (r) => (r.type ? rateText(r) : "Default") },
          { key: "eligible", label: "Eligible", render: (r) => (r.eligible === false ? "No" : "Yes") },
        ]} />
      </form>
    </>
  );
}

export function Audit() {
  const [action, setAction] = useState("");
  const { data, error, loading } = useLoad(() => api(`/admin/audit?action=${encodeURIComponent(action)}`), [action]);
  return (
    <>
      <div className="pt-toolbar">
        <Field id="au-a" label="Action"><select id="au-a" className="cm-input" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All</option>
          {["influencer_status_changed", "influencer_rate_changed", "product_rate_changed", "settings_changed", "commission_approved", "commission_adjusted", "commission_reversed", "payout_created", "payout_paid", "payout_cancelled", "suspicious_referral", "payout_details_changed"].map((a) => <option key={a}>{a}</option>)}
        </select></Field>
      </div>
      {loading ? <Loading /> : error ? <Notice>{error}</Notice> : (
        <Table rows={data.entries} empty="No entries." columns={[
          { key: "at", label: "When", render: (r) => new Date(r.at).toLocaleString("en-IN") }, { key: "by", label: "By" },
          { key: "action", label: "Action" }, { key: "entity", label: "Record" },
          { key: "details", label: "Details", render: (r) => <code className="cm-code-sm">{JSON.stringify(r.details)}</code> },
        ]} />
      )}
    </>
  );
}

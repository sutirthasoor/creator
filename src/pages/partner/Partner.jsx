import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ShieldCheck, LayoutDashboard, Megaphone, ShoppingBag, Receipt, Wallet, User } from "lucide-react";
import { usePartner } from "../../context/PartnerContext.jsx";
import { api, inr, pct, rateText } from "../../lib/affiliateApi.js";
import { Field, TextInput } from "../../components/Field.jsx";
import { Shell, SideNav, SidebarLayout, Stat, Badge, Notice, Loading, Table, CopyButton, useLoad, day } from "./ui.jsx";

const SOCIALS = [["instagram", "Instagram"], ["youtube", "YouTube"], ["tiktok", "TikTok"], ["twitter", "X / Twitter"], ["website", "Website"]];

function PayoutFields({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className="cm-fieldset">
      <legend className="cm-label">Where should we pay you?</legend>
      <div className="cm-form-grid">
        <Field id="po-method" label="Method">
          <select id="po-method" className="cm-input" value={value.method} onChange={set("method")}>
            <option value="upi">UPI</option>
            <option value="bank">Bank transfer</option>
          </select>
        </Field>
        {value.method === "upi" ? (
          <Field id="po-upi" label="UPI ID"><TextInput id="po-upi" value={value.upi} onChange={set("upi")} placeholder="name@bank" /></Field>
        ) : (
          <>
            <Field id="po-name" label="Account holder"><TextInput id="po-name" value={value.accountName} onChange={set("accountName")} /></Field>
            <Field id="po-acc" label="Account number"><TextInput id="po-acc" value={value.accountNumber} onChange={set("accountNumber")} inputMode="numeric" /></Field>
            <Field id="po-ifsc" label="IFSC"><TextInput id="po-ifsc" value={value.ifsc} onChange={set("ifsc")} /></Field>
          </>
        )}
      </div>
    </fieldset>
  );
}

const emptyPayout = { method: "upi", upi: "", accountName: "", accountNumber: "", ifsc: "" };
const emptySocial = { instagram: "", youtube: "", tiktok: "", twitter: "", website: "" };

function Apply({ me, onDone }) {
  const { resend, refresh } = usePartner();
  const [f, setF] = useState({ name: "", phone: "", audience: "", pitch: "", social: emptySocial, payout: emptyPayout });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  if (!me.emailVerified) {
    return (
      <section className="cm-card cm-narrow">
        <h2 className="cm-card-title">Verify your email first</h2>
        <p className="cm-muted">We sent a link to <strong>{me.email}</strong>. Open it, then come back and continue. We need a verified email to protect partner payouts.</p>
        <Notice>{error}</Notice><Notice kind="success">{info}</Notice>
        <div className="cm-actions">
          <button className="cm-btn cm-btn-primary" onClick={async () => { setError(""); await refresh({ force: true }); }}>I have verified</button>
          <button className="cm-btn cm-btn-outline" onClick={async () => { try { await resend(); setInfo("Sent again. Check your inbox and spam folder."); } catch (e) { setError(e.message); } }}>Resend email</button>
        </div>
      </section>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!f.name.trim()) return setError("Please enter your name.");
    if (f.pitch.trim().length < 20) return setError("Tell us a little more about your audience (a sentence or two).");
    if (f.payout.method === "upi" ? !f.payout.upi.trim() : !(f.payout.accountNumber.trim() && f.payout.ifsc.trim() && f.payout.accountName.trim())) {
      return setError("Add your payout details so we can pay you once you earn.");
    }
    setBusy(true);
    try { await api("/influencer/apply", { method: "POST", body: f }); await onDone(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form className="cm-card cm-narrow cm-form" onSubmit={submit} noValidate>
      <h2 className="cm-card-title">Apply to become a Creator Moves 365 partner</h2>
      <p className="cm-muted">Share the Masterbook with your audience and earn a commission on every verified sale. We review each application by hand.</p>
      <Notice>{error}</Notice>
      <div className="cm-form-grid">
        <Field id="ap-name" label="Your name"><TextInput id="ap-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field id="ap-phone" label="Phone" optional><TextInput id="ap-phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        {SOCIALS.map(([k, label]) => (
          <Field key={k} id={`ap-${k}`} label={label} optional>
            <TextInput id={`ap-${k}`} value={f.social[k]} onChange={(e) => setF({ ...f, social: { ...f.social, [k]: e.target.value } })} placeholder="Link or @handle" />
          </Field>
        ))}
        <Field id="ap-aud" label="Audience size" optional><TextInput id="ap-aud" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} placeholder="e.g. 25k on Instagram" /></Field>
      </div>
      <Field id="ap-pitch" label="Tell us about your audience and how you will promote the Masterbook">
        <textarea id="ap-pitch" className="cm-input cm-textarea" rows={4} value={f.pitch} onChange={(e) => setF({ ...f, pitch: e.target.value })} maxLength={1000} />
      </Field>
      <PayoutFields value={f.payout} onChange={(payout) => setF({ ...f, payout })} />
      <button className="cm-btn cm-btn-primary" disabled={busy}>{busy ? "Sending…" : "Submit application"}</button>
    </form>
  );
}

function StatusCard({ status }) {
  const text = {
    submitted: ["Application received", "Thanks for applying. Our team will review it and email you soon."],
    under_review: ["Application under review", "We are looking at your application now. You will get an email once there is a decision."],
    rejected: ["Application not approved", "We are not able to approve this application right now. Contact customer.care@aa100xtech.com if you would like to talk it through."],
    suspended: ["Account suspended", "Your partner account is paused, so new sales are not being credited. Contact customer.care@aa100xtech.com for help."],
  }[status];
  return (
    <section className="cm-card cm-narrow">
      <Badge value={status} />
      <h2 className="cm-card-title">{text[0]}</h2>
      <p className="cm-muted">{text[1]}</p>
    </section>
  );
}

function Overview({ d }) {
  const s = d.summary;
  const c = s.commission;
  return (
    <>
      <div className="pt-stats">
        <Stat label="Link clicks" value={s.clicks} />
        <Stat label="Orders" value={s.orders} hint={`Conversion ${pct(s.conversionRate)}`} />
        <Stat label="E-books sold" value={s.unitsSold} hint={s.refundedUnits ? `${s.refundedUnits} refunded` : undefined} />
        <Stat label="Net sales" value={inr(s.netSalesPaise)} hint={`Gross ${inr(s.grossSalesPaise)}`} />
      </div>
      <h2 className="cm-h3">Your earnings</h2>
      <div className="pt-stats">
        <Stat label="Pending" value={inr(c.pendingPaise + c.approvedPaise)} hint={`Held for ${d.terms.holdDays} days after each sale`} tone="warn" />
        <Stat label="Payable now" value={inr(c.balancePayablePaise)} hint={c.clawbackOutstandingPaise ? `After ${inr(c.clawbackOutstandingPaise)} of refunds` : `Minimum payout ${inr(d.terms.minPayoutPaise)}`} tone="good" />
        <Stat label="Paid to you" value={inr(c.paidPaise)} />
        <Stat label="Reversed (refunds)" value={inr(c.reversedPaise)} />
      </div>
      <p className="cm-fineprint"><ShieldCheck size={16} aria-hidden="true" /> Your rate: {rateText(d.terms.rate)}. Sales are credited when you share your link or coupon and the customer's payment is verified.</p>
    </>
  );
}

function Promotion({ d }) {
  const p = d.profile;
  const [target, setTarget] = useState(`${window.location.origin}/products`);
  let link = "";
  let problem = "";
  try {
    const u = new URL(target, window.location.origin);
    if (u.origin !== window.location.origin) problem = "Use a page from this website.";
    else { u.searchParams.set("ref", p.code); link = u.toString(); }
  } catch { problem = "Paste a full web address."; }
  return (
    <div className="cm-promo">
      <section className="cm-card">
        <h2 className="cm-card-title">Your referral link</h2>
        <p className="cm-muted">Paste any page of the store, for example a product page, to get a tracked link for it.</p>
        <Field id="pr-url" label="Page to link to" error={problem}><TextInput id="pr-url" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        {link && (<><code className="cm-code">{link}</code><div className="cm-actions"><CopyButton text={link} label="Copy link" /></div></>)}
        <p className="cm-fineprint">Credit lasts {d.terms.attributionWindowDays} days from the click.</p>
      </section>
      <section className="cm-card">
        <h2 className="cm-card-title">Your coupon code</h2>
        <p className="cm-muted">Customers get {d.terms.couponDiscountBps / 100}% off with this code, and the sale is credited to you.</p>
        <code className="cm-code cm-code-lg">{p.couponCode}</code>
        <div className="cm-actions"><CopyButton text={p.couponCode} label="Copy code" /></div>
        <p className="cm-fineprint">Referral ID: {p.code}</p>
      </section>
    </div>
  );
}

function Sales() {
  const { data, error, loading } = useLoad(() => api("/influencer/sales"));
  if (loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  return <Table rows={data.sales} empty="No sales yet. Share your link or coupon to get started." rowKey={(r) => r.order} columns={[
    { key: "order", label: "Order" }, { key: "date", label: "Date", render: (r) => day(r.date) },
    { key: "items", label: "E-books", render: (r) => r.items.map((i) => `${i.title} × ${i.qty}`).join(", ") },
    { key: "source", label: "Credited by" }, { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
    { key: "amountPaise", label: "Sale value", align: "right", render: (r) => inr(r.amountPaise) },
    { key: "refundedPaise", label: "Refunded", align: "right", render: (r) => (r.refundedPaise ? inr(r.refundedPaise) : "–") },
  ]} />;
}

function Earnings() {
  const { data, error, loading } = useLoad(() => api("/influencer/commissions"));
  if (loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  return <Table rows={data.commissions} empty="No commission yet." rowKey={(r) => r.order} columns={[
    { key: "order", label: "Order" }, { key: "date", label: "Date", render: (r) => day(r.date) },
    { key: "state", label: "Status", render: (r) => <>
      <Badge value={r.state} />
      {r.state !== "reversed" && r.reversedPaise > 0 && <> <Badge value={r.grossPaise + (r.adjustmentPaise || 0) - r.reversedPaise <= 0 ? "refunded" : "partially_refunded"} /></>}
      {(r.clawbackPaise || 0) > (r.clawbackSettledPaise || 0) && <span className="cm-fineprint"> Refunded after payout: {inr((r.clawbackPaise || 0) - (r.clawbackSettledPaise || 0))} comes off your next payout</span>}
    </> },
    { key: "holdUntil", label: "Payable from", render: (r) => (["pending", "approved"].includes(r.state) ? day(r.holdUntil) : "–") },
    { key: "grossPaise", label: "Commission", align: "right", render: (r) => inr(r.grossPaise) },
    { key: "reversedPaise", label: "Reversed", align: "right", render: (r) => (r.reversedPaise ? `−${inr(r.reversedPaise)}` : "–") },
    { key: "net", label: "Net", align: "right", render: (r) => inr(Math.max(0, r.grossPaise + r.adjustmentPaise - r.reversedPaise)) },
  ]} />;
}

function Payouts() {
  const { data, error, loading } = useLoad(() => api("/influencer/payouts"));
  if (loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  return <Table rows={data.payouts} empty="No payouts yet." rowKey={(r, i) => `${r.date}-${i}`} columns={[
    { key: "date", label: "Date", render: (r) => day(r.date) }, { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
    { key: "method", label: "Method" }, { key: "reference", label: "Reference", render: (r) => r.reference || "–" },
    { key: "orders", label: "Orders", render: (r) => r.orders.join(", ") },
    { key: "amountPaise", label: "Amount", align: "right", render: (r) => inr(r.amountPaise) },
  ]} />;
}

function Profile({ d, reload }) {
  const p = d.profile;
  const [f, setF] = useState({ name: p.name, phone: p.phone || "", social: { ...emptySocial, ...p.social }, payout: { ...emptyPayout, ...p.payout } });
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg({ kind: "", text: "" });
    try { await api("/influencer/profile", { method: "PUT", body: f }); setMsg({ kind: "success", text: "Saved." }); reload(); } catch (err) { setMsg({ kind: "error", text: err.message }); } finally { setBusy(false); }
  }
  return (
    <form className="cm-card cm-narrow cm-form" onSubmit={save}>
      <Notice kind={msg.kind || "success"}>{msg.text}</Notice>
      <div className="cm-form-grid">
        <Field id="pf-name" label="Name"><TextInput id="pf-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field id="pf-phone" label="Phone" optional><TextInput id="pf-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        {SOCIALS.map(([k, label]) => (
          <Field key={k} id={`pf-${k}`} label={label} optional><TextInput id={`pf-${k}`} value={f.social[k]} onChange={(e) => setF({ ...f, social: { ...f.social, [k]: e.target.value } })} /></Field>
        ))}
      </div>
      <PayoutFields value={f.payout} onChange={(payout) => setF({ ...f, payout })} />
      <button className="cm-btn cm-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
    </form>
  );
}

const DASH_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "promotion", label: "Promotion", icon: Megaphone },
  { id: "sales", label: "Sales", icon: ShoppingBag },
  { id: "earnings", label: "Earnings", icon: Receipt },
  { id: "payouts", label: "Payouts", icon: Wallet },
  { id: "profile", label: "Profile", icon: User },
];

function Dashboard({ d, reload }) {
  const [tab, setTab] = useState("overview");
  return (
    <SidebarLayout nav={<SideNav items={DASH_ITEMS} active={tab} onChange={setTab} label="Partner dashboard" />}>
      <h2 className="cm-h2">{DASH_ITEMS.find((i) => i.id === tab).label}</h2>
      {tab === "overview" && <Overview d={d} />}
      {tab === "promotion" && <Promotion d={d} />}
      {tab === "sales" && <Sales />}
      {tab === "earnings" && <Earnings />}
      {tab === "payouts" && <Payouts />}
      {tab === "profile" && <Profile d={d} reload={reload} />}
    </SidebarLayout>
  );
}

export default function Partner() {
  const { status, me, refresh } = usePartner();
  const dash = useLoad(() => (me && me.influencer ? api("/influencer/dashboard") : Promise.resolve(null)), [me && me.influencer && me.influencer.status]);

  if (status === "guest") {
    return (
      <Shell eyebrow="Creator Moves 365 partners" title={<>Earn by sharing the <span className="cm-gradient-text">Masterbook</span></>}>
        <section className="cm-card cm-narrow">
          <p className="cm-lead">Get your own tracked link and coupon code, see every click, sale and payout in one place, and get paid for each verified sale.</p>
          <div className="cm-actions">
            <Link className="cm-btn cm-btn-primary" to="/partner/auth?mode=signup">Apply now</Link>
            <Link className="cm-btn cm-btn-outline" to="/partner/auth">Partner sign in</Link>
          </div>
        </section>
      </Shell>
    );
  }
  if (status === "loading") return <Shell title="Partner area"><Loading /></Shell>;
  if (status === "error") return <Shell title="Partner area"><Notice>We could not load your account. Please refresh the page.</Notice></Shell>;
  if (!me) return <Navigate to="/partner/auth" replace />;

  const inf = me.influencer;
  return (
    <Shell eyebrow="Creator Moves 365 partners" title={inf && inf.status === "active" ? `Welcome, ${inf.name.split(" ")[0]}` : "Partner area"}>
      {!inf && <Apply me={me} onDone={refresh} />}
      {inf && inf.status !== "active" && <StatusCard status={inf.status} />}
      {inf && inf.status === "active" && (dash.loading ? <Loading /> : dash.error ? <Notice>{dash.error}</Notice> : dash.data && <Dashboard d={dash.data} reload={dash.reload} />)}
    </Shell>
  );
}

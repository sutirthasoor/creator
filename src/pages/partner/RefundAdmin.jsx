import { useState } from "react";
import { api, inr } from "../../lib/affiliateApi.js";
import { Field, TextInput } from "../../components/Field.jsx";
import { Badge, Notice, Loading, Table, useLoad, day } from "./ui.jsx";

// What approving this request will do to the partner's commission, in plain words.
function impact(r) {
  const c = r.commission;
  if (!c) return "No partner commission";
  if (!c.deductionPaise) return `${c.influencerCode}: nothing left to deduct`;
  return `${c.influencerCode}: −${inr(c.deductionPaise)} ${c.asClawback ? "(already paid out, taken off their next payout)" : "(taken off before payout)"}`;
}

export function Refunds() {
  const [status, setStatus] = useState("pending");
  const [panel, setPanel] = useState(null); // { id, mode: "approve" | "reject", text }
  const [msg, setMsg] = useState({ kind: "success", text: "" });
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useLoad(() => api(`/admin/refunds?status=${encodeURIComponent(status)}`), [status]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg({ kind: "success", text: "" });
    try {
      if (panel.mode === "approve") {
        await api(`/admin/refunds/${panel.id}/approve`, { method: "POST", body: { note: panel.text } });
        setMsg({ kind: "success", text: "Approved. Shopify is returning the money; the partner's commission is deducted as soon as Shopify confirms." });
      } else {
        await api(`/admin/refunds/${panel.id}/reject`, { method: "POST", body: { reason: panel.text } });
        setMsg({ kind: "success", text: "Request declined. The customer can see your reason." });
      }
      setPanel(null); reload();
    } catch (err) { setMsg({ kind: "error", text: err.message }); } finally { setBusy(false); }
  }

  const target = panel && data ? data.requests.find((r) => r.id === panel.id) : null;

  return (
    <>
      <div className="pt-toolbar">
        <Field id="rf-status" label="Status"><select id="rf-status" className="cm-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Waiting for a decision</option>
          <option value="approved">Approved (waiting for Shopify)</option>
          <option value="refunded">Refunded</option>
          <option value="rejected">Declined</option>
          <option value="">All</option>
        </select></Field>
      </div>
      <Notice kind={msg.kind}>{msg.text}</Notice>

      {panel && target && (
        <form className="cm-card cm-form cm-narrow" onSubmit={submit}>
          <h3 className="cm-card-title">{panel.mode === "approve" ? "Approve" : "Decline"} refund for {target.orderName}</h3>
          {panel.mode === "approve" ? (
            <p className="cm-muted">
              This returns {inr(target.amountPaise)} to the customer through Shopify and ends their access to the e-books. Partner commission: {impact(target)}.
            </p>
          ) : (
            <p className="cm-muted">The customer will see this reason. No money moves and the commission stays as it is.</p>
          )}
          <Field id="rf-note" label={panel.mode === "approve" ? "Note" : "Reason (required)"} optional={panel.mode === "approve"}>
            <TextInput id="rf-note" value={panel.text} onChange={(e) => setPanel({ ...panel, text: e.target.value })} required={panel.mode === "reject"} />
          </Field>
          <div className="cm-actions">
            <button className={`cm-btn ${panel.mode === "approve" ? "cm-btn-primary" : "cm-btn-outline"}`} disabled={busy}>
              {busy ? "Working…" : panel.mode === "approve" ? "Approve and refund" : "Decline request"}
            </button>
            <button type="button" className="cm-btn cm-btn-outline" disabled={busy} onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <Loading /> : error ? <Notice>{error}</Notice> : (
        <Table rows={data.requests} empty="No refund requests here." columns={[
          { key: "orderName", label: "Order" },
          { key: "requestedAt", label: "Requested", render: (r) => day(r.requestedAt) },
          { key: "email", label: "Customer" },
          { key: "amountPaise", label: "Amount", align: "right", render: (r) => inr(r.amountPaise) },
          { key: "reason", label: "Reason" },
          { key: "impact", label: "Partner commission", render: impact },
          { key: "status", label: "Status", render: (r) => <><Badge value={r.status} />{r.lastError && <span className="cm-flag" title={r.lastError}> ⚑ last attempt failed</span>}</> },
          { key: "act", label: "", render: (r) => (r.status === "pending" ? (
            <div className="cm-actions">
              <button className="cm-btn cm-btn-primary cm-btn-sm" onClick={() => setPanel({ id: r.id, mode: "approve", text: "" })}>Approve</button>
              <button className="cm-btn cm-btn-outline cm-btn-sm" onClick={() => setPanel({ id: r.id, mode: "reject", text: "" })}>Decline</button>
            </div>
          ) : (r.decisionNote || "–")) },
        ]} />
      )}
    </>
  );
}

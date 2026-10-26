import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { currentToken, listMyOrders, requestRefund } from "../lib/library.js";
import { formatDate } from "../lib/money.js";
import { Field } from "../components/Field.jsx";

const rupees = (paise) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: paise % 100 ? 2 : 0 }).format((paise || 0) / 100);

const STATUS_LABEL = {
  pending: "Refund under review",
  approving: "Refund being processed",
  approved: "Refund approved",
  refunded: "Refunded",
  rejected: "Refund declined",
};
const STATUS_HELP = {
  pending: "We will review your request and email you the outcome.",
  approving: "Your refund is being sent to your original payment method.",
  approved: "Your refund has been approved. It can take a few days to show on your statement.",
  refunded: "The money has been returned to your original payment method.",
};

// Lists the customer's own orders, lets them ask for a refund inside the refund window, and shows how each request is going.
export default function AccountRefunds() {
  const { status, token } = useAuth();
  const [state, setState] = useState({ loading: true, orders: [], error: "" });
  const [form, setForm] = useState(null); // { orderId, reason, busy, error }
  const [done, setDone] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await listMyOrders(await currentToken(token));
      setState({ loading: false, orders: data.orders, error: "" });
    } catch (e) {
      setState({ loading: false, orders: [], error: e.message });
    }
  }, [token]);

  useEffect(() => {
    if (status === "authed") load();
  }, [status, load]);

  async function submit(e) {
    e.preventDefault();
    setForm((f) => ({ ...f, busy: true, error: "" }));
    try {
      await requestRefund(await currentToken(token), form.orderId, form.reason);
      setForm(null);
      setDone("Your refund request was sent. We will review it and let you know.");
      await load();
    } catch (err) {
      setForm((f) => ({ ...f, busy: false, error: err.message }));
    }
  }

  return (
    <section className="cm-card cm-orders" aria-labelledby="refunds-title">
      <h2 id="refunds-title" className="cm-card-title"><RotateCcw size={18} aria-hidden="true" /> Refunds</h2>
      <p className="cm-muted">Changed your mind? You can ask for a refund on an order within the refund window. If it is approved, access to that order&apos;s e-books ends.</p>
      {done && <p className="cm-notice cm-notice-success" role="status">{done}</p>}
      {state.loading && <p className="cm-muted" aria-live="polite">Loading your orders…</p>}
      {state.error && <p className="cm-flag" role="alert">{state.error}</p>}
      {!state.loading && !state.error && state.orders.length === 0 && <p className="cm-muted">No orders to show yet.</p>}

      <ul className="cm-order-list">
        {state.orders.map((o) => (
          <li key={o.orderId}>
            <div>
              <strong>{o.name} · {rupees(o.totalPaise)}</strong>
              <span>{formatDate(o.paidAt)} · {o.items.join(", ")}</span>
              {o.request && STATUS_HELP[o.request.status] && <span>{STATUS_HELP[o.request.status]}</span>}
              {o.request && o.request.status === "rejected" && o.request.decisionNote && <span>Reason: {o.request.decisionNote}</span>}
              {!o.request && !o.refund.canRequest && <span>{o.refund.message}</span>}
              {!o.request && o.refund.canRequest && <span>You can ask for a refund until {formatDate(o.refund.deadline)}.</span>}
            </div>
            {o.request ? (
              <span className="cm-tag">{STATUS_LABEL[o.request.status] || o.request.status}</span>
            ) : o.refund.canRequest ? (
              <button type="button" className="cm-btn cm-btn-outline cm-btn-sm" onClick={() => { setDone(""); setForm({ orderId: o.orderId, reason: "", busy: false, error: "" }); }}>
                Request refund
              </button>
            ) : (
              <span className="cm-tag">{humanStatus(o.status)}</span>
            )}

            {form && form.orderId === o.orderId && (
              <form className="cm-form" style={{ gridColumn: "1 / -1" }} onSubmit={submit}>
                <Field id={`rf-${o.orderId}`} label="Why are you asking for a refund?" hint="A few words is fine. This goes to our team.">
                  <textarea
                    id={`rf-${o.orderId}`} className="cm-input cm-textarea" maxLength={500} required value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                </Field>
                {form.error && <p className="cm-flag" role="alert">{form.error}</p>}
                <div className="cm-actions">
                  <button className="cm-btn cm-btn-primary" disabled={form.busy || !form.reason.trim()}>{form.busy ? "Sending…" : "Send refund request"}</button>
                  <button type="button" className="cm-btn cm-btn-outline" disabled={form.busy} onClick={() => setForm(null)}>Cancel</button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function humanStatus(s) {
  return { refunded: "Refunded", partially_refunded: "Partly refunded", cancelled: "Cancelled", chargeback: "Disputed", paid: "Paid" }[s] || "Paid";
}

import { useState } from "react";
import { BookOpen, ArrowLeft, Plus } from "lucide-react";
import { api, inr } from "../../lib/affiliateApi.js";
import { Field, TextInput } from "../../components/Field.jsx";
import { Badge, Notice, Loading, Table, useLoad, day } from "./ui.jsx";

// Only `title` and `url` are persisted by the backend (server/src/library.js → setEbook).
// Everything else is shown for context but disabled, because there is no route that stores it.
const emptyForm = { productId: "", title: "", url: "" };

const fromDoc = (e) => ({
  productId: e.id || "",
  title: e.title || "",
  url: e.url || "",
});

function EbookEditor({ id, onBack, onSaved }) {
  const editing = Boolean(id);
  const { data, error, loading, reload } = useLoad(
    () => (editing ? Promise.resolve({ ebook: { id, ...(dataCache[id] || {}) } }) : Promise.resolve({ ebook: null })),
    [id],
  );
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ kind: "success", text: "" });
  const [busy, setBusy] = useState(false);

  if (editing && loading) return <Loading />;
  if (editing && error) return <Notice>{error}</Notice>;
  if (!form) {
    setForm(editing ? fromDoc(data.ebook) : { ...emptyForm });
    return <Loading />;
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    if (!/^\d{1,20}$/.test(form.productId.trim())) {
      setMsg({ kind: "error", text: "Product ID must be the numeric Shopify product ID." });
      return;
    }
    if (!form.url.trim()) {
      setMsg({ kind: "error", text: "Paste a Google Drive 'Anyone with the link' URL or an https link to the PDF." });
      return;
    }
    setBusy(true); setMsg({ kind: "success", text: "" });
    try {
      await api(`/admin/ebooks/${form.productId.trim()}`, {
        method: "PUT",
        body: { title: form.title.trim(), url: form.url.trim() },
      });
      setMsg({ kind: "success", text: editing ? "Saved." : "E-book created." });
      await reload();
      onSaved();
    } catch (err) {
      setMsg({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const disabledNote = "Stored by the backend only if you extend setEbook; not saved today.";

  return (
    <form className="cm-card cm-form" onSubmit={save}>
      <div className="pt-detail-head">
        <h2 className="cm-card-title">
          <BookOpen size={18} aria-hidden="true" /> {editing ? `Edit: ${form.title || form.productId}` : "New e-book"}
        </h2>
        <div className="cm-actions">
          {editing && <Badge value={form.url ? "published" : "draft"} />}
          <button type="button" className="cm-btn cm-btn-outline cm-btn-sm" onClick={onBack}>
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </button>
        </div>
      </div>
      <Notice kind={msg.kind}>{msg.text}</Notice>

      <h3 className="cm-h3">Identity</h3>
      <div className="cm-form-grid">
        <Field id="eb-productId" label="Shopify product ID" hint={editing ? "Locked once created." : "Numeric ID from the Shopify product URL."}>
          <TextInput id="eb-productId" value={form.productId} onChange={set("productId")} disabled={editing} required />
        </Field>
        <Field id="eb-title" label="Title">
          <TextInput id="eb-title" value={form.title} onChange={set("title")} required />
        </Field>
        <Field id="eb-subtitle" label="Subtitle" optional hint={disabledNote}>
          <TextInput id="eb-subtitle" value="" disabled placeholder="Not stored by the backend" />
        </Field>
        <Field id="eb-slug" label="Slug" optional hint={disabledNote}>
          <TextInput id="eb-slug" value="" disabled placeholder="Not stored by the backend" />
        </Field>
      </div>
      <Field id="eb-short" label="Short description" hint={disabledNote}>
        <textarea id="eb-short" className="cm-input cm-textarea" rows={3} disabled placeholder="Not stored by the backend" />
      </Field>
      <Field id="eb-long" label="Long description" hint={disabledNote}>
        <textarea id="eb-long" className="cm-input cm-textarea" rows={6} disabled placeholder="Not stored by the backend" />
      </Field>
      <div className="cm-form-grid">
        <Field id="eb-cover" label="Cover image URL" optional hint={disabledNote}>
          <TextInput id="eb-cover" value="" disabled placeholder="Not stored by the backend" />
        </Field>
        <Field id="eb-preview" label="Preview image URLs" optional hint={disabledNote}>
          <textarea id="eb-preview" className="cm-input cm-textarea" rows={3} disabled placeholder="Not stored by the backend" />
        </Field>
      </div>

      <h3 className="cm-h3">Reader file</h3>
      <Field
        id="eb-url"
        label="PDF link"
        hint="Google Drive 'Anyone with the link' URL, or any https URL to the PDF. This is the only field the reader actually uses."
      >
        <TextInput id="eb-url" value={form.url} onChange={set("url")} required placeholder="https://drive.google.com/file/d/…/view" />
      </Field>

      <h3 className="cm-h3">Commerce</h3>
      <div className="cm-form-grid">
        <Field id="eb-price" label="Selling price (₹)" hint={disabledNote}>
          <TextInput id="eb-price" disabled placeholder="Not stored by the backend" />
        </Field>
        <Field id="eb-compare" label="Original price (₹)" optional hint={disabledNote}>
          <TextInput id="eb-compare" disabled placeholder="Not stored by the backend" />
        </Field>
        <Field id="eb-start" label="Sale starts" optional hint={disabledNote}>
          <TextInput id="eb-start" type="date" disabled />
        </Field>
        <Field id="eb-end" label="Sale ends" optional hint={disabledNote}>
          <TextInput id="eb-end" type="date" disabled />
        </Field>
        <Field id="eb-status" label="Status" hint={disabledNote}>
          <select id="eb-status" className="cm-input" disabled>
            <option>draft</option>
          </select>
        </Field>
        <Field id="eb-order" label="Display order" hint={disabledNote}>
          <TextInput id="eb-order" disabled placeholder="Not stored by the backend" />
        </Field>
      </div>

      <h3 className="cm-h3">Affiliate</h3>
      <label className="cm-check"><input type="checkbox" disabled /> Eligible for affiliate commission</label>
      <div className="cm-form-grid">
        <Field id="eb-aff-type" label="Rate override type" optional hint={disabledNote}>
          <select id="eb-aff-type" className="cm-input" disabled><option>percent</option></select>
        </Field>
        <Field id="eb-aff-val" label="Rate override value" optional hint={disabledNote}>
          <TextInput id="eb-aff-val" disabled placeholder="Not stored by the backend" />
        </Field>
      </div>

      <h3 className="cm-h3">SEO</h3>
      <div className="cm-form-grid">
        <Field id="eb-seo-title" label="Meta title" optional hint={disabledNote}>
          <TextInput id="eb-seo-title" disabled placeholder="Not stored by the backend" />
        </Field>
        <Field id="eb-seo-desc" label="Meta description" optional hint={disabledNote}>
          <TextInput id="eb-seo-desc" disabled placeholder="Not stored by the backend" />
        </Field>
      </div>

      <label className="cm-check"><input type="checkbox" disabled /> Allow customers to print from the reader (Phase 2)</label>

      <div className="cm-actions">
        <button type="submit" className="cm-btn cm-btn-primary" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create e-book"}
        </button>
      </div>
    </form>
  );
}

function EbookList({ onOpen, onNew, onChanged }) {
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useLoad(() => api("/admin/ebooks"), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const rows = (data?.ebooks || []).filter((r) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return String(r.id || "").toLowerCase().includes(needle) || String(r.title || "").toLowerCase().includes(needle);
  });

  if (editing) return <EbookEditor id={editing.id} onBack={() => { setEditing(null); reload(); }} onSaved={() => reload()} />;
  if (adding) return <EbookEditor id={null} onBack={() => { setAdding(false); reload(); }} onSaved={() => reload()} />;

  return (
    <>
      <div className="pt-toolbar">
        <Field id="ebf-q" label="Search">
          <TextInput id="ebf-q" placeholder="Title or product ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <button className="cm-btn cm-btn-primary" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden="true" /> Add book
        </button>
      </div>
      {loading ? <Loading /> : error ? <Notice>{error}</Notice> : (
        <Table
          rows={rows}
          empty="No e-books yet. Add one to get started."
          onRow={(r) => setEditing(r)}
          columns={[
            { key: "title", label: "Title", render: (r) => <><strong>{r.title || "–"}</strong><br /><span className="cm-muted">{r.id}</span></> },
            { key: "status", label: "Status", render: (r) => <Badge value={r.url ? "published" : "draft"} /> },
            { key: "productId", label: "Shopify ID", render: (r) => r.id || "–" },
            { key: "link", label: "PDF link", render: (r) => (r.url ? "Set" : "Missing") },
            { key: "updated", label: "Updated", render: (r) => (r.updatedAt ? day(r.updatedAt) : "–") },
            {
              key: "actions", label: "", render: (r) => (
                <span className="cm-actions">
                  <button className="cm-btn cm-btn-outline cm-btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Edit</button>
                </span>
              ),
            },
          ]}
        />
      )}
    </>
  );
}

export function EbooksTab() {
  const [refreshKey, setRefreshKey] = useState(0);
  const onChanged = () => setRefreshKey((k) => k + 1);
  return <EbookList key={refreshKey} onOpen={() => {}} onNew={() => {}} onChanged={onChanged} />;
}
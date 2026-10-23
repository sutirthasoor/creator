import { useState } from "react";
import { BookOpen, ArrowLeft, Archive, Copy, Send, Eye } from "lucide-react";
import { api, inr } from "../../lib/affiliateApi.js";
import { Field, TextInput } from "../../components/Field.jsx";
import { Badge, Notice, Loading, Table, useLoad, day } from "./ui.jsx";

const emptyForm = {
  productId: "",
  title: "",
  subtitle: "",
  slug: "",
  shortDescription: "",
  longDescription: "",
  coverImageUrl: "",
  previewImageUrls: "",
  priceRupees: "",
  compareAtRupees: "",
  saleStartsAt: "",
  saleEndsAt: "",
  status: "draft",
  featured: false,
  displayOrder: 0,
  seoTitle: "",
  seoDescription: "",
  affiliateEligible: true,
  affiliateType: "percent",
  affiliateValue: "",
  readerPrintable: false,
};

const fromDoc = (e) => ({
  productId: e.productId || "",
  title: e.title || "",
  subtitle: e.subtitle || "",
  slug: e.slug || "",
  shortDescription: e.shortDescription || "",
  longDescription: e.longDescription || "",
  coverImageUrl: e.coverImageUrl || "",
  previewImageUrls: (e.previewImageUrls || []).join("\n"),
  priceRupees: e.pricePaise != null ? (e.pricePaise / 100).toString() : "",
  compareAtRupees: e.compareAtPricePaise != null ? (e.compareAtPricePaise / 100).toString() : "",
  saleStartsAt: e.saleStartsAt || "",
  saleEndsAt: e.saleEndsAt || "",
  status: e.status || "draft",
  featured: Boolean(e.featured),
  displayOrder: e.displayOrder || 0,
  seoTitle: e.seo?.title || "",
  seoDescription: e.seo?.description || "",
  affiliateEligible: e.affiliate?.eligible !== false,
  affiliateType: e.affiliate?.rateOverride?.type || "percent",
  affiliateValue: e.affiliate?.rateOverride
    ? (e.affiliate.rateOverride.type === "percent" ? e.affiliate.rateOverride.bps / 100 : e.affiliate.rateOverride.paise / 100).toString()
    : "",
  readerPrintable: Boolean(e.reader?.printable),
});

const toPayload = (f) => ({
  productId: f.productId.trim() || undefined,
  title: f.title.trim(),
  subtitle: f.subtitle.trim(),
  slug: f.slug.trim() || undefined,
  shortDescription: f.shortDescription.trim(),
  longDescription: f.longDescription,
  coverImageUrl: f.coverImageUrl.trim(),
  previewImageUrls: f.previewImageUrls.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
  pricePaise: f.priceRupees === "" ? null : Math.round(Number(f.priceRupees) * 100),
  compareAtPricePaise: f.compareAtRupees === "" ? null : Math.round(Number(f.compareAtRupees) * 100),
  saleStartsAt: f.saleStartsAt || null,
  saleEndsAt: f.saleEndsAt || null,
  status: f.status,
  featured: f.featured,
  displayOrder: Number(f.displayOrder) || 0,
  seo: { title: f.seoTitle.trim(), description: f.seoDescription.trim() },
  affiliate: {
    eligible: f.affiliateEligible,
    rateOverride: f.affiliateValue === "" ? null : { type: f.affiliateType, value: Number(f.affiliateValue) },
  },
  reader: { printable: f.readerPrintable },
});

function EbookEditor({ id, onBack, onSaved }) {
  const editing = Boolean(id);
  const { data, error, loading, reload } = useLoad(
    () => (editing ? api(`/admin/ebooks/${id}`) : Promise.resolve({ ebook: null })),
    [id],
  );
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ kind: "success", text: "" });
  const [busy, setBusy] = useState(false);

  if (editing && loading) return <Loading />;
  if (editing && error) return <Notice>{error}</Notice>;
  if (!form) {
    setForm(data && data.ebook ? fromDoc(data.ebook) : { ...emptyForm });
    return <Loading />;
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg({ kind: "success", text: "" });
    try {
      if (editing) await api(`/admin/ebooks/${id}`, { method: "PUT", body: toPayload(form) });
      else await api("/admin/ebooks", { method: "POST", body: toPayload(form) });
      setMsg({ kind: "success", text: editing ? "Saved." : "E-book created." });
      await reload();
      onSaved();
    } catch (err) { setMsg({ kind: "error", text: err.message }); } finally { setBusy(false); }
  }

  async function lifecycle(action) {
    if (!editing) return;
    setBusy(true); setMsg({ kind: "success", text: "" });
    try {
      await api(`/admin/ebooks/${id}/${action}`, { method: "POST" });
      setMsg({ kind: "success", text: `${action} done.` });
      await reload();
      onSaved();
    } catch (err) { setMsg({ kind: "error", text: err.message }); } finally { setBusy(false); }
  }

  return (
    <form className="cm-card cm-form" onSubmit={save}>
      <div className="pt-detail-head">
        <h2 className="cm-card-title"><BookOpen size={18} aria-hidden="true" /> {editing ? `Edit: ${form.title}` : "New e-book"}</h2>
        <div className="cm-actions">
          {editing && <Badge value={form.status} />}
          <button type="button" className="cm-btn cm-btn-outline cm-btn-sm" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Back</button>
        </div>
      </div>
      <Notice kind={msg.kind}>{msg.text}</Notice>

      <h3 className="cm-h3">Identity</h3>
      <div className="cm-form-grid">
        <Field id="eb-productId" label="Shopify product ID" hint={editing ? "Locked once created." : "Leave blank to create a new product in Shopify (if configured)."}>
          <TextInput id="eb-productId" value={form.productId} onChange={set("productId")} disabled={editing} />
        </Field>
        <Field id="eb-title" label="Title"><TextInput id="eb-title" value={form.title} onChange={set("title")} required /></Field>
        <Field id="eb-subtitle" label="Subtitle" optional><TextInput id="eb-subtitle" value={form.subtitle} onChange={set("subtitle")} /></Field>
        <Field id="eb-slug" label="Slug" optional hint="Auto-generated from the title if blank."><TextInput id="eb-slug" value={form.slug} onChange={set("slug")} /></Field>
      </div>
      <Field id="eb-short" label="Short description"><textarea id="eb-short" className="cm-input cm-textarea" rows={3} value={form.shortDescription} onChange={set("shortDescription")} maxLength={500} /></Field>
      <Field id="eb-long" label="Long description"><textarea id="eb-long" className="cm-input cm-textarea" rows={6} value={form.longDescription} onChange={set("longDescription")} /></Field>
      <div className="cm-form-grid">
        <Field id="eb-cover" label="Cover image URL" optional><TextInput id="eb-cover" value={form.coverImageUrl} onChange={set("coverImageUrl")} /></Field>
        <Field id="eb-preview" label="Preview image URLs (one per line)" optional><textarea id="eb-preview" className="cm-input cm-textarea" rows={3} value={form.previewImageUrls} onChange={set("previewImageUrls")} /></Field>
      </div>

      <h3 className="cm-h3">Commerce</h3>
      <div className="cm-form-grid">
        <Field id="eb-price" label="Selling price (₹)"><TextInput id="eb-price" inputMode="decimal" value={form.priceRupees} onChange={set("priceRupees")} /></Field>
        <Field id="eb-compare" label="Original price (₹)" optional><TextInput id="eb-compare" inputMode="decimal" value={form.compareAtRupees} onChange={set("compareAtRupees")} /></Field>
        <Field id="eb-start" label="Sale starts" optional><TextInput id="eb-start" type="date" value={form.saleStartsAt ? form.saleStartsAt.slice(0, 10) : ""} onChange={(e) => setForm((f) => ({ ...f, saleStartsAt: e.target.value ? `${e.target.value}T00:00:00.000Z` : "" }))} /></Field>
        <Field id="eb-end" label="Sale ends" optional><TextInput id="eb-end" type="date" value={form.saleEndsAt ? form.saleEndsAt.slice(0, 10) : ""} onChange={(e) => setForm((f) => ({ ...f, saleEndsAt: e.target.value ? `${e.target.value}T23:59:59.999Z` : "" }))} /></Field>
        <Field id="eb-status" label="Status">
          <select id="eb-status" className="cm-input" value={form.status} onChange={set("status")}>
            {["draft", "scheduled", "published", "unpublished", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field id="eb-order" label="Display order"><TextInput id="eb-order" inputMode="numeric" value={form.displayOrder} onChange={set("displayOrder")} /></Field>
      </div>
      <label className="cm-check"><input type="checkbox" checked={form.featured} onChange={set("featured")} /> Feature on the catalog</label>

      <h3 className="cm-h3">Affiliate</h3>
      <label className="cm-check"><input type="checkbox" checked={form.affiliateEligible} onChange={set("affiliateEligible")} /> Eligible for affiliate commission</label>
      <div className="cm-form-grid">
        <Field id="eb-aff-type" label="Rate override type" optional>
          <select id="eb-aff-type" className="cm-input" value={form.affiliateType} onChange={set("affiliateType")}>
            <option value="percent">Percent</option>
            <option value="fixed">Fixed ₹ per unit</option>
          </select>
        </Field>
        <Field id="eb-aff-val" label="Rate override value" optional hint="Leave blank to use the global default."><TextInput id="eb-aff-val" inputMode="decimal" value={form.affiliateValue} onChange={set("affiliateValue")} /></Field>
      </div>

      <h3 className="cm-h3">SEO</h3>
      <div className="cm-form-grid">
        <Field id="eb-seo-title" label="Meta title" optional><TextInput id="eb-seo-title" value={form.seoTitle} onChange={set("seoTitle")} /></Field>
        <Field id="eb-seo-desc" label="Meta description" optional><TextInput id="eb-seo-desc" value={form.seoDescription} onChange={set("seoDescription")} /></Field>
      </div>

      <label className="cm-check"><input type="checkbox" checked={form.readerPrintable} onChange={set("readerPrintable")} /> Allow customers to print from the reader (Phase 2)</label>

      <div className="cm-actions">
        <button type="submit" className="cm-btn cm-btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create e-book"}</button>
        {editing && form.status !== "published" && <button type="button" className="cm-btn cm-btn-outline" disabled={busy} onClick={() => lifecycle("publish")}><Send size={15} aria-hidden="true" /> Publish</button>}
        {editing && form.status === "published" && <button type="button" className="cm-btn cm-btn-outline" disabled={busy} onClick={() => lifecycle("unpublish")}><Eye size={15} aria-hidden="true" /> Unpublish</button>}
        {editing && <button type="button" className="cm-btn cm-btn-outline" disabled={busy} onClick={() => lifecycle("duplicate")}><Copy size={15} aria-hidden="true" /> Duplicate</button>}
        {editing && form.status !== "archived" && <button type="button" className="cm-btn cm-btn-outline" disabled={busy} onClick={() => lifecycle("archive")}><Archive size={15} aria-hidden="true" /> Archive</button>}
      </div>
    </form>
  );
}

function EbookList({ onOpen, onNew, onChanged }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useLoad(
    () => api(`/admin/ebooks?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`),
    [status, q],
  );
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState({ kind: "success", text: "" });

  async function act(productId, action) {
    setBusy(productId); setMsg({ kind: "success", text: "" });
    try {
      await api(`/admin/ebooks/${productId}/${action}`, { method: "POST" });
      setMsg({ kind: "success", text: `${action} done.` });
      reload(); onChanged();
    } catch (e) { setMsg({ kind: "error", text: e.message }); } finally { setBusy(null); }
  }

  const price = (r) => (r.pricePaise != null ? inr(r.pricePaise) : "–");

  return (
    <>
      <div className="pt-toolbar">
        <Field id="ebf-status" label="Status">
          <select id="ebf-status" className="cm-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {["draft", "scheduled", "published", "unpublished", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field id="ebf-q" label="Search"><TextInput id="ebf-q" placeholder="Title, slug or product ID" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <button className="cm-btn cm-btn-primary" onClick={onNew}>New e-book</button>
      </div>
      <Notice kind={msg.kind}>{msg.text}</Notice>
      {loading ? <Loading /> : error ? <Notice>{error}</Notice> : (
        <Table
          rows={data.ebooks}
          empty="No e-books yet. Create one to start."
          onRow={(r) => onOpen(r.id)}
          columns={[
            { key: "title", label: "Title", render: (r) => <><strong>{r.title}</strong><br /><span className="cm-muted">{r.slug}</span></> },
            { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
            { key: "productId", label: "Shopify ID", render: (r) => r.productId || "–" },
            { key: "price", label: "Price", align: "right", render: price },
            { key: "compare", label: "Original", align: "right", render: (r) => (r.compareAtPricePaise != null ? inr(r.compareAtPricePaise) : "–") },
            { key: "eligible", label: "Affiliate", render: (r) => (r.affiliate?.eligible === false ? "No" : "Yes") },
            { key: "updated", label: "Updated", render: (r) => day(r.updatedAt) },
            {
              key: "actions", label: "", render: (r) => (
                <span className="cm-actions">
                  {r.status !== "published" && <button className="cm-btn cm-btn-outline cm-btn-sm" disabled={busy === r.id} onClick={(e) => { e.stopPropagation(); act(r.id, "publish"); }}>Publish</button>}
                  {r.status === "published" && <button className="cm-btn cm-btn-outline cm-btn-sm" disabled={busy === r.id} onClick={(e) => { e.stopPropagation(); act(r.id, "unpublish"); }}>Unpublish</button>}
                  {r.status !== "archived" && <button className="cm-btn cm-btn-outline cm-btn-sm" disabled={busy === r.id} onClick={(e) => { e.stopPropagation(); act(r.id, "archive"); }}>Archive</button>}
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
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const onChanged = () => setRefreshKey((k) => k + 1);
  const back = () => { setOpenId(null); setCreating(false); onChanged(); };
  if (openId) return <EbookEditor key={`${openId}-${refreshKey}`} id={openId} onBack={back} onSaved={onChanged} />;
  if (creating) return <EbookEditor key={`new-${refreshKey}`} id={null} onBack={back} onSaved={onChanged} />;
  return <EbookList key={refreshKey} onOpen={(id) => setOpenId(id)} onNew={() => setCreating(true)} onChanged={onChanged} />;
}
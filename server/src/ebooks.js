// E-book catalog + CMS. An e-book = a Shopify product (commerce source of truth)
// + this Firestore doc (catalog source of truth: content, pricing display, publishing,
// SEO, reader chapters, affiliate eligibility).
//
// Collection: ebooks/{productId}   (productId = Shopify product ID as a string)
import { bad, notFound, nowIso, str, normalizeRate } from "./util.js";

const STATUSES = ["draft", "scheduled", "published", "unpublished", "archived"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const audit = (tx, admin, action, entity, details, now) =>
  tx.add("audit", { at: now, by: admin.email || admin.uid, byUid: admin.uid, action, entity, details });

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function uniqueSlug(store, desired, currentId) {
  const base = slugify(desired) || "ebook";
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i}`;
    const [clash] = await store.query("ebooks", { where: [["slug", "==", candidate]], limit: 1 });
    if (!clash || clash.id === currentId) return candidate;
  }
  throw bad("Could not generate a unique slug for this e-book.");
}

function validateChapters(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((c, i) => ({
      id: str(c.id, { max: 40 }) || `ch-${i + 1}`,
      title: str(c.title, { required: true, max: 200, name: "Chapter title" }),
      bodyMarkdown: typeof c.bodyMarkdown === "string" ? c.bodyMarkdown.slice(0, 200_000) : "",
      order: Number.isInteger(c.order) ? c.order : i,
    }))
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ ...c, order: i }));
}

// `current` is `null` on create and an object on update. Handle both.
function validatePricing(input, current) {
  const cur = current || {};
  const pricePaise =
    input.pricePaise !== undefined ? Number(input.pricePaise)
      : cur.pricePaise !== undefined ? cur.pricePaise
        : null;
  if (pricePaise !== null && (!Number.isInteger(pricePaise) || pricePaise < 0)) {
    throw bad("Price must be a non-negative integer number of paise.");
  }
  let compareAtPricePaise = cur.compareAtPricePaise ?? null;
  if (input.compareAtPricePaise !== undefined) {
    compareAtPricePaise = input.compareAtPricePaise === null ? null : Number(input.compareAtPricePaise);
    if (compareAtPricePaise !== null && (!Number.isInteger(compareAtPricePaise) || compareAtPricePaise < 0)) {
      throw bad("Compare-at price must be a non-negative integer number of paise.");
    }
  }
  const currency = str(input.currency, { max: 3 }).toUpperCase() || cur.currency || "INR";
  return { pricePaise, compareAtPricePaise, currency };
}

// Same defensive default for affiliate: `current` may be null on create.
function validateAffiliate(input, current) {
  const cur = current || {};
  const eligible = input.eligible !== undefined ? Boolean(input.eligible) : (cur.eligible ?? true);
  let rateOverride = cur.rateOverride ?? null;
  if (input.rateOverride !== undefined) {
    rateOverride = input.rateOverride === null ? null : normalizeRate(input.rateOverride, "Affiliate rate override");
  }
  return { eligible, rateOverride };
}

export function buildEbookDoc({ input, current, productId, admin, now }) {
  const cur = current || null; // keep null-ness for slug / status / createdAt branches
  const title = str(input.title ?? cur?.title, { required: true, max: 200, name: "Title" });
  const slug = input.slug !== undefined || !cur
    ? (input.slug ? slugify(input.slug) : slugify(title))
    : cur.slug;
  if (!SLUG_RE.test(slug)) throw bad("Slug must contain letters, numbers and hyphens only.");

  const status = input.status ?? cur?.status ?? "draft";
  if (!STATUSES.includes(status)) throw bad(`Status must be one of: ${STATUSES.join(", ")}.`);

  const saleStartsAt = input.saleStartsAt !== undefined ? str(input.saleStartsAt, { max: 40 }) || null : cur?.saleStartsAt ?? null;
  const saleEndsAt = input.saleEndsAt !== undefined ? str(input.saleEndsAt, { max: 40 }) || null : cur?.saleEndsAt ?? null;
  if (saleStartsAt && saleEndsAt && Date.parse(saleStartsAt) >= Date.parse(saleEndsAt)) {
    throw bad("Sale end must be after sale start.");
  }

  return {
    productId: String(productId),
    title,
    subtitle: str(input.subtitle ?? cur?.subtitle, { max: 300 }),
    slug,
    shortDescription: str(input.shortDescription ?? cur?.shortDescription, { max: 500 }),
    longDescription: (input.longDescription ?? cur?.longDescription ?? "").toString().slice(0, 20_000),
    coverImageUrl: str(input.coverImageUrl ?? cur?.coverImageUrl, { max: 500 }),
    previewImageUrls: Array.isArray(input.previewImageUrls)
      ? input.previewImageUrls.map((u) => str(u, { max: 500 })).filter(Boolean).slice(0, 20)
      : (cur?.previewImageUrls || []),
    ...validatePricing(input, cur),
    saleStartsAt,
    saleEndsAt,
    status,
    featured: input.featured !== undefined ? Boolean(input.featured) : (cur?.featured ?? false),
    displayOrder: Number.isInteger(input.displayOrder) ? input.displayOrder : (cur?.displayOrder ?? 0),
    seo: {
      title: str(input.seo?.title ?? cur?.seo?.title, { max: 200 }),
      description: str(input.seo?.description ?? cur?.seo?.description, { max: 500 }),
      imageUrl: str(input.seo?.imageUrl ?? cur?.seo?.imageUrl, { max: 500 }),
      canonicalPath: str(input.seo?.canonicalPath ?? cur?.seo?.canonicalPath, { max: 200 }),
    },
    affiliate: validateAffiliate(input.affiliate || {}, cur?.affiliate || {}),
    reader: {
      chapters: input.reader?.chapters !== undefined ? validateChapters(input.reader.chapters) : (cur?.reader?.chapters || []),
      printable: input.reader?.printable !== undefined ? Boolean(input.reader.printable) : (cur?.reader?.printable ?? false),
    },
    shopify: input.shopify ?? cur?.shopify ?? null,
    createdAt: cur?.createdAt || now,
    createdBy: cur?.createdBy || (admin.email || admin.uid),
    updatedAt: now,
    updatedBy: admin.email || admin.uid,
  };
}

export async function createEbook(store, input, admin, { shopify, now = nowIso() } = {}) {
  const baseSlug = await uniqueSlug(store, input.slug || input.title);
  const productId = str(input.productId, { max: 60 });
  if (productId) {
    const existing = await store.get("ebooks", productId);
    if (existing) throw bad("An e-book with that Shopify product ID already exists.");
  }
  let resolvedProductId = productId;
  let shopifyRef = null;
  if (!resolvedProductId && shopify && shopify.enabled && typeof shopify.productCreate === "function") {
    const created = await shopify.productCreate({
      title: input.title,
      descriptionHtml: input.shortDescription || "",
      pricePaise: input.pricePaise ?? 0,
      compareAtPricePaise: input.compareAtPricePaise ?? null,
      imageUrl: input.coverImageUrl || null,
    });
    resolvedProductId = String(created.id);
    shopifyRef = { id: created.id, handle: created.handle || null, syncedAt: now };
  }
  if (!resolvedProductId) {
    throw bad("A Shopify product ID is required when Shopify is not configured.");
  }
  const doc = buildEbookDoc({
    input: { ...input, slug: baseSlug },
    current: null,
    productId: resolvedProductId,
    admin,
    now,
  });
  doc.shopify = shopifyRef;
  await store.transaction(async (tx) => {
    tx.set("ebooks", resolvedProductId, doc);
    audit(tx, admin, "ebook_created", `ebooks/${resolvedProductId}`, { title: doc.title, status: doc.status }, now);
  });
  return doc;
}

export async function updateEbook(store, productId, input, admin, { now = nowIso() } = {}) {
  const id = String(productId);
  const cur = await store.get("ebooks", id);
  if (!cur) throw notFound("E-book not found.");
  const next = buildEbookDoc({ input, current: cur, productId: id, admin, now });
  if (next.slug !== cur.slug) next.slug = await uniqueSlug(store, next.slug, id);
  await store.transaction(async (tx) => {
    tx.set("ebooks", id, next);
    audit(tx, admin, "ebook_updated", `ebooks/${id}`, {
      before: { title: cur.title, status: cur.status, pricePaise: cur.pricePaise },
      after: { title: next.title, status: next.status, pricePaise: next.pricePaise },
    }, now);
  });
  return next;
}

export async function setEbookStatus(store, productId, status, admin, { now = nowIso() } = {}) {
  if (!STATUSES.includes(status)) throw bad("Unknown status.");
  const id = String(productId);
  const cur = await store.get("ebooks", id);
  if (!cur) throw notFound("E-book not found.");
  if (cur.status === status) return cur;
  const next = { ...cur, status, updatedAt: now, updatedBy: admin.email || admin.uid };
  await store.transaction(async (tx) => {
    tx.set("ebooks", id, next);
    audit(tx, admin, `ebook_${status}`, `ebooks/${id}`, { from: cur.status, to: status }, now);
  });
  return next;
}

export async function archiveEbook(store, productId, admin, { now = nowIso() } = {}) {
  const id = String(productId);
  const cur = await store.get("ebooks", id);
  if (!cur) throw notFound("E-book not found.");
  const earned = await store.query("commissions", { where: [["productIds", "array-contains", id]], limit: 1 });
  if (earned.length) return setEbookStatus(store, id, "archived", admin, { now });
  await store.transaction(async (tx) => {
    tx.set("ebooks", id, { ...cur, status: "archived", updatedAt: now, updatedBy: admin.email || admin.uid });
    audit(tx, admin, "ebook_archived", `ebooks/${id}`, { title: cur.title }, now);
  });
  return { ...cur, status: "archived" };
}

export async function duplicateEbook(store, productId, admin, { shopify, now = nowIso() } = {}) {
  const id = String(productId);
  const cur = await store.get("ebooks", id);
  if (!cur) throw notFound("E-book not found.");
  const copy = {
    ...cur,
    title: `${cur.title} (copy)`,
    slug: await uniqueSlug(store, `${cur.slug}-copy`),
    status: "draft",
    productId: undefined,
    shopify: null,
    createdAt: now,
    createdBy: admin.email || admin.uid,
    updatedAt: now,
    updatedBy: admin.email || admin.uid,
  };
  return createEbook(store, copy, admin, { shopify, now });
}

export async function getEbook(store, productId) {
  const doc = await store.get("ebooks", String(productId));
  if (!doc) throw notFound("E-book not found.");
  return doc;
}

export async function listEbooksAdmin(store, query = {}) {
  const where = [];
  if (query.status) where.push(["status", "==", query.status]);
  let rows = await store.query("ebooks", { where, orderBy: ["updatedAt", "desc"], limit: 500 });
  const q = (query.q || "").toLowerCase();
  if (q) rows = rows.filter((r) => [r.title, r.slug, r.productId].some((v) => String(v || "").toLowerCase().includes(q)));
  return rows;
}

export async function listPublicEbooks(store, { now = nowIso() } = {}) {
  const rows = await store.query("ebooks", { where: [["status", "==", "published"]], orderBy: ["displayOrder", "asc"], limit: 500 });
  const t = Date.parse(now);
  return rows
    .filter((r) => {
      if (r.saleStartsAt && Date.parse(r.saleStartsAt) > t) return false;
      if (r.saleEndsAt && Date.parse(r.saleEndsAt) <= t) return false;
      return true;
    })
    .map((r) => ({
      productId: r.productId,
      title: r.title,
      subtitle: r.subtitle,
      slug: r.slug,
      shortDescription: r.shortDescription,
      longDescription: r.longDescription,
      coverImageUrl: r.coverImageUrl,
      previewImageUrls: r.previewImageUrls,
      pricePaise: r.pricePaise,
      compareAtPricePaise: r.compareAtPricePaise,
      currency: r.currency,
      featured: r.featured,
      seo: r.seo,
    }));
}

export async function getPublicEbookBySlug(store, slug, { now = nowIso() } = {}) {
  const [doc] = await store.query("ebooks", { where: [["slug", "==", String(slug)], ["status", "==", "published"]], limit: 1 });
  if (!doc) throw notFound("E-book not found.");
  const t = Date.parse(now);
  if (doc.saleStartsAt && Date.parse(doc.saleStartsAt) > t) throw notFound("E-book not found.");
  if (doc.saleEndsAt && Date.parse(doc.saleEndsAt) <= t) throw notFound("E-book not found.");
  const { reader, affiliate, ...publicDoc } = doc;
  return publicDoc;
}
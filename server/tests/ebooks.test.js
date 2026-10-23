import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../src/store.memory.js";
import {
  createEbook, updateEbook, setEbookStatus, archiveEbook, duplicateEbook,
  getEbook, listEbooksAdmin, listPublicEbooks, getPublicEbookBySlug,
} from "../src/ebooks.js";
import { handleOrderPaid } from "../src/orders.js";
import { signToken } from "../src/token.js";

const SECRET = "test-attribution-secret";
const admin = { uid: "a1", email: "admin@aa100xtech.com" };
const T0 = "2026-10-01T10:00:00.000Z";

async function activeInfluencer(store) {
  await store.set("influencers", "u1", {
    uid: "u1", email: "riya@example.com", name: "Riya", status: "active", code: "RIYA1234", couponCode: "RIYA10",
    commissionOverride: null, payout: { method: "upi", upi: "riya@upi" }, createdAt: T0, history: [],
  });
}

const minimal = {
  title: "Test E-book",
  shortDescription: "A short description",
  pricePaise: 210000,
  compareAtPricePaise: 2100000,
  status: "draft",
};

test("createEbook: validates, slugifies, defaults, and stays in draft until published", async () => {
  const store = createMemoryStore();
  const doc = await createEbook(store, { ...minimal, productId: "999" }, admin, { now: T0 });
  assert.equal(doc.productId, "999");
  assert.equal(doc.slug, "test-e-book");
  assert.equal(doc.status, "draft");
  assert.equal(doc.affiliate.eligible, true);
  assert.equal(doc.reader.chapters.length, 0);
  assert.equal((await listPublicEbooks(store, { now: T0 })).length, 0);
});

test("createEbook: duplicate productId is rejected", async () => {
  const store = createMemoryStore();
  await createEbook(store, { ...minimal, productId: "1" }, admin, { now: T0 });
  await assert.rejects(createEbook(store, { ...minimal, productId: "1" }, admin, { now: T0 }), /already exists/);
});

test("publish + public catalog filter by sale window", async () => {
  const store = createMemoryStore();
  await createEbook(store, { ...minimal, productId: "1", slug: "one" }, admin, { now: T0 });
  await setEbookStatus(store, "1", "published", admin, { now: T0 });
  assert.equal((await listPublicEbooks(store, { now: T0 })).length, 1);
  await updateEbook(store, "1", { saleEndsAt: "2026-10-02T00:00:00.000Z" }, admin, { now: T0 });
  assert.equal((await listPublicEbooks(store, { now: "2026-10-03T00:00:00.000Z" })).length, 0);
});

test("unpublish and archive remove from public catalog but keep the doc", async () => {
  const store = createMemoryStore();
  await createEbook(store, { ...minimal, productId: "1", slug: "one" }, admin, { now: T0 });
  await setEbookStatus(store, "1", "published", admin, { now: T0 });
  await setEbookStatus(store, "1", "unpublished", admin, { now: T0 });
  assert.equal((await listPublicEbooks(store, { now: T0 })).length, 0);
  assert.ok(await store.get("ebooks", "1"));
});

test("archive refuses delete when the e-book has earned a commission (keeps the doc)", async () => {
  const store = createMemoryStore();
  await activeInfluencer(store);
  await createEbook(store, { ...minimal, productId: "555", slug: "one" }, admin, { now: T0 });
  await setEbookStatus(store, "555", "published", admin, { now: T0 });
  const token = signToken({ i: "u1", c: "click1", t: Date.parse(T0), x: Date.parse(T0) + 30 * 86400000 }, SECRET);
  const order = {
    id: 100, name: "#100", email: "buyer@example.com", currency: "INR", created_at: T0, taxes_included: false,
    total_line_items_price: "2100.00", total_discounts: "0.00", subtotal_price: "2100.00",
    total_price: "2100.00", total_tax: "0.00",
    discount_codes: [], note_attributes: [{ name: "cm_ref", value: token }],
    line_items: [{ id: 1000, product_id: 555, title: "Masterbook", quantity: 1, price: "2100.00", total_discount: "0.00", tax_lines: [] }],
  };
  await handleOrderPaid(store, { order, webhookId: "wh-1", secret: SECRET, now: T0 });
  const archived = await archiveEbook(store, "555", admin, { now: T0 });
  assert.equal(archived.status, "archived");
  assert.ok(await store.get("ebooks", "555"));
});

test("duplicateEbook: new slug, draft status, distinct product", async () => {
  const store = createMemoryStore();
  await createEbook(store, { ...minimal, productId: "1", slug: "one" }, admin, { now: T0 });
  const copy = await duplicateEbook(store, "1", admin, { now: T0 });
  assert.notEqual(copy.productId, "1");
  assert.equal(copy.status, "draft");
  assert.equal(copy.slug, "one-copy");
});

test("getPublicEbookBySlug strips reader and affiliate internals", async () => {
  const store = createMemoryStore();
  await createEbook(store, {
    ...minimal, productId: "1", slug: "one",
    reader: { chapters: [{ id: "c1", title: "Intro", bodyMarkdown: "hello", order: 0 }] },
    affiliate: { eligible: true, rateOverride: { type: "percent", value: 20 } },
  }, admin, { now: T0 });
  await setEbookStatus(store, "1", "published", admin, { now: T0 });
  const pub = await getPublicEbookBySlug(store, "one", { now: T0 });
  assert.equal(pub.slug, "one");
  assert.equal(pub.reader, undefined);
  assert.equal(pub.affiliate, undefined);
});

test("listEbooksAdmin: filters by status and q", async () => {
  const store = createMemoryStore();
  await createEbook(store, { ...minimal, productId: "1", title: "Alpha", slug: "alpha" }, admin, { now: T0 });
  await createEbook(store, { ...minimal, productId: "2", title: "Beta", slug: "beta" }, admin, { now: T0 });
  await setEbookStatus(store, "2", "published", admin, { now: T0 });
  const drafts = await listEbooksAdmin(store, { status: "draft" });
  assert.equal(drafts.length, 1);
  const beta = await listEbooksAdmin(store, { q: "beta" });
  assert.equal(beta.length, 1);
  assert.equal(beta[0].title, "Beta");
});
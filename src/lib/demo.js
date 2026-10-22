// Sample catalogue + local cart, used ONLY while Shopify is not configured, so the
// Products, Product Detail and Cart pages can be reviewed before credentials exist.
// It exposes the same functions as shopify.js. Nothing here talks to a server.

const m = (n) => ({ amount: String(n), currencyCode: "INR" });

const COVER = { url: "/assets/masterbook-cover-art-DzA6LFXW.jpg", altText: "Masterbook cover", width: 1024, height: 1536 };
const STILL = { url: "/assets/masterbook-still-FUiOujKq.jpg", altText: "Masterbook preview", width: 1024, height: 768 };

function make({ handle, title, description, price, compare, images = [], tags = [], productType = "E-book", createdAt }) {
  const variant = {
    id: `demo-variant-${handle}`,
    title: "Default Title",
    availableForSale: true,
    price: m(price),
    compareAtPrice: compare ? m(compare) : null,
    selectedOptions: [{ name: "Title", value: "Default Title" }],
    image: images[0] || null,
  };
  return {
    id: `demo-product-${handle}`,
    handle,
    title,
    vendor: "Creator Moves 365",
    productType,
    tags,
    availableForSale: true,
    description,
    image: images[0] || null,
    images,
    options: [{ name: "Title", values: ["Default Title"] }],
    variants: [variant],
    price: m(price),
    maxPrice: m(price),
    compareAtPrice: compare ? m(compare) : null,
    seo: null,
    createdAt,
  };
}

const SAMPLE_NOTE =
  "Placeholder product shown only while Shopify is not connected. Add your Storefront credentials to see your real catalogue.";

export const SAMPLE_PRODUCTS = [
  make({
    handle: "the-top-secret-content-collection-book-of-the-viral-influencers",
    title: "The Top Secret Content Collection Book Of The Viral Influencers",
    description:
      "Learn how standout creators turn ideas into stronger content, publish with more consistency, and build a recognisable presence without copying someone else’s personality.\n\nNine chapters, five case studies and twelve studio prompts, with creative notes and image-to-video directions.\n\nOne-time purchase. Access opens in a private reader after verified payment.",
    price: 2100,
    compare: 21000,
    images: [COVER, STILL],
    tags: ["masterbook", "e-book"],
    createdAt: "2026-01-01",
  }),
  make({ handle: "sample-ebook-one", title: "Sample e-book One (demo)", description: SAMPLE_NOTE, price: 999, images: [], tags: ["demo"], createdAt: "2026-02-01" }),
  make({ handle: "sample-ebook-two", title: "Sample e-book Two (demo)", description: SAMPLE_NOTE, price: 1499, compare: 1999, images: [], tags: ["demo"], createdAt: "2026-03-01" }),
];

const wait = () => new Promise((r) => setTimeout(r, 120));
const abortable = (signal) => {
  if (signal && signal.aborted) throw new DOMException("Aborted", "AbortError");
};

export async function listProducts({ first = 12, after = null, query = "", sort = "BEST_SELLING", reverse = false, signal } = {}) {
  await wait();
  abortable(signal);
  let list = SAMPLE_PRODUCTS.slice();
  const q = query.trim().toLowerCase();
  if (q) list = list.filter((p) => `${p.title} ${p.tags.join(" ")}`.toLowerCase().includes(q));
  const cmp = {
    CREATED_AT: (a, b) => a.createdAt.localeCompare(b.createdAt),
    PRICE: (a, b) => Number(a.price.amount) - Number(b.price.amount),
    TITLE: (a, b) => a.title.localeCompare(b.title),
  }[sort];
  if (cmp) list.sort(cmp);
  if (reverse) list.reverse();
  const start = after ? Number(after) : 0;
  const page = list.slice(start, start + first);
  const end = start + page.length;
  return { products: page, pageInfo: { hasNextPage: end < list.length, endCursor: String(end) } };
}

export async function getProduct(handle, { signal } = {}) {
  await wait();
  abortable(signal);
  return SAMPLE_PRODUCTS.find((p) => p.handle === handle) || null;
}

export async function getRecommendations(productId, { signal } = {}) {
  await wait();
  abortable(signal);
  return SAMPLE_PRODUCTS.filter((p) => p.id !== productId);
}

/* --------------------------- local demo cart --------------------------- */

const KEY = "cm365.demoCart";
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const write = (lines) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable: the cart simply won't persist */
  }
};

function build(lines) {
  const out = [];
  let currency = "INR";
  let sum = 0;
  let qty = 0;
  for (const l of lines) {
    const product = SAMPLE_PRODUCTS.find((p) => p.variants.some((v) => v.id === l.variantId));
    const variant = product && product.variants.find((v) => v.id === l.variantId);
    if (!variant) continue;
    const total = Number(variant.price.amount) * l.quantity;
    sum += total;
    qty += l.quantity;
    currency = variant.price.currencyCode;
    out.push({
      id: variant.id,
      quantity: l.quantity,
      variantId: variant.id,
      variantTitle: variant.title,
      productTitle: product.title,
      handle: product.handle,
      image: variant.image || product.image,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      total: { amount: String(total), currencyCode: currency },
      availableForSale: true,
    });
  }
  const money = { amount: String(sum), currencyCode: currency };
  return { id: "demo-cart", checkoutUrl: null, totalQuantity: qty, subtotal: money, total: money, email: null, lines: out };
}

export async function cartFetch() {
  const lines = read();
  return lines.length ? build(lines) : null;
}

export async function cartAdd(_id, variantId, quantity = 1) {
  const lines = read();
  const found = lines.find((l) => l.variantId === variantId);
  if (found) found.quantity += quantity;
  else lines.push({ variantId, quantity });
  write(lines);
  return build(lines);
}

export async function cartSetQty(_id, lineId, quantity) {
  const lines = read()
    .map((l) => (l.variantId === lineId ? { ...l, quantity } : l))
    .filter((l) => l.quantity > 0);
  write(lines);
  return build(lines);
}

export async function cartRemove(_id, lineId) {
  const lines = read().filter((l) => l.variantId !== lineId);
  write(lines);
  return build(lines);
}

export async function cartSetBuyer() {
  return null;
}

// Sample mode has no checkout, so there is nothing to attribute.
export async function cartSetAttributes() {
  return null;
}

// Shopify Storefront API client: products, cart and (classic mode only) customer accounts.
// Docs: https://shopify.dev/docs/api/storefront
import { SHOPIFY } from "./config.js";

export class ShopifyError extends Error {
  constructor(message, extra = {}) {
    super(message);
    this.name = "ShopifyError";
    Object.assign(this, extra);
  }
}

const ENDPOINT = `https://${SHOPIFY.domain}/api/${SHOPIFY.apiVersion}/graphql.json`;

export async function storefront(query, variables = {}, { signal } = {}) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY.token,
      },
      body: JSON.stringify({ query, variables }),
      signal,
    });
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    throw new ShopifyError("Could not reach the store. Check your connection and try again.", { cause: err });
  }
  if (!res.ok) {
    const msg =
      res.status === 401 || res.status === 403
        ? "The store rejected the Storefront access token. Check your .env settings."
        : res.status === 429
          ? "The store is busy right now. Please try again in a moment."
          : `The store returned an error (${res.status}).`;
    throw new ShopifyError(msg, { status: res.status });
  }
  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new ShopifyError(json.errors.map((e) => e.message).join(" · "), { graphql: json.errors });
  }
  return json.data;
}

const nodes = (c) => (c && c.nodes) || [];

/* ------------------------------ fragments ------------------------------ */

const MONEY = "amount currencyCode";
const IMAGE = "url altText width height";

const PRODUCT_CARD = `
  id handle title vendor productType tags availableForSale
  featuredImage { ${IMAGE} }
  priceRange { minVariantPrice { ${MONEY} } maxVariantPrice { ${MONEY} } }
  compareAtPriceRange { minVariantPrice { ${MONEY} } }
`;

const PRODUCT_FULL = `
  ${PRODUCT_CARD}
  description
  images(first: 12) { nodes { ${IMAGE} } }
  options { name values }
  variants(first: 100) {
    nodes {
      id title availableForSale
      price { ${MONEY} }
      compareAtPrice { ${MONEY} }
      selectedOptions { name value }
      image { ${IMAGE} }
    }
  }
  seo { title description }
`;

const CART = `
  id checkoutUrl totalQuantity
  cost { subtotalAmount { ${MONEY} } totalAmount { ${MONEY} } }
  buyerIdentity { email }
  lines(first: 100) {
    nodes {
      id quantity
      cost { totalAmount { ${MONEY} } }
      merchandise {
        ... on ProductVariant {
          id title availableForSale
          price { ${MONEY} }
          compareAtPrice { ${MONEY} }
          image { ${IMAGE} }
          product { handle title featuredImage { ${IMAGE} } }
        }
      }
    }
  }
`;

/* ----------------------------- normalizers ----------------------------- */

const positive = (m) => (m && Number(m.amount) > 0 ? m : null);

function normalizeProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags || [],
    availableForSale: p.availableForSale,
    description: p.description || "",
    image: p.featuredImage || null,
    images: nodes(p.images),
    options: p.options || [],
    variants: nodes(p.variants).map((v) => ({ ...v, compareAtPrice: positive(v.compareAtPrice) })),
    price: p.priceRange.minVariantPrice,
    maxPrice: p.priceRange.maxVariantPrice,
    compareAtPrice: positive(p.compareAtPriceRange && p.compareAtPriceRange.minVariantPrice),
    seo: p.seo || null,
  };
}

function normalizeCart(c) {
  if (!c) return null;
  return {
    id: c.id,
    checkoutUrl: c.checkoutUrl,
    totalQuantity: c.totalQuantity,
    subtotal: c.cost.subtotalAmount,
    total: c.cost.totalAmount,
    email: (c.buyerIdentity && c.buyerIdentity.email) || null,
    lines: nodes(c.lines)
      .filter((l) => l.merchandise && l.merchandise.id)
      .map((l) => {
        const v = l.merchandise;
        const was = positive(v.compareAtPrice);
        return {
          id: l.id,
          quantity: l.quantity,
          variantId: v.id,
          variantTitle: v.title,
          productTitle: v.product && v.product.title,
          handle: v.product && v.product.handle,
          image: v.image || (v.product && v.product.featuredImage) || null,
          price: v.price,
          compareAtPrice: was && Number(was.amount) > Number(v.price.amount) ? was : null,
          total: l.cost.totalAmount,
          availableForSale: v.availableForSale,
        };
      }),
  };
}

/* ------------------------------- products ------------------------------ */

export async function listProducts({ first = 12, after = null, query = "", sort = "BEST_SELLING", reverse = false, signal } = {}) {
  const data = await storefront(
    `query Products($first: Int!, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
      products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
        pageInfo { hasNextPage endCursor }
        nodes { ${PRODUCT_CARD} }
      }
    }`,
    { first, after, query: query || null, sortKey: sort, reverse },
    { signal }
  );
  return {
    products: nodes(data.products).map(normalizeProduct),
    pageInfo: data.products.pageInfo,
  };
}

export async function getProduct(handle, { signal } = {}) {
  const data = await storefront(
    `query Product($handle: String!) { product(handle: $handle) { ${PRODUCT_FULL} } }`,
    { handle },
    { signal }
  );
  return normalizeProduct(data.product);
}

export async function getRecommendations(productId, { signal } = {}) {
  const data = await storefront(
    `query Recs($id: ID!) { productRecommendations(productId: $id) { ${PRODUCT_CARD} } }`,
    { id: productId },
    { signal }
  );
  return (data.productRecommendations || []).map(normalizeProduct);
}

/* --------------------------------- cart -------------------------------- */

function throwUserErrors(errors) {
  if (errors && errors.length) {
    throw new ShopifyError(errors.map((e) => e.message).join(" "), { userErrors: errors });
  }
}

async function cartMutation(field, query, variables) {
  const data = await storefront(query, variables);
  const payload = data[field];
  throwUserErrors(payload.userErrors);
  return normalizeCart(payload.cart);
}

export async function cartFetch(id) {
  if (!id) return null;
  const data = await storefront(`query Cart($id: ID!) { cart(id: $id) { ${CART} } }`, { id });
  return normalizeCart(data.cart); // null once the cart was checked out or expired
}

export function cartAdd(id, variantId, quantity = 1, attributes = []) {
  const lines = [{ merchandiseId: variantId, quantity }];
  if (!id) {
    return cartMutation(
      "cartCreate",
      `mutation($input: CartInput!) { cartCreate(input: $input) { cart { ${CART} } userErrors { field message } } }`,
      { input: attributes.length ? { lines, attributes } : { lines } }
    );
  }
  return cartMutation(
    "cartLinesAdd",
    `mutation($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART} } userErrors { field message } } }`,
    { cartId: id, lines }
  );
}

export function cartSetQty(id, lineId, quantity) {
  return cartMutation(
    "cartLinesUpdate",
    `mutation($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART} } userErrors { field message } } }`,
    { cartId: id, lines: [{ id: lineId, quantity }] }
  );
}

export function cartRemove(id, lineId) {
  return cartMutation(
    "cartLinesRemove",
    `mutation($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART} } userErrors { field message } } }`,
    { cartId: id, lineIds: [lineId] }
  );
}

// Cart attributes become the order's note attributes. The referral token rides along here
// so the server can credit the right partner when the order is paid.
export function cartSetAttributes(id, attributes) {
  return cartMutation(
    "cartAttributesUpdate",
    `mutation($cartId: ID!, $attributes: [AttributeInput!]!) { cartAttributesUpdate(cartId: $cartId, attributes: $attributes) { cart { ${CART} } userErrors { field message } } }`,
    { cartId: id, attributes }
  );
}

// Link the cart to the signed-in customer so the order is attached to their account.
export function cartSetBuyer(id, customerAccessToken) {
  return cartMutation(
    "cartBuyerIdentityUpdate",
    `mutation($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) { cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) { cart { ${CART} } userErrors { field message } } }`,
    { cartId: id, buyerIdentity: { customerAccessToken } }
  );
}

/* --------- classic customer accounts (email + password, legacy only) --------- */

const CUSTOMER_ERRORS = {
  UNIDENTIFIED_CUSTOMER: "Incorrect email or password.",
  TAKEN: "An account with this email already exists. Try signing in instead.",
  TOO_SHORT: "That password is too short.",
  INVALID: "Please check the details you entered.",
  CUSTOMER_DISABLED: "This account is disabled. Please contact support.",
  PASSWORD_STARTS_OR_ENDS_WITH_WHITESPACE: "The password cannot start or end with a space.",
};

function throwCustomerErrors(errors) {
  if (errors && errors.length) {
    const e = errors[0];
    throw new ShopifyError(CUSTOMER_ERRORS[e.code] || e.message || "Something went wrong.", { code: e.code });
  }
}

export async function classicLogin({ email, password }) {
  const data = await storefront(
    `mutation($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken { accessToken expiresAt }
        customerUserErrors { code field message }
      }
    }`,
    { input: { email, password } }
  );
  const p = data.customerAccessTokenCreate;
  throwCustomerErrors(p.customerUserErrors);
  if (!p.customerAccessToken) throw new ShopifyError("Could not sign in. Please try again.");
  return p.customerAccessToken;
}

export async function classicRegister({ name, email, phone, password }) {
  const [firstName, ...rest] = String(name || "").trim().split(/\s+/);
  const input = { email, password, firstName, lastName: rest.join(" ") || undefined, acceptsMarketing: false };
  if (phone) input.phone = phone;
  const data = await storefront(
    `mutation($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer { id }
        customerUserErrors { code field message }
      }
    }`,
    { input }
  );
  throwCustomerErrors(data.customerCreate.customerUserErrors);
}

export async function classicRecover(email) {
  const data = await storefront(
    `mutation($email: String!) { customerRecover(email: $email) { customerUserErrors { code field message } } }`,
    { email }
  );
  throwCustomerErrors(data.customerRecover.customerUserErrors);
}

export async function classicCustomer(token) {
  const data = await storefront(
    `query($token: String!) {
      customer(customerAccessToken: $token) {
        id firstName lastName email phone
        orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
          nodes { id name processedAt financialStatus fulfillmentStatus totalPrice { ${MONEY} } statusUrl }
        }
      }
    }`,
    { token }
  );
  const c = data.customer;
  if (!c) throw new ShopifyError("Your session has expired. Please sign in again.");
  return {
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email,
    email: c.email,
    phone: c.phone,
    orders: nodes(c.orders).map((o) => ({
      id: o.id,
      name: o.name,
      processedAt: o.processedAt,
      status: o.financialStatus,
      fulfillment: o.fulfillmentStatus,
      total: o.totalPrice,
      statusUrl: o.statusUrl,
    })),
  };
}

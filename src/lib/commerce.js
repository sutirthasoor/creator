// One interface for the storefront. Pages import from here and never care whether the
// data comes from Shopify or from the labelled sample catalogue.
import { isShopifyConfigured } from "./config.js";
import * as live from "./shopify.js";
import * as demo from "./demo.js";

const api = isShopifyConfigured ? live : demo;

export const isDemo = !isShopifyConfigured;
export const listProducts = api.listProducts;
export const getProduct = api.getProduct;
export const getRecommendations = api.getRecommendations;
export const cartFetch = api.cartFetch;
export const cartAdd = api.cartAdd;
export const cartSetQty = api.cartSetQty;
export const cartRemove = api.cartRemove;
export const cartSetBuyer = api.cartSetBuyer;
export const cartSetAttributes = api.cartSetAttributes;

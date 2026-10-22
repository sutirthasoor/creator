import { Info } from "lucide-react";
import { isDemo } from "../lib/commerce.js";

/* Shown on shop pages only while Shopify credentials are missing. */
export default function DemoBanner() {
  if (!isDemo) return null;
  return (
    <div className="cm-banner" role="note">
      <Info size={18} aria-hidden="true" />
      <p>
        <strong>Sample catalogue.</strong> Shopify is not connected yet, so these are placeholder products and
        checkout is switched off. Add your store domain and Storefront token to <code>.env</code> to load your real
        products.
      </p>
    </div>
  );
}

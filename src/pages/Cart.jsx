import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ArrowRight, ShoppingCart, CircleAlert, Info } from "lucide-react";
import ProductMedia from "../components/ProductMedia.jsx";
import DemoBanner from "../components/DemoBanner.jsx";
import { formatMoney } from "../lib/money.js";
import { useCurrency } from "../lib/currency.js";
import CurrencyNote from "../components/CurrencyNote.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Cart() {
  const { cart, loading, busy, error, isDemo, setQty, remove, checkout } = useCart();
  const { authMode, isAuthed } = useAuth();
  useCurrency(); // re-render when the display currency changes
  const lines = (cart && cart.lines) || [];
  const hasUnavailable = lines.some((l) => !l.availableForSale);

  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-page">
        <header className="cm-shop-head">
          <h1 className="cm-h1">Your <span className="cm-gradient-text">cart</span></h1>
        </header>

        <DemoBanner />

        {loading ? (
          <p className="cm-lead" aria-live="polite">Loading your cart…</p>
        ) : lines.length === 0 ? (
          <div className="cm-state">
            <ShoppingCart size={28} aria-hidden="true" />
            <h2>Your cart is empty</h2>
            <p>Find something you like and it will appear here.</p>
            <Link className="cm-btn cm-btn-primary" to="/products">Browse products <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        ) : (
          <div className="cm-cart">
            <ul className="cm-lines" aria-label="Items in your cart">
              {lines.map((l) => (
                <li key={l.id} className="cm-line">
                  <Link className="cm-line-media" to={`/products/${l.handle}`} aria-label={`${l.productTitle}, view product`}>
                    <ProductMedia image={l.image} title={l.productTitle} width={240} />
                  </Link>
                  <div className="cm-line-body">
                    <Link className="cm-line-title" to={`/products/${l.handle}`}>{l.productTitle}</Link>
                    {l.variantTitle && l.variantTitle !== "Default Title" && <span className="cm-line-variant">{l.variantTitle}</span>}
                    <span className="cm-line-unit">{formatMoney(l.price)}{l.compareAtPrice && <s>{formatMoney(l.compareAtPrice)}</s>}</span>
                    {!l.availableForSale && <span className="cm-badge cm-badge-out">No longer available</span>}
                    <div className="cm-line-actions">
                      <button type="button" className="cm-remove" disabled={busy} onClick={() => remove(l.id)}>
                        <Trash2 size={16} aria-hidden="true" /> Remove
                      </button>
                    </div>
                  </div>
                  <span className="cm-line-total">{formatMoney(l.total)}</span>
                </li>
              ))}
            </ul>

            <aside className="cm-summary" aria-label="Order summary">
              <h2>Order summary</h2>
              <dl>
                <div><dt>Subtotal</dt><dd>{formatMoney(cart.subtotal)}</dd></div>
              </dl>
              <p className="cm-fineprint">Taxes and any shipping are calculated at checkout.</p>
              <CurrencyNote />

              {error && (
                <div className="cm-notice cm-notice-error" role="alert">
                  <CircleAlert size={18} aria-hidden="true" />
                  <p>{error}</p>
                </div>
              )}
              {hasUnavailable && (
                <div className="cm-notice cm-notice-error" role="alert">
                  <CircleAlert size={18} aria-hidden="true" />
                  <p>Remove the unavailable item to continue.</p>
                </div>
              )}

              <button
                type="button"
                className="cm-btn cm-btn-primary cm-btn-block"
                onClick={checkout}
                disabled={busy || isDemo || hasUnavailable || !cart.checkoutUrl}
              >
                Checkout <ArrowRight size={17} aria-hidden="true" />
              </button>
              {isDemo && (
                <div className="cm-notice cm-notice-info">
                  <Info size={18} aria-hidden="true" />
                  <p>Checkout is switched off until Shopify is connected.</p>
                </div>
              )}
              {!isDemo && !isAuthed && authMode !== "none" && (
                <p className="cm-fineprint">
                  <Link className="cm-link" to="/auth" state={{ from: "/cart" }}>Sign in</Link> first to link this order to your account.
                </p>
              )}
              <Link className="cm-link cm-continue" to="/products">Continue shopping</Link>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

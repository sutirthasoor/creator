import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Check, BookOpen, LockKeyhole, ShieldCheck, ArrowLeft, CircleAlert } from "lucide-react";
import ProductMedia from "../components/ProductMedia.jsx";
import ProductCard from "../components/ProductCard.jsx";
import Price from "../components/Price.jsx";
import CurrencyNote from "../components/CurrencyNote.jsx";
import DemoBanner from "../components/DemoBanner.jsx";
import { getProduct, getRecommendations } from "../lib/commerce.js";
import { useCart } from "../context/CartContext.jsx";

const MAX_QTY = 10;

function firstAvailable(product) {
  return product.variants.find((v) => v.availableForSale) || product.variants[0];
}

function toSelection(variant) {
  const sel = {};
  (variant ? variant.selectedOptions : []).forEach((o) => { sel[o.name] = o.value; });
  return sel;
}

export default function ProductDetail() {
  const { handle } = useParams();
  const { cart, add, busy, error: cartError, clearError, isDemo } = useCart();

  const [product, setProduct] = useState(undefined); // undefined = loading, null = not found
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState({});
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false); // local guard against double-clicks
  const [related, setRelated] = useState([]);
  const [attempt, setAttempt] = useState(0);

  // Load the product for this handle.
  useEffect(() => {
    const controller = new AbortController();
    setProduct(undefined);
    setLoadError("");
    setAdded(false);
    setAdding(false);
    setQty(1);
    setActiveImage(0);
    setRelated([]);
    clearError();
    getProduct(handle, { signal: controller.signal })
      .then((p) => {
        setProduct(p);
        if (p) setSelected(toSelection(firstAvailable(p)));
      })
      .catch((err) => {
        if (err && err.name === "AbortError") return;
        setLoadError((err && err.message) || "Could not load this product.");
        setProduct(null);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, attempt]);

  // Page title, and "you may also like".
  useEffect(() => {
    if (!product) return undefined;
    document.title = `${(product.seo && product.seo.title) || product.title} — Creator Moves 365`;
    const controller = new AbortController();
    getRecommendations(product.id, { signal: controller.signal })
      .then((list) => setRelated(list.filter((p) => p.id !== product.id).slice(0, 4)))
      .catch(() => { /* recommendations are optional */ });
    return () => controller.abort();
  }, [product]);

  const variant = useMemo(() => {
    if (!product) return null;
    return (
      product.variants.find((v) => v.selectedOptions.every((o) => selected[o.name] === o.value)) || null
    );
  }, [product, selected]);

  const images = useMemo(() => {
    if (!product) return [];
    if (product.images.length) return product.images;
    return product.image ? [product.image] : [];
  }, [product]);

  // Is the currently selected variant already in the cart?
  const inCart = useMemo(() => {
    if (!variant || !cart || !Array.isArray(cart.lines)) return false;
    return cart.lines.some((line) => line.variantId === variant.id || line.id === variant.id);
  }, [variant, cart]);

  // Picking a variant that has its own photo switches the gallery to it.
  useEffect(() => {
    if (!variant || !variant.image) return;
    const idx = images.findIndex((i) => i.url === variant.image.url);
    if (idx >= 0) setActiveImage(idx);
  }, [variant, images]);

  function valueAvailable(optionName, value) {
    return product.variants.some(
      (v) =>
        v.availableForSale &&
        v.selectedOptions.every((o) => (o.name === optionName ? o.value === value : selected[o.name] === value))
    );
  }

  async function onAdd() {
    if (!variant || !variant.availableForSale || adding || inCart) return;
    setAdding(true);
    setAdded(false);
    try {
      const next = await add(variant.id, qty);
      if (next) setAdded(true);
    } finally {
      setAdding(false);
    }
  }

  /* ------------------------------ states ------------------------------ */

  if (product === undefined) {
    return (
      <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
        <div className="cm-page" aria-busy="true" aria-live="polite">
          <div className="cm-detail cm-skeleton">
            <div className="cm-gallery-main" />
            <div className="cm-detail-info">
              <span className="cm-sk-line" />
              <span className="cm-sk-line cm-sk-short" />
              <span className="cm-sk-line" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
        <div className="cm-page">
          <div className="cm-state" role={loadError ? "alert" : undefined}>
            <CircleAlert size={28} aria-hidden="true" />
            <h1 className="cm-h2">{loadError ? "We couldn’t load this product" : "Product not found"}</h1>
            <p>{loadError || "This product may have been removed or the link is wrong."}</p>
            <div className="cm-actions cm-actions-center">
              {loadError && <button type="button" className="cm-btn cm-btn-primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
              <Link className="cm-btn cm-btn-outline" to="/products"><ArrowLeft size={16} aria-hidden="true" /> All products</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showOptions = !(product.options.length === 1 && product.options[0].values.length === 1);
  const canBuy = Boolean(variant && variant.availableForSale);
  const shownPrice = variant ? variant.price : product.price;
  const shownCompare = variant ? variant.compareAtPrice : product.compareAtPrice;
  const paragraphs = product.description.split(/\n+/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-page">
        <nav className="cm-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/products">Products</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.title}</span>
        </nav>

        <DemoBanner />

        <article className="cm-detail">
          <div className="cm-gallery">
            <div className="cm-gallery-main">
              <ProductMedia image={images[activeImage]} title={product.title} width={1000} eager />
            </div>
            {images.length > 1 && (
              <ul className="cm-thumbs" aria-label="Product images">
                {images.map((img, i) => (
                  <li key={img.url}>
                    <button
                      type="button"
                      className={i === activeImage ? "is-active" : ""}
                      aria-label={`Show image ${i + 1} of ${images.length}`}
                      aria-current={i === activeImage}
                      onClick={() => setActiveImage(i)}
                    >
                      <ProductMedia image={img} title={product.title} width={160} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="cm-detail-info">
            {product.productType && <span className="cm-tag">{product.productType}</span>}
            <h1 className="cm-detail-title">{product.title}</h1>
            <Price price={shownPrice} compareAtPrice={shownCompare} large />
            <CurrencyNote />

            {paragraphs.length > 0 && (
              <div className="cm-prose cm-detail-desc">
                {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}

            {showOptions && product.options.map((opt) => (
              <fieldset key={opt.name} className="cm-options">
                <legend>{opt.name}: <strong>{selected[opt.name]}</strong></legend>
                <div className="cm-option-row">
                  {opt.values.map((val) => {
                    const on = selected[opt.name] === val;
                    const ok = valueAvailable(opt.name, val);
                    return (
                      <button
                        key={val}
                        type="button"
                        className={`cm-opt${on ? " is-active" : ""}${ok ? "" : " is-out"}`}
                        aria-pressed={on}
                        onClick={() => { setSelected((s) => ({ ...s, [opt.name]: val })); setAdded(false); }}
                      >
                        {val}
                        {!ok && <span className="cm-sr"> (unavailable)</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div className="cm-buy">
              <button
                type="button"
                className="cm-btn cm-btn-primary cm-buy-btn"
                onClick={onAdd}
                disabled={!canBuy || busy || adding || inCart}
              >
                {!variant ? "Unavailable"
                  : !variant.availableForSale ? "Sold out"
                  : inCart ? "Added to cart"
                  : adding ? "Adding…"
                  : "Add to cart"}
                {inCart ? <Check size={17} aria-hidden="true" /> : <ShoppingCart size={17} aria-hidden="true" />}
              </button>
            </div>

            {inCart && !added && (
              <p className="cm-fineprint">
                This item is in your cart. <Link className="cm-link" to="/cart">View cart</Link>
              </p>
            )}

            {added && (
              <div className="cm-notice cm-notice-success" role="status">
                <Check size={18} aria-hidden="true" />
                <p>Added to your cart. <Link className="cm-link" to="/cart">View cart</Link></p>
              </div>
            )}
            {cartError && (
              <div className="cm-notice cm-notice-error" role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                <p>{cartError}</p>
              </div>
            )}
            {isDemo && <p className="cm-fineprint">Checkout is switched off while the sample catalogue is showing.</p>}

            <ul className="cm-points">
              <li><BookOpen size={17} aria-hidden="true" /> One-time purchase</li>
              <li><LockKeyhole size={17} aria-hidden="true" /> Private online reader</li>
              <li><ShieldCheck size={17} aria-hidden="true" /> Access opens after verified payment</li>
            </ul>

            {product.tags.length > 0 && !isDemo && (
              <ul className="cm-chips" aria-label="Tags">
                {product.tags.map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
          </div>
        </article>

        {related.length > 0 && (
          <section aria-labelledby="related-title">
            <div className="cm-section-head">
              <h2 id="related-title" className="cm-h2">You may also <span className="cm-gradient-text">like</span></h2>
            </div>
            <div className="cm-grid">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
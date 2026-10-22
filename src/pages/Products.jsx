import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Sparkles, CircleAlert, SearchX } from "lucide-react";
import ProductCard from "../components/ProductCard.jsx";
import DemoBanner from "../components/DemoBanner.jsx";
import { listProducts } from "../lib/commerce.js";

const PAGE_SIZE = 12;

const SORTS = [
  { id: "featured", label: "Featured", sortKey: "BEST_SELLING", reverse: false },
  { id: "newest", label: "Newest", sortKey: "CREATED_AT", reverse: true },
  { id: "price-asc", label: "Price: low to high", sortKey: "PRICE", reverse: false },
  { id: "price-desc", label: "Price: high to low", sortKey: "PRICE", reverse: true },
  { id: "title", label: "Title: A to Z", sortKey: "TITLE", reverse: false },
];

function Skeletons() {
  return (
    <div className="cm-grid" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="cm-pcard cm-skeleton">
          <div className="cm-pcard-media" />
          <div className="cm-pcard-body">
            <span className="cm-sk-line" />
            <span className="cm-sk-line cm-sk-short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const sortId = SORTS.some((s) => s.id === params.get("sort")) ? params.get("sort") : "featured";

  const [text, setText] = useState(q);
  const [items, setItems] = useState([]);
  const [pageInfo, setPageInfo] = useState({ hasNextPage: false, endCursor: null });
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);

  const sortFor = useCallback(() => {
    const s = SORTS.find((x) => x.id === sortId);
    // "Featured" has no meaning for a text search, so rank by relevance instead.
    return { sort: q && s.id === "featured" ? "RELEVANCE" : s.sortKey, reverse: s.reverse };
  }, [q, sortId]);

  // Typing updates the URL after a short pause, so searches are shareable and don't fire on every key.
  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() === q) return;
      const next = new URLSearchParams(params);
      if (text.trim()) next.set("q", text.trim());
      else next.delete("q");
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [text, q, params, setParams]);

  // Load the first page whenever the search, sort or a retry changes.
  useEffect(() => {
    const id = ++requestRef.current;
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    const { sort, reverse } = sortFor();
    listProducts({ first: PAGE_SIZE, query: q, sort, reverse, signal: controller.signal })
      .then((res) => {
        if (id !== requestRef.current) return;
        setItems(res.products);
        setPageInfo(res.pageInfo);
        setStatus("ready");
      })
      .catch((err) => {
        if ((err && err.name === "AbortError") || id !== requestRef.current) return;
        setError((err && err.message) || "Could not load products.");
        setStatus("error");
      });
    return () => controller.abort();
  }, [q, sortId, attempt, sortFor]);

  async function loadMore() {
    if (loadingMore || !pageInfo.hasNextPage) return;
    const id = requestRef.current;
    setLoadingMore(true);
    try {
      const { sort, reverse } = sortFor();
      const res = await listProducts({ first: PAGE_SIZE, after: pageInfo.endCursor, query: q, sort, reverse });
      if (id !== requestRef.current) return;
      setItems((prev) => [...prev, ...res.products]);
      setPageInfo(res.pageInfo);
    } catch (err) {
      setError((err && err.message) || "Could not load more products.");
    } finally {
      setLoadingMore(false);
    }
  }

  function changeSort(e) {
    const next = new URLSearchParams(params);
    if (e.target.value === "featured") next.delete("sort");
    else next.set("sort", e.target.value);
    setParams(next, { replace: true });
  }

  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-page">
        <header className="cm-shop-head">
          <span className="cm-eyebrow"><Sparkles size={14} aria-hidden="true" /> Shop</span>
          <h1 className="cm-h1">All <span className="cm-gradient-text">products</span></h1>
          <p className="cm-lead">E-books and creator resources from Creator Moves 365. One-time purchase, read in a private online reader.</p>
        </header>

        <DemoBanner />

        <section aria-label="Products">
          <div className="cm-toolbar">
            <div className="cm-input-wrap cm-search">
              <Search className="cm-input-icon" size={17} aria-hidden="true" />
              <input
                type="search"
                className="cm-input has-icon"
                placeholder="Search products"
                aria-label="Search products"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <label className="cm-sort">
              <span>Sort by</span>
              <select className="cm-input cm-select" value={sortId} onChange={changeSort}>
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>

          <p className="cm-count" aria-live="polite">
            {status === "ready" ? `${items.length}${pageInfo.hasNextPage ? "+" : ""} ${items.length === 1 ? "product" : "products"}${q ? ` for “${q}”` : ""}` : " "}
          </p>

          {status === "loading" && <Skeletons />}

          {status === "error" && (
            <div className="cm-state" role="alert">
              <CircleAlert size={28} aria-hidden="true" />
              <h2>We couldn’t load the products</h2>
              <p>{error}</p>
              <button type="button" className="cm-btn cm-btn-primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
            </div>
          )}

          {status === "ready" && items.length === 0 && (
            <div className="cm-state">
              <SearchX size={28} aria-hidden="true" />
              <h2>No products found</h2>
              <p>{q ? `Nothing matched “${q}”. Try a different word.` : "There are no products to show yet."}</p>
              {q && (
                <button type="button" className="cm-btn cm-btn-outline" onClick={() => { setText(""); setParams({}, { replace: true }); }}>
                  Clear search
                </button>
              )}
            </div>
          )}

          {status === "ready" && items.length > 0 && (
            <>
              <div className="cm-grid">
                {items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {error && <p className="cm-error cm-center" role="alert">{error}</p>}
              {pageInfo.hasNextPage && (
                <div className="cm-more">
                  <button type="button" className="cm-btn cm-btn-outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

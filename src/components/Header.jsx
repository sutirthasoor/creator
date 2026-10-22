import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Crown, ArrowUpRight, ShoppingCart, Menu } from "lucide-react";
import { NAV_LINKS } from "../data/content.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import {
  BTN_PRIMARY_HEADER, BTN_CURRENCY, BTN_SIGNIN_DESKTOP, BTN_SIGNUP_DESKTOP,
  BTN_SIGNIN_MOBILE, BTN_SIGNUP_MOBILE, BTN_MENU, BTN_MOBILE_CTA, CART_LINK,
} from "../cls.js";

function Chevron() {
  return (
    <svg className="h-3.5 w-3.5 transition-transform " viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function CurrencyButton({ extra = "" }) {
  return (
    <button
      className={`${BTN_CURRENCY}${extra}`}
      type="button"
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-label="Country and currency: India, INR"
    >
      <span aria-hidden="true">🇮🇳</span>
      <span className="font-medium">INR</span>
      <Chevron />
    </button>
  );
}

function CartLink({ className, onClick }) {
  const { count } = useCart();
  return (
    <Link
      className={className}
      aria-label={count ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"}
      to="/cart"
      onClick={onClick}
    >
      <ShoppingCart size={24} className="h-4 w-4" aria-hidden="true" />
      {count > 0 && <span className="cm-cart-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { isAuthed } = useAuth();
  const home = pathname === "/";
  const homeProps = home ? { "data-status": "active", "aria-current": "page" } : {};
  // Separate pages (Products, About Us, Contact Us) highlight when you are on them; in-page anchors do not.
  const activeProps = (l) =>
    l.page && (pathname === l.to || pathname.startsWith(`${l.to}/`)) ? { "data-status": "active", "aria-current": "page" } : {};
  const close = () => setOpen(false);

  return (
    <header className="public-header master-header sticky top-0 z-50 border-b border-border/80 bg-card/95 backdrop-blur-lg">
      <div className="mx-auto px-4 sm:px-6">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Link aria-label="Creator Moves 365 home" className={`flex w-fit min-w-0 items-center gap-2${home ? " active" : ""}`} to="/" {...homeProps}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
              <Crown size={21} aria-hidden="true" />
            </span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground xl:flex" aria-label="Main navigation">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} className="site-section-link px-3 py-2 font-medium" to={l.to} {...activeProps(l)}>{l.label}</Link>
            ))}
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <Link className={BTN_PRIMARY_HEADER} to="/products">
              Get Masterbook <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <div className="relative hidden xl:block"><CurrencyButton /></div>
            <CartLink className={`${CART_LINK} hidden xl:grid`} />
            <div className="hidden items-center gap-2 xl:flex">
              {isAuthed ? (
                <Link className={BTN_SIGNUP_DESKTOP} to="/account">Account</Link>
              ) : (
                <>
                  <Link className={BTN_SIGNIN_DESKTOP} to="/auth">Sign in</Link>
                  <Link className={BTN_SIGNUP_DESKTOP} to="/auth?mode=signup">Create account</Link>
                </>
              )}
            </div>
            <button
              className={BTN_MENU}
              type="button"
              aria-expanded={open}
              aria-controls="site-mobile-navigation"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              <Menu size={24} className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <nav
          id="site-mobile-navigation"
          aria-label="Masterbook navigation"
          className={`site-mobile-nav absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-card p-4 text-sm shadow-xl xl:hidden ${open ? "site-mobile-nav-open" : ""}`}
          aria-hidden={!open}
          inert={open ? undefined : ""}
        >
          <div className="site-mobile-nav-primary">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} className="site-mobile-nav-link site-section-link" to={l.to} onClick={close} {...activeProps(l)}>
                {l.label}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ))}
            <Link className={BTN_MOBILE_CTA} to="/products" onClick={close}>
              Get Masterbook <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="site-mobile-nav-utilities">
            <div className="flex items-center gap-2 xl:hidden">
              <div className="relative min-w-0 flex-1">
                <CurrencyButton extra=" w-full justify-center" />
              </div>
              <CartLink className={CART_LINK} onClick={close} />
            </div>
            <div className={`grid gap-2 xl:hidden ${isAuthed ? "grid-cols-1" : "grid-cols-2"}`}>
              {isAuthed ? (
                <Link className={BTN_SIGNUP_MOBILE} to="/account" onClick={close}>Account</Link>
              ) : (
                <>
                  <Link className={BTN_SIGNIN_MOBILE} to="/auth" onClick={close}>Sign in</Link>
                  <Link className={BTN_SIGNUP_MOBILE} to="/auth?mode=signup" onClick={close}>Create account</Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}

import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Products from "./pages/Products.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Cart from "./pages/Cart.jsx";
import Auth from "./pages/Auth.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import Account from "./pages/Account.jsx";
import Library from "./pages/Library.jsx";
import Reader from "./pages/Reader.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import WhatsInside from "./pages/WhatsInside.jsx";
import WhoItsFor from "./pages/WhoItsFor.jsx";
import FaqPage from "./pages/FaqPage.jsx";
import Policies from "./pages/legal/Policies.jsx";
import { Terms, Privacy, RefundPolicy, ShippingPolicy } from "./pages/legal/LegalPage.jsx";
import Partner from "./pages/partner/Partner.jsx";
import PartnerAuth from "./pages/partner/PartnerAuth.jsx";
import Admin from "./pages/partner/Admin.jsx";
import EmbeddedAdmin from "./pages/partner/EmbeddedAdmin.jsx";
import AdminLogin from "./pages/partner/AdminLogin.jsx";
import { PartnerLayout, AdminLayout } from "./pages/partner/Layouts.jsx";

const DEFAULT_TITLE = "The Top Secret Content Collection Book Of The Viral Influencers — Creator Moves 365";
const SUFFIX = "Creator Moves 365";

function titleFor(pathname, search) {
  const mode = new URLSearchParams(search).get("mode");
  switch (pathname) {
    case "/products": return `Products — ${SUFFIX}`;
    case "/cart": return `Cart — ${SUFFIX}`;
    case "/account": return `Your account — ${SUFFIX}`;
    case "/about": return `About Us — ${SUFFIX}`;
    case "/contact": return `Contact Us — ${SUFFIX}`;
    case "/how-it-works": return `How It Works — ${SUFFIX}`;
    case "/whats-inside": return `What’s Inside — ${SUFFIX}`;
    case "/who-its-for": return `Who It’s For — ${SUFFIX}`;
    case "/faq": return `FAQ — ${SUFFIX}`;
    case "/terms": return `Terms & Conditions — ${SUFFIX}`;
    case "/privacy": return `Privacy Policy — ${SUFFIX}`;
    case "/refund-policy": return `Refund & Cancellation Policy — ${SUFFIX}`;
    case "/shipping-policy": return `Shipping & Delivery Policy — ${SUFFIX}`;
    case "/policies": return `Policies — ${SUFFIX}`;
    case "/auth":
      return mode === "signup" ? `Create account — ${SUFFIX}`
        : mode === "forgot" ? `Reset password — ${SUFFIX}`
        : `Sign in — ${SUFFIX}`;
    case "/auth/callback": return `Signing in — ${SUFFIX}`;
    case "/partner": return `Partner area — ${SUFFIX}`;
    case "/partner/auth": return `Partner sign in — ${SUFFIX}`;
    case "/admin": return `Admin — ${SUFFIX}`;
    default: return pathname.startsWith("/products/") ? `Product — ${SUFFIX}` : DEFAULT_TITLE;
  }
}

function RouteEffects() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    document.title = titleFor(pathname, search);
  }, [pathname, search]);
  useEffect(() => {
    if (hash) {
      // The target may not be mounted yet right after a route change, so wait a frame.
      const id = requestAnimationFrame(() => {
        const el = document.getElementById(hash.slice(1));
        if (el) el.scrollIntoView({ behavior: "smooth" });
      });
      return () => cancelAnimationFrame(id);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  // The admin page that Shopify shows inside its own admin: no storefront header or footer.
  if (pathname === "/shopify-admin" || pathname === "/shopify-admin/") {
    return <main className="pt-embedded-root"><EmbeddedAdmin /></main>;
  }
  // Partner area and admin area: own layout and own sign-in, no storefront header or footer.
  if (pathname === "/partner" || pathname.startsWith("/partner/")) {
    return (
      <PartnerLayout>
        <Routes>
          <Route path="/partner" element={<Partner />} />
          <Route path="/partner/auth" element={<PartnerAuth />} />
          <Route path="*" element={<Navigate to="/partner" replace />} />
        </Routes>
      </PartnerLayout>
    );
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminLayout>
    );
  }
  return (
    <div className="flex min-h-screen flex-col">
      <RouteEffects />
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:handle" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Navigate to="/cart" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/signup" element={<Navigate to="/auth?mode=signup" replace />} />
          <Route path="/account" element={<Account />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:productId" element={<Reader />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/whats-inside" element={<WhatsInside />} />
          <Route path="/who-its-for" element={<WhoItsFor />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
          <Route path="/ai" element={<Placeholder title="AI Library" />} />
          <Route path="/ai/categories" element={<Placeholder title="Categories" />} />
          <Route path="/ai/gallery" element={<Placeholder title="Gallery" />} />
          <Route path="/ai/pricing" element={<Placeholder title="Plans" />} />
          <Route path="/ai/policies" element={<Placeholder title="AI Library policies" />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/affiliate" element={<Navigate to="/partner" replace />} />
          <Route path="*" element={<Placeholder title="Page not found" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

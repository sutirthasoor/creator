import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { PartnerProvider } from "./context/PartnerContext.jsx";
import { AdminProvider } from "./context/AdminContext.jsx";
import { captureReferral } from "./lib/referral.js";
import "./styles.css";
import "./pages.css";
import "./shop.css";
import "./partner.css";

captureReferral();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <PartnerProvider>
            <AdminProvider>
              <App />
            </AdminProvider>
          </PartnerProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

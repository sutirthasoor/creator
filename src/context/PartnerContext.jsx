import { partnerAuth } from "../lib/partnerAuth.js";
import { makeSession } from "./makeSession.jsx";

// Influencer (partner) session. Separate from the admin session and from the shopper's Shopify account.
const s = makeSession(partnerAuth, "Partner");
export const PartnerProvider = s.Provider;
export const usePartner = s.useSession;

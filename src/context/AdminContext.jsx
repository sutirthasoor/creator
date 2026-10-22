import { adminAuth } from "../lib/partnerAuth.js";
import { makeSession } from "./makeSession.jsx";

// Admin session. Separate from the partner session; admin accounts cannot sign in to the partner area.
const s = makeSession(adminAuth, "Admin");
export const AdminProvider = s.Provider;
export const useAdmin = s.useSession;

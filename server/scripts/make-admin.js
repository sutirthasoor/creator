// Creates (or upgrades) an ADMIN account. Admins are separate from partners: they sign in at /admin/login,
// and an admin account can never sign in to the partner area.
//
// Usage: node scripts/make-admin.js you@example.com super_admin
//        node scripts/make-admin.js ops@example.com admin partners,finance
// Run from the server folder. Uses the service-account key set in server/.env.
//
// If the account does not exist it is created with a random password, and a link to choose a password is
// printed. Open that link once. An email that already belongs to a partner (an influencer) is refused.
import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { loadEnvFile } from "../src/config.js";

const [email, role = "admin", perms = ""] = process.argv.slice(2);
if (!email || !["super_admin", "admin"].includes(role)) {
  console.error("Usage: node scripts/make-admin.js <email> <super_admin|admin> [partners,finance]");
  process.exit(1);
}
loadEnvFile(); // reads server/.env so GOOGLE_APPLICATION_CREDENTIALS is picked up
initializeApp();
const auth = getAuth();

let user;
let created = false;
try {
  user = await auth.getUserByEmail(email);
} catch (e) {
  if (e.code !== "auth/user-not-found") throw e;
  user = await auth.createUser({ email, emailVerified: true, password: crypto.randomBytes(24).toString("base64url") });
  created = true;
}

const partner = await getFirestore().collection("influencers").doc(user.uid).get();
if (partner.exists) {
  console.error(`${email} is already registered as a partner (influencer). Admin and partner accounts must be separate: use a different email for the admin.`);
  process.exit(1);
}

await auth.setCustomUserClaims(user.uid, { role, perms: perms.split(",").filter(Boolean) });
console.log(`${email} is now ${role}${perms ? ` (${perms})` : ""}. Admin sign-in page: /admin/login`);
if (created) {
  console.log("\nThe account was just created. Open this link once to choose a password:\n" + (await auth.generatePasswordResetLink(email)));
} else {
  console.log("They must sign out and in again for the change to apply.");
}

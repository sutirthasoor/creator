// One-shot migration: copy legacy productRates/{productId} into ebooks/{productId}.affiliate.
// Safe to re-run. Leaves productRates rows intact (pickRate() still reads them as a fallback).
//
// Usage (from server/): node scripts/migrate-product-rates.js
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { loadEnvFile } from "../src/config.js";

loadEnvFile();
initializeApp();
const db = getFirestore();

const legacy = await db.collection("productRates").get();
let created = 0;
let skipped = 0;
for (const doc of legacy.docs) {
  const data = doc.data();
  const ebookRef = db.collection("ebooks").doc(doc.id);
  const ebookSnap = await ebookRef.get();
  if (ebookSnap.exists && ebookSnap.data().affiliate) { skipped += 1; continue; }
  const affiliate = {
    eligible: data.eligible !== false,
    rateOverride: data.type ? { type: data.type, bps: data.bps, paise: data.paise } : null,
  };
  if (ebookSnap.exists) {
    await ebookRef.update({ affiliate });
  } else {
    const slug = (data.title || doc.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
    await ebookRef.set({
      productId: doc.id,
      title: data.title || doc.id,
      slug,
      status: "draft",
      currency: "INR",
      affiliate,
      reader: { chapters: [], printable: false },
      seo: { title: "", description: "", imageUrl: "", canonicalPath: "" },
      shopify: null,
      createdAt: new Date().toISOString(),
      createdBy: "migration",
      updatedAt: new Date().toISOString(),
      updatedBy: "migration",
    });
  }
  created += 1;
}
console.log(`Migrated ${created}, skipped ${skipped}, total legacy rows ${legacy.size}.`);
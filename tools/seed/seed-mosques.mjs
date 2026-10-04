// Loads the 36 source venues from packages/shared/src/mosqueData.ts into the live `mosques` collection.
//
//   gcloud auth application-default login          (once)
//   node tools/seed/seed-mosques.mjs               (from the repo root)
//
// Create-only: a venue that already exists is left alone, so re-running never overwrites a volunteer's verification.
// Nothing here is demo data and nothing is tagged `demo`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const { transformSync } = require("esbuild");
const file = fileURLToPath(new URL("../../packages/shared/src/mosqueData.ts", import.meta.url));
const js = transformSync(readFileSync(file, "utf8"), { loader: "ts", format: "esm" }).code;
const { MOSQUES } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

initializeApp({ credential: applicationDefault(), projectId: "ks1j-8a2e3" });
const db = getFirestore();

let created = 0;
for (const { id, ...m } of MOSQUES) {
  try {
    await db.doc(`mosques/${id}`).create({ ...m, verifiedAt: null, verifiedBy: null, lastCheckedAt: null, createdAt: FieldValue.serverTimestamp() });
    created++;
  } catch (e) {
    if (e.code !== 6) throw e; // 6 = ALREADY_EXISTS
  }
}
console.log(`${created} created, ${MOSQUES.length - created} already existed (${MOSQUES.length} total).`);

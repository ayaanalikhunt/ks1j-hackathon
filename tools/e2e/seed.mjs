// Seed the LOCAL emulators for the browser test. Refuses to run unless the emulator hosts are set.
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node tools/e2e/seed.mjs
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST. This script only seeds the emulators.");
  process.exit(1);
}
initializeApp({ projectId: "ks1j-8a2e3" });
const auth = getAuth();
const db = getFirestore();
const PASSWORD = "Passw0rd!e2e";
const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(80).fill(7)]).toString("base64")}`;

const users = [
  ["donor", "Dina Donor", "member"],
  ["admin1", "Adam Admin", "admin"],
  ["admin2", "Amira Admin", "admin"],
  ["applicant", "Private Family", "member"],
];
for (const [key, fullName, role] of users) {
  const uid = `e2e-${key}`;
  await auth.createUser({ uid, email: `${key}@e2e.test`, password: PASSWORD, displayName: fullName });
  await db.doc(`members/${uid}`).set({ fullName, role, phone: "+91 12345 67890", sadaatVerified: false });
}

const base = { applicantId: "e2e-applicant", applicantName: "Private Family", applicantPhone: "+91 99999 00000", applicantAddress: "12 Hidden Lane, Mumbai", amountRequested: 20000, raised: 0, type: "education", category: "welfare", needCategory: "education_fees", beneficiarySadaatVerified: false, createdAt: Timestamp.now() };
await db.doc("cases/e2e-case").set({ ...base, number: 1, publicCaseId: "CASE-2026-000001", title: "Class 10 fees", requirement: "School fees for the year.", description: "School fees for the year.", status: "published", verifiedBy: "e2e-admin1", approvedBy: "e2e-admin2", publishedBy: "e2e-admin2" });
await db.doc("publicCases/pub-e2e-case").set({ caseId: "e2e-case", category: "welfare", type: "education", number: 1, title: "Class 10 fees", sadaat: false, description: "Education: School fees for the year.", amountNeeded: 20000, amountRaised: 0, publicCaseId: "CASE-2026-000001", needCategory: "education_fees" });
await db.doc("cases/e2e-review").set({ ...base, number: 2, publicCaseId: "CASE-2026-000002", title: "Medicines", requirement: "Monthly medicines.", description: "Monthly medicines.", type: "medical", needCategory: "medicines", status: "submitted", idProofType: "aadhaar" });
await db.doc("cases/e2e-review/documents/d1").set({ kind: "aadhaar", name: "aadhaar.jpg", dataUrl: jpeg, uploadedAt: Timestamp.now() });
await db.doc("counters/cases").set({ n: 2 });
await db.doc("members/e2e-donor").update({ householdId: "hh-donor" });
console.log("seeded:", users.map((u) => `${u[0]}@e2e.test`).join(", "), "password", PASSWORD);

// Assign real roles to real people (not demo data, so these docs are NOT tagged demo:true and
// `reset` never touches them).
//   node assign-roles.mjs
// People who have not signed in yet get an Auth user created with no password. They sign in with
// Google using the same email and Firebase links to this account.
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault(), projectId: "ks1j-8a2e3" });
const auth = getAuth();
const db = getFirestore();

const PEOPLE = [
  { email: "ayaanalikhunt@gmail.com", name: "Ayaan Ali Khunt", role: "owner" },
  { email: "zamaanalishamji@gmail.com", name: "Zamaan Ali Shamji", role: "super_admin" },
  { email: "mizankarim7070@gmail.com", name: "Mizaan Karim", role: "admin" },
  { email: "alyqsmdvj@gmail.com", name: "Aly Qasim Devji", role: "volunteer" },
  { email: "ifutguy@gmail.com", name: "", role: "member" },
];

for (const p of PEOPLE) {
  let rec;
  let created = false;
  try {
    rec = await auth.getUserByEmail(p.email);
  } catch {
    rec = await auth.createUser({ email: p.email, displayName: p.name || undefined });
    created = true;
  }
  const ref = db.doc(`members/${rec.uid}`);
  const existing = await ref.get();
  await ref.set(
    {
      fullName: existing.get("fullName") ?? (p.name || rec.displayName || p.email),
      phone: existing.get("phone") ?? "+91 12345 67890",
      sadaatVerified: existing.get("sadaatVerified") ?? false,
      role: p.role,
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  console.log(`${p.role.padEnd(12)} ${p.email}  ${created ? "(account created, not signed in yet)" : "(existing account)"}`);
}

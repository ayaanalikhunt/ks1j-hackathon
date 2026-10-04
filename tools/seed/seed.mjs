// Demo data for KS1J. Everything here is clearly fictional.
//
//   gcloud auth application-default login          (once)
//   $env:SEED_PASSWORD = "<choose a demo password>"
//   pnpm --filter @ks1j/seed seed                   # create/refresh demo data
//   pnpm --filter @ks1j/seed reset                  # delete demo-tagged docs first, then reseed
//
// Every seeded document carries `demo: true`. Reset deletes only those. The ledger is
// append-only: it is never deleted, and its rows are written with fixed ids so reseeding is idempotent.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const PASSWORD = process.env.SEED_PASSWORD;
if (!PASSWORD || PASSWORD.length < 8) {
  console.error("Set SEED_PASSWORD (8+ chars) for the demo accounts.");
  process.exit(1);
}
const PHONE = "+91 12345 67890";
initializeApp({ credential: applicationDefault(), projectId: "ks1j-8a2e3" });
const auth = getAuth();
const db = getFirestore();
const now = FieldValue.serverTimestamp();
const d = { demo: true };

const RESETTABLE = [
  "members", "institutions", "cases", "publicCases", "publicStats", "donations", "khumsCalculations",
  "lawajamRecords", "loans", "repayments", "kbDocuments", "announcements", "communityProfiles",
  "communityPosts", "communityOpportunities", "communityGroups", "communityConnections", "communityReports",
];

async function resetDemo() {
  for (const name of RESETTABLE) {
    const snap = await db.collection(name).where("demo", "==", true).get();
    for (const doc of snap.docs) await db.recursiveDelete(doc.ref);
    console.log(`reset ${name}: ${snap.size}`);
  }
}

const USERS = [
  { key: "admin", email: "admin@ks1j.demo", name: "Demo Admin", role: "admin" },
  { key: "verifier", email: "verifier@ks1j.demo", name: "Demo Verifier", role: "verifier" },
  { key: "trustee1", email: "trustee1@ks1j.demo", name: "Demo Trustee One", role: "trustee" },
  { key: "trustee2", email: "trustee2@ks1j.demo", name: "Demo Trustee Two", role: "trustee" },
  { key: "fatima", email: "fatima@ks1j.demo", name: "Fatima Demo", role: "member", sadaat: true },
  { key: "hasan", email: "hasan@ks1j.demo", name: "Hasan Demo", role: "member" },
  { key: "zahra", email: "zahra@ks1j.demo", name: "Zahra Demo", role: "member" },
];

async function ensureUser(u) {
  let rec;
  try {
    rec = await auth.getUserByEmail(u.email);
  } catch {
    rec = await auth.createUser({ email: u.email, password: PASSWORD, displayName: u.name });
  }
  await db.doc(`members/${rec.uid}`).set({
    fullName: u.name, phone: PHONE, role: u.role, sadaatVerified: !!u.sadaat, createdAt: now, ...d,
  });
  return rec.uid;
}

async function seed() {
  const uid = {};
  for (const u of USERS) uid[u.key] = await ensureUser(u);

  // institutions: one with a verified ijazah, one without
  await db.doc("institutions/inst-noor").set({ name: "Noor Madrasa (demo)", marja: "Demo Marja'", ijazahVerified: true, ...d });
  await db.doc("institutions/inst-new").set({ name: "New Institute (demo)", marja: "", ijazahVerified: false, ...d });

  // cases at different stages (applicant detail is private; public cards are PII-free)
  const cases = [
    { id: "case-1", applicantId: uid.hasan, category: "welfare", description: "Medical bills for a family member", amountRequested: 45000, status: "submitted" },
    { id: "case-2", applicantId: uid.zahra, category: "scholarship", description: "College fees, second year", amountRequested: 60000, status: "verified", verifiedBy: uid.verifier },
    { id: "case-3", applicantId: uid.fatima, category: "welfare", description: "Rent support for three months", amountRequested: 30000, status: "approved", verifiedBy: uid.verifier, approvedBy: uid.trustee1, beneficiarySadaatVerified: true },
    { id: "case-4", applicantId: uid.hasan, category: "welfare", description: "Household essentials after a job loss", amountRequested: 20000, status: "disbursed", verifiedBy: uid.verifier, approvedBy: uid.trustee1 },
  ];
  for (const c of cases) await db.doc(`cases/${c.id}`).set({ ...c, applicantName: "(private)", beneficiarySadaatVerified: c.beneficiarySadaatVerified ?? false, createdAt: now, ...d });
  const open = [
    ["case-2", "scholarship", "A student needs help with second-year college fees", 60000, 15000],
    ["case-3", "welfare", "A family needs rent support for three months", 30000, 5000],
  ];
  for (const [caseId, category, description, amountNeeded, amountRaised] of open)
    await db.doc(`publicCases/pub-${caseId}`).set({ caseId, category, description, amountNeeded, amountRaised, ...d });
  await db.doc("publicStats/summary").set({ totalDisbursed: 132800, familiesHelped: 24, scholarships: 9, loansActive: 3, ...d });

  // donations: written by the Admin SDK, which is the only thing allowed to set `paid`
  await db.doc("donations/don-1").set({ fund: "general", caseId: "case-2", amount: 5000, status: "paid", payerId: uid.fatima, createdAt: now, ...d });
  await db.doc("donations/don-2").set({ fund: "sehme_sadaat", caseId: "case-3", amount: 5000, status: "paid", payerId: uid.zahra, createdAt: now, ...d });
  await db.doc("donations/don-3").set({ fund: "sehme_imam", institutionId: "inst-noor", amount: 2000, status: "pending", payerId: uid.hasan, createdAt: now, ...d });
  // ledger: append-only, fixed ids so a reseed never duplicates or rewrites history
  for (const [id, don, amount] of [["led-don-1", "don-1", 5000], ["led-don-2", "don-2", 5000]])
    await db.doc(`ledger/${id}`).create({ donationId: don, amount, kind: "donation", createdAt: now }).catch(() => {});

  // khums / lawajam
  await db.doc("khumsCalculations/k-1").set({ memberId: uid.hasan, surplus: 250000, due: 50000, createdAt: now, ...d });
  await db.doc("lawajamRecords/law-1").set({ memberId: uid.hasan, household: "Hasan household", period: "2026-10", amount: 1200, status: "due", ...d });

  // loans at three stages. No interest or late-fee field exists.
  await db.doc("loans/loan-1").set({ borrowerId: uid.zahra, borrowerName: "Zahra Demo", principal: 100000, purpose: "Engineering fees", status: "applied", familyAccepted: false, trusteeAccepted: false, createdAt: now, ...d });
  await db.doc("loans/loan-2").set({ borrowerId: uid.hasan, borrowerName: "Hasan Demo", principal: 60000, months: 12, purpose: "Diploma course", status: "emi_pending_agreement", familyAccepted: false, trusteeAccepted: true, createdAt: now, ...d });
  await db.doc("loans/loan-3").set({ borrowerId: uid.fatima, borrowerName: "Fatima Demo", principal: 90000, months: 18, purpose: "Nursing course", status: "disbursed", familyAccepted: true, trusteeAccepted: true, createdAt: now, ...d });

  // helpdesk knowledge base: the only thing the helpdesk may cite
  await db.doc("kbDocuments/kb-1").set({ title: "How to apply for welfare help", source: "Jamaat office guide (demo)", body: "Open Services, tap Ask for help, describe the need and submit. A verifier and then a different trustee review it.", ...d });
  await db.doc("kbDocuments/kb-2").set({ title: "How education loans work", source: "Jamaat office guide (demo)", body: "Education loans carry no interest and no late fees. You and a trustee agree the monthly amount before anything is paid out.", ...d });
  await db.doc("kbDocuments/kb-3").set({ title: "Who can receive Sehme Imam", source: "Jamaat office guide (demo)", body: "Sehme Imam goes only to institutions holding a verified ijazah from a Marja'. Confirm details with your Marja' or the Jamaat's alim.", ...d });
  await db.doc("announcements/a-1").set({ title: "Welcome to KS1J", body: "This is demo data. Nothing here is real.", createdAt: now, ...d });

  // community
  const prof = (k, name, extra) => db.doc(`communityProfiles/${uid[k]}`).set({ fullName: name, listed: true, openToWork: false, isMentor: false, skills: [], mentorAreas: [], ...extra, ...d });
  await prof("fatima", "Fatima Demo", { headline: "Nurse and educator", profession: "Nursing", industry: "Healthcare", city: "Mumbai", skills: ["Nursing", "Teaching"], bio: "Happy to guide students.", isMentor: true, mentorAreas: ["Nursing", "Careers"], mentorNote: "Weekends" });
  await prof("hasan", "Hasan Demo", { headline: "Software student", profession: "Engineering", industry: "Software", city: "Pune", skills: ["Python", "Excel"], openToWork: true });
  await prof("zahra", "Zahra Demo", { headline: "Accounts executive", profession: "Accounting", industry: "Finance", city: "Mumbai", skills: ["Tally", "GST"] });
  const posts = [["fatima", "Our nursing study circle meets this Sunday. All welcome."], ["hasan", "Looking for an internship in data analysis. Any leads?"]];
  for (const [i, [k, body]] of posts.entries())
    await db.doc(`communityPosts/post-${i + 1}`).set({ authorId: uid[k], authorName: USERS.find((u) => u.key === k).name, body, groupId: null, removed: false, createdAt: now, ...d });
  await db.doc("communityOpportunities/opp-1").set({ authorId: uid.zahra, authorName: "Zahra Demo", kind: "internship", title: "Accounts intern", company: "Demo & Co", description: "Three-month paid internship.", removed: false, createdAt: now, ...d });
  await db.doc("communityGroups/grp-1").set({ name: "Healthcare circle", kind: "profession", description: "Members working in healthcare", private: false, ownerId: uid.fatima, removed: false, createdAt: now, ...d });
  await db.doc(`communityGroups/grp-1/members/${uid.fatima}`).set({ role: "owner", status: "member", name: "Fatima Demo" });
  await db.doc("communityGroups/grp-2").set({ name: "Cricket Sundays", kind: "interest", description: "Weekend matches", private: true, ownerId: uid.hasan, removed: false, createdAt: now, ...d });
  await db.doc(`communityGroups/grp-2/members/${uid.hasan}`).set({ role: "owner", status: "member", name: "Hasan Demo" });
  await db.doc("communityConnections/conn-1").set({ fromId: uid.hasan, toId: uid.fatima, fromName: "Hasan Demo", toName: "Fatima Demo", kind: "message", status: "accepted", note: "Could you mentor me on careers?", preferredTime: null, createdAt: now, ...d });
  await db.doc("communityConnections/conn-1/messages/m-1").set({ senderId: uid.hasan, text: "Salaam, thank you for accepting.", createdAt: now });
  await db.doc("communityConnections/conn-2").set({ fromId: uid.zahra, toId: uid.fatima, fromName: "Zahra Demo", toName: "Fatima Demo", kind: "call", status: "pending", note: "A quick call about nursing courses?", preferredTime: "Saturday morning", createdAt: now, ...d });
  await db.doc("communityReports/rep-1").set({ reporterId: uid.zahra, status: "open", targetType: "post", targetId: "post-2", reason: "Demo report", createdAt: now, ...d });

  console.log("Seeded. Demo logins (password = SEED_PASSWORD):", USERS.map((u) => u.email).join(", "));
}

if (process.argv.includes("--reset")) await resetDemo();
await seed();

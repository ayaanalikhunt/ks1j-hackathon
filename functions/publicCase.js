// Public, read-only views of cases. Anyone can call these, so they return only what lib/timeline.js allows.
const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { caseRefOf } = require("./lib/allocation");
const { PUBLIC_STATUSES, buildPublicCase, numberFromRef, summarizeCase } = require("./lib/timeline");

const db = getFirestore();
const REGION = { region: "asia-south1", cors: true };

/** One case's public page: progress, status and a timeline taken from the real events. */
exports.getPublicCase = onCall(REGION, async (req) => {
  const ref = req.data?.ref;
  const n = numberFromRef(ref);
  if (!n) throw new HttpsError("invalid-argument", "That is not a case reference.");
  const found = await db.collection("cases").where("number", "==", n).limit(1).get();
  const doc = found.docs[0];
  // A case that is not public looks exactly like one that does not exist.
  if (!doc || !PUBLIC_STATUSES.includes(doc.get("status"))) throw new HttpsError("not-found", "No public case with that reference.");
  const [events, allocations, disbursements] = await Promise.all([
    db.collection("caseEvents").where("caseId", "==", doc.id).get(),
    db.collection("allocations").where("caseId", "==", doc.id).get(),
    db.collection("disbursements").where("caseId", "==", doc.id).get(),
  ]);
  return buildPublicCase(doc.data(), events.docs.map((d) => d.data()), allocations.docs.map((d) => d.data()), disbursements.docs.map((d) => d.data()), caseRefOf(doc.data()));
});

/** Recent public cases for the transparency page. Funded and finished cases stay listed after they leave the open list. */
exports.listPublicCases = onCall(REGION, async () => {
  const snap = await db.collection("cases").where("status", "in", PUBLIC_STATUSES).get();
  const allocs = await db.collection("allocations").get();
  const paid = new Map();
  allocs.docs.forEach((a) => {
    if (a.get("status") === "allocated" && a.get("caseId")) paid.set(a.get("caseId"), (paid.get(a.get("caseId")) ?? 0) + (a.get("disbursedAmount") ?? 0));
  });
  const cases = snap.docs
    .map((d) => ({ n: d.get("number") ?? 0, row: summarizeCase(d.data(), caseRefOf(d.data()), paid.get(d.id) ?? 0) }))
    .filter((x) => x.row.reference)
    .sort((a, b) => b.n - a.n)
    .slice(0, 30)
    .map((x) => x.row);
  return { cases };
});

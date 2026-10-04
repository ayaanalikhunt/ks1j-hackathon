// Public, read-only views of loans. Anyone can call these, so they return only what lib/publicLoan.js allows.
const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { PUBLIC_LOAN_STATUSES, buildPublicLoan, numberFromLoanRef, summarizeLoan } = require("./lib/publicLoan");

const db = getFirestore();
const REGION = { region: "asia-south1", cors: true };

exports.getPublicLoan = onCall(REGION, async (req) => {
  const n = numberFromLoanRef(req.data?.ref);
  if (!n) throw new HttpsError("invalid-argument", "That is not a loan reference.");
  const found = await db.collection("loans").where("publicLoanNumber", "==", n).limit(1).get();
  const doc = found.docs[0];
  // A loan that is not public looks exactly like one that does not exist.
  if (!doc || !PUBLIC_LOAN_STATUSES.includes(doc.get("status")) || !doc.get("publicLoanId")) throw new HttpsError("not-found", "No public loan with that reference.");
  return buildPublicLoan(doc.data());
});

exports.listPublicLoans = onCall(REGION, async () => {
  const snap = await db.collection("loans").where("status", "in", PUBLIC_LOAN_STATUSES).get();
  const loans = snap.docs
    .filter((d) => d.get("publicLoanId"))
    .sort((a, b) => (b.get("publicLoanNumber") ?? 0) - (a.get("publicLoanNumber") ?? 0))
    .slice(0, 30)
    .map((d) => summarizeLoan(d.data()));
  return { loans };
});

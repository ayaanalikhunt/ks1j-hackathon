const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();
const db = getFirestore();

/**
 * Money never moves on the client. A staff admin confirms a pending donation or repayment
 * (after the payment gateway or office has confirmed receipt). Only this function, running
 * with the Admin SDK, may flip a row to `paid`, and it appends a ledger row in the same
 * transaction. Ledger rows are never updated or deleted; a correction is a new reversing row.
 *
 * Swap the admin check for a verified gateway webhook when a real gateway is connected.
 */
exports.confirmPayment = onCall({ region: "asia-south1" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (me.get("role") !== "admin") throw new HttpsError("permission-denied", "Admins only.");

  const { kind, id } = req.data ?? {};
  if (!["donation", "repayment"].includes(kind) || typeof id !== "string") {
    throw new HttpsError("invalid-argument", "kind must be donation or repayment, and id a string.");
  }
  const ref = db.doc(`${kind === "donation" ? "donations" : "repayments"}/${id}`);
  const ledgerRef = db.doc(`ledger/${kind}-${id}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "No such payment.");
    const p = snap.data();
    if (p.status === "paid") return; // idempotent
    tx.update(ref, { status: "paid", paidAt: FieldValue.serverTimestamp(), confirmedBy: req.auth.uid });
    tx.create(ledgerRef, {
      kind,
      refId: id,
      amount: p.amount,
      fund: p.fund ?? null,
      caseId: p.caseId ?? null,
      institutionId: p.institutionId ?? null,
      loanId: p.loanId ?? null,
      createdAt: FieldValue.serverTimestamp(),
      confirmedBy: req.auth.uid,
    });
    // Keep the PII-free public card's raised amount in step with confirmed gifts.
    if (kind === "donation" && p.caseId) {
      const cards = await db.collection("publicCases").where("caseId", "==", p.caseId).limit(1).get();
      if (!cards.empty) tx.update(cards.docs[0].ref, { amountRaised: FieldValue.increment(p.amount) });
    }
  });
  return { ok: true };
});

const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();
const db = getFirestore();
const REGION = { region: "asia-south1" };
const ADMIN_ROLES = ["admin", "super_admin", "owner"];

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!ADMIN_ROLES.includes(me.get("role"))) throw new HttpsError("permission-denied", "Admins only.");
  return req.auth.uid;
}

/** Sadaat cases are paid from Sehme Sadaat, everything else from the general fund. Mirrors caseFund() in @ks1j/shared. */
const caseFund = (sadaat) => (sadaat ? "sehme_sadaat" : "general");

function caseEvent(tx, c, caseId, kind, actorId, note) {
  tx.create(db.collection("caseEvents").doc(), {
    caseId,
    applicantId: c.applicantId,
    caseNumber: c.number ?? null,
    caseTitle: c.title ?? c.requirement ?? "",
    kind,
    actorId,
    note: note ?? null,
    at: FieldValue.serverTimestamp(),
  });
}

/**
 * Money never moves on the client. A staff admin confirms a pending donation or repayment
 * (after the gateway or office has confirmed receipt). Only this function, running with the
 * Admin SDK, may flip a row to `paid`, and it appends a ledger row in the same transaction.
 * Ledger rows are never updated or deleted; a correction is a new reversing row.
 *
 * When the confirmed gifts reach the amount a published case asked for, the case becomes
 * `funded` and drops off the public list so finance can pay out.
 */
exports.confirmPayment = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { kind, id } = req.data ?? {};
  const COLLECTION = { donation: "donations", repayment: "repayments", lawajam: "lawajamPayments" };
  if (!COLLECTION[kind] || typeof id !== "string") {
    throw new HttpsError("invalid-argument", "kind must be donation, repayment or lawajam, and id a string.");
  }
  const ref = db.doc(`${COLLECTION[kind]}/${id}`);

  await db.runTransaction(async (tx) => {
    // All reads first.
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "No such payment.");
    const p = snap.data();
    if (p.status === "paid") return; // idempotent
    const caseRef = kind === "donation" && p.caseId ? db.doc(`cases/${p.caseId}`) : null;
    const caseSnap = caseRef ? await tx.get(caseRef) : null;
    const cardRef = caseRef ? db.doc(`publicCases/pub-${p.caseId}`) : null;
    const cardSnap = cardRef ? await tx.get(cardRef) : null;

    const recordRef = kind === "lawajam" ? db.doc(`lawajamRecords/${p.recordId}`) : null;
    const recordSnap = recordRef ? await tx.get(recordRef) : null;
    if (recordSnap && recordSnap.get("status") === "paid") throw new HttpsError("failed-precondition", "That year has already been paid for this household.");

    const fund = kind === "repayment" ? "loan_repayment" : kind === "lawajam" ? "lawajam" : p.fund;
    tx.update(ref, { status: "paid", paidAt: FieldValue.serverTimestamp(), confirmedBy: uid });
    tx.create(db.doc(`ledger/${kind}-${id}`), {
      kind,
      direction: "in",
      refId: id,
      amount: p.amount,
      fund,
      caseId: p.caseId ?? null,
      institutionId: p.institutionId ?? null,
      loanId: p.loanId ?? null,
      householdId: p.householdId ?? null,
      year: p.year ?? null,
      createdAt: FieldValue.serverTimestamp(),
      confirmedBy: uid,
    });

    if (recordRef) tx.update(recordRef, { status: "paid", paidAt: FieldValue.serverTimestamp(), paymentId: id, payerId: p.payerId });

    if (kind === "donation" && p.institutionId) {
      tx.update(db.doc(`institutions/${p.institutionId}`), { received: FieldValue.increment(p.amount) });
    }

    if (caseSnap?.exists) {
      const c = caseSnap.data();
      const raised = (c.raised ?? 0) + p.amount;
      const funded = c.status === "published" && raised >= (c.amountRequested ?? Infinity);
      tx.update(caseRef, { raised, ...(funded ? { status: "funded", fundedAt: FieldValue.serverTimestamp() } : {}) });
      caseEvent(tx, c, p.caseId, "gift_received", uid);
      if (funded) {
        caseEvent(tx, c, p.caseId, "funded", "system");
        // No longer open to donors.
        if (cardSnap?.exists) tx.delete(cardRef);
      } else if (cardSnap?.exists) {
        tx.update(cardRef, { amountRaised: FieldValue.increment(p.amount) });
      }
    }
  });
  return { ok: true };
});

/**
 * Finance hands the money over for a fully funded case. This writes the ledger "out" row and
 * closes the loop in one transaction, so a case can never be marked paid without the ledger entry.
 */
exports.payOutCase = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { caseId } = req.data ?? {};
  if (typeof caseId !== "string") throw new HttpsError("invalid-argument", "caseId is required.");
  const ref = db.doc(`cases/${caseId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "No such case.");
    const c = snap.data();
    if (c.status !== "funded") throw new HttpsError("failed-precondition", "Only a fully funded case can be paid out.");
    const amount = c.amountRequested ?? 0;
    tx.create(db.doc(`ledger/payout-${caseId}`), {
      kind: "payout",
      direction: "out",
      refId: caseId,
      amount,
      fund: caseFund(c.beneficiarySadaatVerified),
      caseId,
      createdAt: FieldValue.serverTimestamp(),
      confirmedBy: uid,
    });
    tx.update(ref, { status: "disbursed", disbursedBy: uid, disbursedAt: FieldValue.serverTimestamp() });
    caseEvent(tx, c, caseId, "paid_out", uid);
  });
  return { ok: true };
});

/**
 * Finance hands Sehme Imam money to an institution. The function refuses a handover larger than what is held for that
 * institution (received minus already handed over), and writes the ledger "out" row in the same transaction.
 */
exports.recordHandover = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { institutionId, amount, reference } = req.data ?? {};
  if (typeof institutionId !== "string" || !Number.isInteger(amount) || amount <= 0 || typeof reference !== "string" || reference.trim().length < 3) {
    throw new HttpsError("invalid-argument", "institutionId, a whole-rupee amount and a bank transfer or cheque reference are required.");
  }
  const instRef = db.doc(`institutions/${institutionId}`);
  const handoverRef = db.collection("handovers").doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(instRef);
    if (!snap.exists) throw new HttpsError("not-found", "No such institution.");
    const inst = snap.data();
    if (inst.ijazahVerified !== true) throw new HttpsError("failed-precondition", "Only institutions with a verified ijazah can receive Sehme Imam.");
    const held = (inst.received ?? 0) - (inst.handedOver ?? 0);
    if (amount > held) throw new HttpsError("failed-precondition", `Only ₹${held} is held for this institution.`);
    tx.create(handoverRef, { institutionId, institutionName: inst.name ?? "", amount, reference: reference.trim(), by: uid, at: FieldValue.serverTimestamp() });
    tx.update(instRef, { handedOver: FieldValue.increment(amount) });
    tx.create(db.doc(`ledger/handover-${handoverRef.id}`), {
      kind: "handover",
      direction: "out",
      refId: handoverRef.id,
      amount,
      fund: "sehme_imam",
      institutionId,
      createdAt: FieldValue.serverTimestamp(),
      confirmedBy: uid,
    });
  });
  return { ok: true };
});

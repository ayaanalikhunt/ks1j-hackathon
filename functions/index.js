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

// Date helpers. These mirror firstEmiDate()/nextMonth() in @ks1j/shared (the functions are plain JavaScript and cannot import it).
const GRACE_MONTHS = 6;
function addMonths(date, months) {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
const firstEmiDate = (courseEnd) => addMonths(courseEnd, GRACE_MONTHS);

const { settleDonation, audit } = require("./lib/settle");

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
  if (kind === "donation") {
    try {
      await settleDonation(db, id, { source: "manual" }, uid);
    } catch (e) {
      throw new HttpsError(e.code === "not-found" ? "not-found" : "failed-precondition", e.message);
    }
    return { ok: true };
  }
  const ref = db.doc(`${COLLECTION[kind]}/${id}`);

  await db.runTransaction(async (tx) => {
    // All reads first.
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "No such payment.");
    const p = snap.data();
    if (p.status === "paid") return; // idempotent
    const loanRef = kind === "repayment" && p.loanId ? db.doc(`loans/${p.loanId}`) : null;
    const loanSnap = loanRef ? await tx.get(loanRef) : null;
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

    // A confirmed instalment moves the loan along. No interest, no late fee: the balance only ever goes down.
    if (loanSnap?.exists) {
      const loan = loanSnap.data();
      const repaid = (loan.repaid ?? 0) + p.amount;
      const instalments = loan.emi ? Math.floor(p.amount / loan.emi) : 0;
      tx.update(loanRef, {
        repaid,
        status: repaid >= loan.principal ? "closed" : "repaying",
        ...(repaid >= loan.principal ? { closedAt: FieldValue.serverTimestamp() } : {}),
        ...(instalments > 0 && loan.nextDue ? { nextDue: addMonths(loan.nextDue, instalments) } : {}),
      });
    }
  });
  if (kind === "repayment") await require("./lib/transparency").refreshTransparency(db);
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
  const pre = await ref.get();
  if (pre.exists) await require("./lib/conflict").assertNotOwnCase(db, uid, pre.data());

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
    require("./lib/settle").caseEvent(db, tx, c, caseId, "paid_out", uid);
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

/**
 * Finance pays out an agreed education loan. Writes the ledger "out" row and starts the schedule in one transaction:
 * the first instalment falls six months after the course ends. Only an agreed plan can be paid out.
 */
exports.disburseLoan = onCall(REGION, async (req) => {
  const result = await disburseLoanImpl(req);
  await require("./lib/transparency").refreshTransparency(db);
  return result;
});

async function disburseLoanImpl(req) {
  const uid = await requireAdmin(req);
  const { loanId } = req.data ?? {};
  if (typeof loanId !== "string") throw new HttpsError("invalid-argument", "loanId is required.");
  const ref = db.doc(`loans/${loanId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "No such loan.");
    const loan = snap.data();
    if (loan.status !== "agreed") throw new HttpsError("failed-precondition", "The monthly amount must be agreed before the payout.");
    if (!loan.emi || !loan.courseEnd) throw new HttpsError("failed-precondition", "The plan is incomplete.");
    const counter = db.doc("counters/loansPublic");
    const cs = await tx.get(counter);
    const publicLoanNumber = (cs.exists ? cs.get("n") : 0) + 1;
    tx.set(counter, { n: publicLoanNumber });
    tx.create(db.doc(`ledger/loan-${loanId}`), {
      kind: "loan_disbursed",
      direction: "out",
      refId: loanId,
      amount: loan.principal,
      fund: "general",
      loanId,
      createdAt: FieldValue.serverTimestamp(),
      confirmedBy: uid,
    });
    tx.update(ref, {
      status: "disbursed",
      publicLoanNumber,
      publicLoanId: require("./lib/publicLoan").publicLoanRef(publicLoanNumber),
      disbursedBy: uid,
      disbursedAt: FieldValue.serverTimestamp(),
      repaid: 0,
      months: Math.ceil(loan.principal / loan.emi),
      nextDue: firstEmiDate(loan.courseEnd),
    });
  });
  return { ok: true };
}

/**
 * A trustee decides a hardship request. Approving a pause pushes the next due date back; approving a lower amount changes
 * the instalment. Either way nothing is added to what the family owes.
 */
exports.decideHardship = onCall(REGION, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!["trustee", ...ADMIN_ROLES].includes(me.get("role"))) throw new HttpsError("permission-denied", "Trustees and admins only.");
  const { id, approve, note } = req.data ?? {};
  if (typeof id !== "string" || typeof approve !== "boolean") throw new HttpsError("invalid-argument", "id and approve are required.");
  const ref = db.doc(`hardships/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "No such request.");
    const h = snap.data();
    if (h.status !== "pending") throw new HttpsError("failed-precondition", "That request has already been decided.");
    const loanRef = db.doc(`loans/${h.loanId}`);
    const loanSnap = await tx.get(loanRef);
    const loan = loanSnap.data();
    if (approve && loan) {
      if (h.type === "pause" && loan.nextDue) tx.update(loanRef, { nextDue: addMonths(loan.nextDue, h.months) });
      if (h.type === "lower") tx.update(loanRef, { emi: h.newEmi });
    }
    tx.update(ref, { status: approve ? "approved" : "declined", decidedBy: req.auth.uid, decidedAt: FieldValue.serverTimestamp(), note: typeof note === "string" ? note : null });
  });
  return { ok: true };
});

// Razorpay needs secrets that exist only once the owner has set them, so it is opt-in per deploy (functions/.env).
if (process.env.ENABLE_RAZORPAY === "true") Object.assign(exports, require("./razorpay"));

Object.assign(exports, require("./allocation"));

Object.assign(exports, require("./publicCase"));

Object.assign(exports, require("./report"));
Object.assign(exports, require("./fraud"));
Object.assign(exports, require("./documents"));

Object.assign(exports, require("./publicLoan"));
Object.assign(exports, require("./loanReminders"));

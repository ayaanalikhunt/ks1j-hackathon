// The one place a donation becomes real money: ledger entry, case progress, institution balance, audit trail.
// Used by the manual "confirm received" button and by the Razorpay verify and webhook paths, so there is a single
// implementation and a single set of tests.
const { FieldValue } = require("firebase-admin/firestore");
const { refreshTransparency } = require("./transparency");
const { caseRefOf } = require("./allocation");

function notify(db, tx, userId, text, link) {
  if (!userId) return;
  tx.create(db.collection("notifications").doc(), { userId, text, link: link ?? null, read: false, at: FieldValue.serverTimestamp() });
}

function caseEvent(db, tx, c, caseId, kind, actorId, note) {
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

/** An append-only record of a sensitive action. Written only by the functions. */
function audit(db, tx, entry) {
  const row = {
    action: entry.action,
    actor: entry.actor ?? "system",
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    reason: entry.reason ?? null,
    at: FieldValue.serverTimestamp(),
  };
  if (tx) tx.create(db.collection("auditLogs").doc(), row);
  else return db.collection("auditLogs").add(row);
}

/**
 * Mark a donation paid. Idempotent: a second call (a retried webhook, a double click) changes nothing.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} donationId
 * @param {{source: "manual"|"razorpay_verify"|"razorpay_webhook", paymentId?: string, method?: string, feePaise?: number, taxPaise?: number}} extra
 * @param {string} confirmedBy  a user id, or "system" for the webhook
 * @returns {Promise<{already: boolean}>}
 */
async function settleDonation(db, donationId, extra, confirmedBy) {
  const ref = db.doc(`donations/${donationId}`);
  let already = false;

  await db.runTransaction(async (tx) => {
    // All reads first.
    const snap = await tx.get(ref);
    if (!snap.exists) throw Object.assign(new Error("No such donation."), { code: "not-found" });
    const d = snap.data();
    if (d.status === "paid") {
      already = true;
      return;
    }
    if (d.donationStatus === "cancelled" || d.donationStatus === "refunded") {
      throw Object.assign(new Error(`That donation is ${d.donationStatus}.`), { code: "failed-precondition" });
    }
    const caseRef = d.caseId ? db.doc(`cases/${d.caseId}`) : null;
    const caseSnap = caseRef ? await tx.get(caseRef) : null;
    const cardRef = caseRef ? db.doc(`publicCases/pub-${d.caseId}`) : null;
    const cardSnap = cardRef ? await tx.get(cardRef) : null;
    const paymentRef = extra.paymentId || d.orderId ? db.doc(`payments/${d.orderId ?? extra.paymentId}`) : null;
    const paymentSnap = paymentRef ? await tx.get(paymentRef) : null;

    // A donation aimed at a case or an institution is allocated at once. A pool donation waits for the committee.
    const direct = Boolean(d.caseId || d.institutionId);
    tx.update(ref, {
      status: "paid",
      paymentStatus: "verified",
      donationStatus: direct ? "allocated" : "available_for_allocation",
      allocationStatus: direct ? "allocated" : "unallocated",
      allocatedAmount: direct ? d.amount : 0,
      disbursedAmount: 0,
      paidAt: FieldValue.serverTimestamp(),
      confirmedBy,
      ...(extra.paymentId ? { paymentId: extra.paymentId } : {}),
      ...(extra.method ? { paymentMethod: extra.method } : {}),
      // Fees are recorded in rupees (Razorpay reports paise) for reconciliation. They are never deducted from the donation.
      ...(typeof extra.feePaise === "number" ? { gatewayFee: extra.feePaise / 100 } : {}),
      ...(typeof extra.taxPaise === "number" ? { tax: extra.taxPaise / 100 } : {}),
    });
    if (paymentSnap?.exists) {
      tx.update(paymentRef, {
        status: "verified",
        verifiedAt: FieldValue.serverTimestamp(),
        verifiedBy: extra.source,
        ...(extra.paymentId ? { paymentId: extra.paymentId } : {}),
        ...(extra.method ? { method: extra.method } : {}),
      });
    }

    tx.create(db.doc(`ledger/donation-${donationId}`), {
      kind: "donation",
      direction: "in",
      refId: donationId,
      amount: d.amount,
      fund: d.fund,
      caseId: d.caseId ?? null,
      institutionId: d.institutionId ?? null,
      purpose: d.purpose ?? null,
      currency: d.baseCurrency ?? "INR",
      createdAt: FieldValue.serverTimestamp(),
      confirmedBy,
    });

    if (direct) {
      // A gift aimed at a case or institution is allocated the moment it is verified, and the allocation is a real record.
      tx.create(db.collection("allocations").doc(), {
        donationId, donorId: d.payerId ?? d.donorId ?? null, caseId: d.caseId ?? null, caseNumber: caseSnap?.exists ? caseSnap.get("number") ?? null : null, caseRef: caseSnap?.exists ? caseRefOf(caseSnap.data()) : null, institutionId: d.institutionId ?? null,
        amount: d.amount, category: d.purpose ?? "general_support", fund: d.fund, status: "allocated",
        disbursedAmount: 0, reservedAmount: 0, approvedBy: confirmedBy, createdAt: FieldValue.serverTimestamp(),
      });
    }
    notify(db, tx, d.payerId ?? d.donorId, "Your donation was successfully received.", `/donations/detail?id=${donationId}`);

    if (d.institutionId) {
      tx.update(db.doc(`institutions/${d.institutionId}`), { received: FieldValue.increment(d.amount) });
    }

    if (caseSnap?.exists) {
      const c = caseSnap.data();
      const raised = (c.raised ?? 0) + d.amount;
      const funded = c.status === "published" && raised >= (c.amountRequested ?? Infinity);
      tx.update(caseRef, { raised, ...(funded ? { status: "funded", fundedAt: FieldValue.serverTimestamp() } : {}) });
      caseEvent(db, tx, c, d.caseId, "gift_received", confirmedBy);
      if (funded) {
        caseEvent(db, tx, c, d.caseId, "funded", "system");
        // No longer open to donors.
        if (cardSnap?.exists) tx.delete(cardRef);
      } else if (cardSnap?.exists) {
        tx.update(cardRef, { amountRaised: FieldValue.increment(d.amount) });
      }
    }

    audit(db, tx, {
      action: "PAYMENT_VERIFIED",
      actor: confirmedBy,
      entityType: "donation",
      entityId: donationId,
      oldValue: { status: d.status ?? "pending" },
      newValue: { status: "paid", source: extra.source, amount: d.amount },
    });
  });

  if (!already) await refreshTransparency(db);
  return { already };
}

module.exports = { settleDonation, caseEvent, audit, notify };

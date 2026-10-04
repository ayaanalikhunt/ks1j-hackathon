// Allocation and disbursement: how verified donations reach cases, and how every rupee is traced and reconciled.
// Money rules live here (Admin SDK) and in firestore.rules, never in the browser.
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { canAllocate, caseRefOf, reconcileDonation, PURPOSES } = require("./lib/allocation");
const { audit, caseEvent } = require("./lib/settle");
const { flush, queue } = require("./lib/notify");
const { assertDonorIsNotApplicant, assertNotOwnCase } = require("./lib/conflict");
const { keyOf } = require("./lib/fraud");
const { refreshTransparency } = require("./lib/transparency");

const db = getFirestore();
const REGION = { region: "asia-south1" };
const ADMIN_ROLES = ["admin", "super_admin", "owner"];
const METHODS = ["bank_transfer", "upi", "cash", "direct_to_provider", "other"];
const DEFAULT_CHECKER_THRESHOLD = 25000;

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!ADMIN_ROLES.includes(me.get("role"))) throw new HttpsError("permission-denied", "Admins only.");
  return req.auth.uid;
}
const pos = (n) => Number.isInteger(n) && n > 0;
const fail = (msg) => new HttpsError("failed-precondition", msg);

async function checkerThreshold() {
  const s = await db.doc("settings/payments").get();
  const v = s.get("disbursementCheckerThreshold");
  return Number.isInteger(v) && v >= 0 ? v : DEFAULT_CHECKER_THRESHOLD;
}

/**
 * Split a verified donation across cases. The sum can never exceed what is still unallocated, restricted money
 * (Zakat, Khums, Sehme Sadaat) only goes to eligible cases, and no case is pushed past what it asked for.
 */
exports.allocateDonation = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { donationId, allocations } = req.data ?? {};
  if (typeof donationId !== "string" || !Array.isArray(allocations) || allocations.length < 1 || allocations.length > 20) {
    throw new HttpsError("invalid-argument", "A donation and 1 to 20 allocations are required.");
  }
  for (const a of allocations) {
    if (typeof a.caseId !== "string" || !pos(a.amount)) throw new HttpsError("invalid-argument", "Each allocation needs a case and a whole-rupee amount.");
    if (a.category !== undefined && !PURPOSES.includes(a.category)) throw new HttpsError("invalid-argument", "Unknown category.");
  }
  if (new Set(allocations.map((a) => a.caseId)).size !== allocations.length) throw new HttpsError("invalid-argument", "List each case once.");

  // Conflicts of interest are checked first: the admin must not be the applicant, and a donor's money must not return to them.
  const pre = await db.doc(`donations/${donationId}`).get();
  for (const a of allocations) {
    const cs = await db.doc(`cases/${a.caseId}`).get();
    if (cs.exists) {
      await assertNotOwnCase(db, uid, cs.data());
      await assertDonorIsNotApplicant(db, pre.get("payerId") ?? pre.get("donorId"), cs.data());
    }
  }
  const notes = [];
  await db.runTransaction(async (tx) => {
    notes.length = 0;
    const ref = db.doc(`donations/${donationId}`);
    const dSnap = await tx.get(ref);
    if (!dSnap.exists || dSnap.get("status") !== "paid") throw fail("Only a verified (paid) donation can be allocated.");
    const d = dSnap.data();
    const available = d.amount - (d.allocatedAmount ?? 0);
    const total = allocations.reduce((s, a) => s + a.amount, 0);
    if (total > available) throw fail(`Only ₹${available} of this donation is still unallocated.`);

    const cases = await Promise.all(allocations.map((a) => tx.get(db.doc(`cases/${a.caseId}`))));
    const cards = await Promise.all(allocations.map((a) => tx.get(db.doc(`publicCases/pub-${a.caseId}`))));

    allocations.forEach((a, i) => {
      const c = cases[i];
      const ok = canAllocate(d, c.exists ? c.data() : null);
      if (!ok.ok) throw fail(ok.reason);
      const room = (c.get("amountRequested") ?? 0) - (c.get("raised") ?? 0);
      if (a.amount > room) throw fail(`Case ${c.get("number") ?? a.caseId} needs only ₹${Math.max(room, 0)} more.`);
    });

    allocations.forEach((a, i) => {
      const c = cases[i];
      const cd = c.data();
      const raised = (cd.raised ?? 0) + a.amount;
      const funded = cd.status === "published" && raised >= cd.amountRequested;
      tx.create(db.collection("allocations").doc(), {
        donationId, donorId: d.payerId ?? d.donorId ?? null, caseId: a.caseId, caseNumber: cd.number ?? null, caseRef: caseRefOf(cd), amount: a.amount,
        category: a.category ?? d.purpose ?? "general_support", fund: d.fund, status: "allocated",
        disbursedAmount: 0, reservedAmount: 0, approvedBy: uid, createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(c.ref, { raised, ...(funded ? { status: "funded", fundedAt: FieldValue.serverTimestamp() } : {}) });
      caseEvent(db, tx, cd, a.caseId, "gift_allocated", uid);
      if (funded) {
        caseEvent(db, tx, cd, a.caseId, "funded", "system");
        if (cards[i].exists) tx.delete(cards[i].ref);
      } else if (cards[i].exists) {
        tx.update(cards[i].ref, { amountRaised: FieldValue.increment(a.amount) });
      }
      queue(notes, d.payerId ?? d.donorId, "allocated", `Your donation was allocated to Case ${caseRefOf(cd) ?? a.caseId}.`, `/donations/detail?id=${donationId}`);
    });

    const now = (d.allocatedAmount ?? 0) + total;
    tx.update(ref, {
      allocatedAmount: now,
      allocationStatus: now >= d.amount ? "allocated" : "partially_allocated",
      donationStatus: now >= d.amount ? "allocated" : "partially_allocated",
    });
    audit(db, tx, { action: "ALLOCATION_CREATED", actor: uid, entityType: "donation", entityId: donationId, oldValue: { allocated: d.allocatedAmount ?? 0 }, newValue: { allocated: now, allocations: allocations.map((a) => ({ caseId: a.caseId, amount: a.amount })) } });
  });
  await flush(db, notes);
  await refreshTransparency(db);
  return { ok: true };
});

/** Undo an allocation nothing has been paid from. Frees the money and takes it back off the case. */
exports.reverseAllocation = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { allocationId, reason } = req.data ?? {};
  if (typeof allocationId !== "string" || typeof reason !== "string" || reason.trim().length < 5) throw new HttpsError("invalid-argument", "An allocation and a reason are required.");
  await db.runTransaction(async (tx) => {
    const aRef = db.doc(`allocations/${allocationId}`);
    const a = await tx.get(aRef);
    if (!a.exists || a.get("status") !== "allocated") throw fail("Only an active allocation can be reversed.");
    if ((a.get("reservedAmount") ?? 0) > 0) throw fail("Money has already been paid or queued from this allocation.");
    const dRef = db.doc(`donations/${a.get("donationId")}`);
    const d = await tx.get(dRef);
    const c = a.get("caseId") ? await tx.get(db.doc(`cases/${a.get("caseId")}`)) : null;
    if (c?.exists && c.get("status") !== "published") throw fail("That case is already fully funded. Reverse it through a refund instead.");
    const left = Math.max(0, (d.get("allocatedAmount") ?? 0) - a.get("amount"));
    tx.update(aRef, { status: "reversed", reversedBy: uid, reversedAt: FieldValue.serverTimestamp(), reversalReason: reason });
    tx.update(dRef, { allocatedAmount: left, allocationStatus: left === 0 ? "unallocated" : "partially_allocated", donationStatus: left === 0 ? "available_for_allocation" : "partially_allocated" });
    if (c?.exists) tx.update(c.ref, { raised: Math.max(0, (c.get("raised") ?? 0) - a.get("amount")) });
    audit(db, tx, { action: "ALLOCATION_REVERSED", actor: uid, entityType: "allocation", entityId: allocationId, oldValue: { status: "allocated" }, newValue: { status: "reversed" }, reason });
  });
  await refreshTransparency(db);
  return { ok: true };
});

/**
 * The maker records a payout from an allocation. Under the threshold it is completed at once; at or above it a second
 * admin must approve. Recipient and reference numbers are kept in a private subdocument, never on the donor-visible record.
 */
exports.createDisbursement = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { allocationId, amount, method, recipientType, recipientName, referenceNumber, proofPath } = req.data ?? {};
  if (typeof allocationId !== "string" || !pos(amount) || !METHODS.includes(method)) throw new HttpsError("invalid-argument", "Allocation, amount and method are required.");
  const threshold = await checkerThreshold();
  const needsChecker = amount >= threshold;

  const al = await db.doc(`allocations/${allocationId}`).get();
  if (al.exists && al.get("caseId")) {
    const cs = await db.doc(`cases/${al.get("caseId")}`).get();
    if (cs.exists) await assertNotOwnCase(db, uid, cs.data());
  }
  // The same payout entered twice, a receipt reused, or the same proof attached to two payouts.
  const referenceKey = keyOf(referenceNumber);
  const proofKey = keyOf(proofPath);
  const earlier = (await db.collection("disbursements").where("allocationId", "==", allocationId).get()).docs.filter((x) => ["completed", "pending_approval"].includes(x.get("status")));
  const recent = earlier.find((x) => x.get("amount") === amount && x.get("method") === method && x.get("createdAt") && Date.now() - x.get("createdAt").toMillis() < 10 * 60_000);
  if (recent && req.data?.confirmDuplicate !== true) throw fail("An identical payout from this allocation was recorded a few minutes ago. If this is a second payment on purpose, confirm it.");
  for (const [field, key, what] of [["referenceKey", referenceKey, "reference number"], ["proofKey", proofKey, "proof document"]]) {
    if (!key) continue;
    const used = await db.collection("disbursements").where(field, "==", key).limit(1).get();
    if (!used.empty) throw fail(`That ${what} was already used on another payout.`);
  }
  let id = "";
  const notes = [];

  await db.runTransaction(async (tx) => {
    notes.length = 0;
    const aRef = db.doc(`allocations/${allocationId}`);
    const a = await tx.get(aRef);
    if (!a.exists || a.get("status") !== "allocated") throw fail("That allocation is not active.");
    if ((a.get("reservedAmount") ?? 0) + amount > a.get("amount")) throw fail(`Only ₹${a.get("amount") - (a.get("reservedAmount") ?? 0)} of this allocation is left to pay out.`);
    const dRef = db.doc(`donations/${a.get("donationId")}`);
    const d = await tx.get(dRef);
    const ref = db.collection("disbursements").doc();
    id = ref.id;
    tx.create(ref, {
      allocationId, donationId: a.get("donationId"), donorId: a.get("donorId") ?? null, caseId: a.get("caseId") ?? null,
      amount, method, currency: "INR", processedBy: uid, status: needsChecker ? "pending_approval" : "completed",
      proofStatus: proofPath ? "pending" : "none", createdAt: FieldValue.serverTimestamp(),
      ...(referenceKey ? { referenceKey } : {}), ...(proofKey ? { proofKey } : {}),
      ...(needsChecker ? {} : { completedAt: FieldValue.serverTimestamp() }),
    });
    tx.create(ref.collection("private").doc("details"), {
      recipientType: recipientType ?? null, recipientName: recipientName ?? null, referenceNumber: referenceNumber ?? null, proofPath: proofPath ?? null,
    });
    tx.update(aRef, { reservedAmount: FieldValue.increment(amount), ...(needsChecker ? {} : { disbursedAmount: FieldValue.increment(amount) }) });
    if (!needsChecker) {
      tx.update(dRef, { disbursedAmount: FieldValue.increment(amount), donationStatus: (d.get("disbursedAmount") ?? 0) + amount >= d.get("amount") ? "disbursed" : "partially_disbursed" });
      queue(notes, a.get("donorId"), "disbursed", "Your allocated funds have been disbursed.", `/donations/detail?id=${a.get("donationId")}`);
    }
    audit(db, tx, { action: needsChecker ? "DISBURSEMENT_CREATED" : "DISBURSEMENT_COMPLETED", actor: uid, entityType: "disbursement", entityId: ref.id, newValue: { allocationId, amount, method } });
  });
  await flush(db, notes);
  await refreshTransparency(db);
  return { ok: true, id, needsApproval: needsChecker };
});

/** The checker approves or rejects. It cannot be the person who created it. */
exports.decideDisbursement = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { id, approve, reason } = req.data ?? {};
  if (typeof id !== "string" || typeof approve !== "boolean") throw new HttpsError("invalid-argument", "A disbursement and a decision are required.");
  if (!approve && !(typeof reason === "string" && reason.trim().length >= 5)) throw new HttpsError("invalid-argument", "Say why it is rejected.");
  const notes = [];
  const pend = await db.doc(`disbursements/${id}`).get();
  if (pend.exists && pend.get("caseId")) {
    const cs = await db.doc(`cases/${pend.get("caseId")}`).get();
    if (cs.exists) await assertNotOwnCase(db, uid, cs.data());
  }
  await db.runTransaction(async (tx) => {
    notes.length = 0;
    const ref = db.doc(`disbursements/${id}`);
    const s = await tx.get(ref);
    if (!s.exists || s.get("status") !== "pending_approval") throw fail("That payout is not waiting for approval.");
    if (s.get("processedBy") === uid) throw new HttpsError("permission-denied", "A different admin must approve this payout.");
    const aRef = db.doc(`allocations/${s.get("allocationId")}`);
    const dRef = db.doc(`donations/${s.get("donationId")}`);
    const d = await tx.get(dRef);
    const amount = s.get("amount");
    if (approve) {
      tx.update(ref, { status: "completed", approvedBy: uid, completedAt: FieldValue.serverTimestamp() });
      tx.update(aRef, { disbursedAmount: FieldValue.increment(amount) });
      tx.update(dRef, { disbursedAmount: FieldValue.increment(amount), donationStatus: (d.get("disbursedAmount") ?? 0) + amount >= d.get("amount") ? "disbursed" : "partially_disbursed" });
      queue(notes, s.get("donorId"), "disbursed", "Your allocated funds have been disbursed.", `/donations/detail?id=${s.get("donationId")}`);
    } else {
      tx.update(ref, { status: "rejected", rejectedBy: uid, rejectionReason: reason });
      tx.update(aRef, { reservedAmount: FieldValue.increment(-amount) });
    }
    audit(db, tx, { action: approve ? "DISBURSEMENT_APPROVED" : "DISBURSEMENT_REJECTED", actor: uid, entityType: "disbursement", entityId: id, oldValue: { status: "pending_approval" }, newValue: { status: approve ? "completed" : "rejected" }, reason: reason ?? null });
  });
  await flush(db, notes);
  await refreshTransparency(db);
  return { ok: true };
});

/** A second pair of eyes confirms the proof (receipt, invoice, transfer). Donors only ever see "proof verified". */
exports.verifyDisbursementProof = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { id } = req.data ?? {};
  if (typeof id !== "string") throw new HttpsError("invalid-argument", "A disbursement is required.");
  const ref = db.doc(`disbursements/${id}`);
  const s = await ref.get();
  if (!s.exists || s.get("proofStatus") !== "pending") throw fail("There is no proof waiting for review.");
  if (s.get("processedBy") === uid) throw new HttpsError("permission-denied", "Someone other than the person who paid out must review the proof.");
  await ref.update({ proofStatus: "verified", proofVerifiedBy: uid, proofVerifiedAt: FieldValue.serverTimestamp() });
  await audit(db, null, { action: "PROOF_VERIFIED", actor: uid, entityType: "disbursement", entityId: id });
  return { ok: true };
});

/**
 * The committee marks a paid-out case completed. It is a function, not a client write, so the donors who gave to it
 * are always told, and so the step is audited.
 */
exports.closeCase = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { caseId } = req.data ?? {};
  if (typeof caseId !== "string") throw new HttpsError("invalid-argument", "A case is required.");
  const pre = await db.doc(`cases/${caseId}`).get();
  if (pre.exists) await assertNotOwnCase(db, uid, pre.data());
  const allocs = await db.collection("allocations").where("caseId", "==", caseId).where("status", "==", "allocated").get();
  const notes = [];
  await db.runTransaction(async (tx) => {
    notes.length = 0;
    const ref = db.doc(`cases/${caseId}`);
    const s = await tx.get(ref);
    if (!s.exists || s.get("status") !== "disbursed") throw fail("Only a paid-out case can be marked completed.");
    const c = s.data();
    tx.update(ref, { status: "closed", closedBy: uid, closedAt: FieldValue.serverTimestamp() });
    caseEvent(db, tx, c, caseId, "closed", uid);
    // One notice per donor, linking to the first donation of theirs that went to this case.
    const told = new Set();
    for (const a of allocs.docs) {
      const donor = a.get("donorId");
      if (!donor || told.has(donor)) continue;
      told.add(donor);
      queue(notes, donor, "completed", `Case ${caseRefOf(c) ?? caseId} has been marked completed.`, `/donations/detail?id=${a.get("donationId")}`);
    }
    audit(db, tx, { action: "CASE_COMPLETED", actor: uid, entityType: "case", entityId: caseId, oldValue: { status: "disbursed" }, newValue: { status: "closed" } });
  });
  await flush(db, notes);
  await refreshTransparency(db);
  return { ok: true };
});

/** Run the books. Returns every place the numbers do not agree. An empty list means everything reconciles. */
exports.reconcileFunds = onCall(REGION, async (req) => {
  await requireAdmin(req);
  const [d, a] = await Promise.all([db.collection("donations").where("status", "==", "paid").get(), db.collection("allocations").get()]);
  const byDonation = new Map();
  a.docs.forEach((x) => byDonation.set(x.get("donationId"), [...(byDonation.get(x.get("donationId")) ?? []), { id: x.id, ...x.data() }]));
  const warnings = [];
  d.docs.forEach((x) => reconcileDonation(x.data(), byDonation.get(x.id) ?? []).forEach((p) => warnings.push({ donation: x.get("publicReference") ?? x.id, problem: p })));
  return { warnings, checked: d.size };
});

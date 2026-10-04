// Running the fraud and conflict-of-interest checks, and recording a person's decision on each flag.
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { caseRefOf } = require("./lib/allocation");
const { detectFraud } = require("./lib/fraud");
const { audit } = require("./lib/settle");

const db = getFirestore();
const REGION = { region: "asia-south1" };
const STAFF_ROLES = ["verifier", "trustee", "admin", "super_admin", "owner"];

async function requireStaff(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!STAFF_ROLES.includes(me.get("role"))) throw new HttpsError("permission-denied", "Committee staff only.");
  return req.auth.uid;
}
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Compute every flag now, with any decision already recorded attached. Nothing is changed by running it. */
exports.runFraudChecks = onCall(REGION, async (req) => {
  await requireStaff(req);
  const [cases, members, donations, allocations, disbursements, reviews] = await Promise.all(
    ["cases", "members", "donations", "allocations", "disbursements", "fraudReviews"].map(async (c) => rows(await db.collection(c).get())),
  );
  const flags = detectFraud({ cases: cases.map((c) => ({ ...c, ref: caseRefOf(c) })), members, donations, allocations, disbursements });
  const decided = new Map(reviews.map((r) => [r.id, r]));
  const ref = new Map(cases.map((c) => [c.id, caseRefOf(c)]));
  return {
    flags: flags.map((f) => {
      const r = decided.get(f.id);
      return { ...f, caseRef: f.caseId ? ref.get(f.caseId) ?? null : null, otherCaseRef: f.otherCaseId ? ref.get(f.otherCaseId) ?? null : null, decision: r ? { status: r.status, note: r.note ?? null, by: r.by } : null };
    }),
    checkedAt: new Date().toISOString(),
  };
});

/**
 * A person decides a flag: "clear" (checked, not a problem) or "confirmed" (it is a problem). Both need a note, and both
 * are audited. Confirming does not block anything by itself: it puts the finding on record for the committee to act on.
 */
exports.decideFraudFlag = onCall(REGION, async (req) => {
  const uid = await requireStaff(req);
  const { id, kind, status, note } = req.data ?? {};
  if (typeof id !== "string" || id.length > 300 || typeof kind !== "string" || !["clear", "confirmed"].includes(status)) throw new HttpsError("invalid-argument", "A flag and a decision are required.");
  if (typeof note !== "string" || note.trim().length < 5) throw new HttpsError("invalid-argument", "Say how you checked it (at least a few words).");
  const ref = db.doc(`fraudReviews/${id}`);
  const before = await ref.get();
  await ref.set({ kind, status, note: note.trim().slice(0, 300), by: uid, at: FieldValue.serverTimestamp() });
  await audit(db, null, { action: "FRAUD_FLAG_DECIDED", actor: uid, entityType: "fraudFlag", entityId: id, oldValue: before.exists ? { status: before.get("status") } : null, newValue: { status }, reason: note.trim().slice(0, 300) });
  return { ok: true };
});

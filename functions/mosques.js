// Mosque verification, staff only. The mosques collection is public to read and writable ONLY here, so every change is
// validated (lib/mosques.js), stamped with who and when, and written to the audit log in the same transaction.
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { audit } = require("./lib/settle");
const { VERIFIED, validatePatch } = require("./lib/mosques");

const db = getFirestore();
const REGION = { region: "asia-south1" };
const STAFF_ROLES = ["verifier", "trustee", "admin", "super_admin", "owner"];

async function requireStaff(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!STAFF_ROLES.includes(me.get("role"))) throw new HttpsError("permission-denied", "Committee staff only.");
  return { uid: req.auth.uid, name: me.get("fullName") ?? req.auth.uid };
}

exports.verifyMosque = onCall(REGION, async (req) => {
  const who = await requireStaff(req);
  const { id, changes: patch, reason } = req.data ?? {};
  if (typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "id is required.");

  return db.runTransaction(async (tx) => {
    const ref = db.doc(`mosques/${id}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "No such mosque.");
    const current = snap.data();

    let result;
    try {
      result = validatePatch(current, patch);
    } catch (e) {
      if (e.code === "invalid") throw new HttpsError("invalid-argument", e.message);
      throw e;
    }
    const { changes, oldValue } = result;
    if (Object.keys(changes).length === 0) return { changed: [] };

    const update = { ...changes, lastCheckedAt: FieldValue.serverTimestamp() };
    const nextStatus = changes.verificationStatus ?? current.verificationStatus;
    if (VERIFIED.includes(nextStatus)) {
      update.verifiedAt = FieldValue.serverTimestamp();
      update.verifiedBy = who.uid;
    } else if (changes.verificationStatus) {
      // moving back out of verified clears the stamp, so a stale tick never vouches for changed details
      update.verifiedAt = null;
      update.verifiedBy = null;
    }
    // a verified Friday time carries who confirmed it and when
    if (changes.jummahSchedules) {
      update.jummahSchedules = changes.jummahSchedules.map((s) => (s.status === "VERIFIED" ? { ...s, verifiedBy: who.uid, verifiedAt: new Date().toISOString() } : s));
    }
    tx.update(ref, update);
    audit(db, tx, {
      action: "MOSQUE_UPDATED",
      actor: who.uid,
      entityType: "mosque",
      entityId: id,
      oldValue,
      newValue: changes,
      reason: typeof reason === "string" ? reason.slice(0, 300) : null,
    });
    return { changed: Object.keys(changes) };
  });
});

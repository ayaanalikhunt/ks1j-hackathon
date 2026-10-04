// Preventing conflicts of interest where money moves. The checks in lib/fraud.js find them afterwards; these stop them.
const { HttpsError } = require("firebase-functions/v2/https");

/** Is `uid` the applicant, or in the same household as the applicant? */
async function sameAsApplicant(db, uid, applicantId) {
  if (!uid || !applicantId) return false;
  if (uid === applicantId) return true;
  const [a, b] = await Promise.all([db.doc(`members/${uid}`).get(), db.doc(`members/${applicantId}`).get()]);
  const h = a.get("householdId");
  return !!h && h === b.get("householdId");
}

/** A committee member may not act on a case that is their own, or their household's. */
async function assertNotOwnCase(db, actorId, caseData) {
  if (await sameAsApplicant(db, actorId, caseData?.applicantId)) {
    throw new HttpsError("permission-denied", "You cannot act on a case that is yours or your household's. Ask another admin.");
  }
}

/** Money from a donor must not go back to that donor's own case or household. */
async function assertDonorIsNotApplicant(db, donorId, caseData) {
  if (await sameAsApplicant(db, donorId, caseData?.applicantId)) {
    throw new HttpsError("failed-precondition", "A donation cannot go to your own case or your household's.");
  }
}

module.exports = { sameAsApplicant, assertNotOwnCase, assertDonorIsNotApplicant };

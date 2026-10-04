// The committee's financial report. Admins only: it covers money across every donation, payout and loan.
const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { caseRefOf } = require("./lib/allocation");
const { buildReport } = require("./lib/report");
const { numberFromRef } = require("./lib/timeline");

const db = getFirestore();
const REGION = { region: "asia-south1" };
const ADMIN_ROLES = ["admin", "super_admin", "owner"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!ADMIN_ROLES.includes(me.get("role"))) throw new HttpsError("permission-denied", "Admins only.");
}

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/**
 * Filters: from / to (YYYY-MM-DD, India time), category (donation purpose), status, currency (the donor's original
 * currency), caseRef (CASE-YYYY-NNNNNN), memberId (the committee member who approved an allocation or paid out).
 */
exports.getFinancialReport = onCall(REGION, async (req) => {
  await requireAdmin(req);
  const f = req.data ?? {};
  for (const k of ["from", "to"]) if (f[k] && !DAY.test(f[k])) throw new HttpsError("invalid-argument", `${k} must be a date.`);
  for (const k of ["category", "status", "currency", "caseRef", "memberId"]) if (f[k] !== undefined && f[k] !== "" && typeof f[k] !== "string") throw new HttpsError("invalid-argument", `${k} is invalid.`);

  const [donations, allocations, disbursements, cases, loans] = await Promise.all(
    ["donations", "allocations", "disbursements", "cases", "loans"].map(async (c) => rows(await db.collection(c).get())),
  );
  const withRef = cases.map((c) => ({ ...c, ref: caseRefOf(c) }));

  let caseId;
  if (f.caseRef) {
    const n = numberFromRef(f.caseRef);
    const hit = n ? withRef.find((c) => c.number === n) : null;
    if (!hit) throw new HttpsError("not-found", "No case with that reference.");
    caseId = hit.id;
  }
  return buildReport({ donations, allocations, disbursements, cases: withRef, loans }, { from: f.from, to: f.to, category: f.category || undefined, status: f.status || undefined, currency: f.currency || undefined, memberId: f.memberId || undefined, caseId });
});

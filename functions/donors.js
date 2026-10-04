// The committee's view of donors. A donor's identity is private: only admins can see it, it is fetched through these
// functions (never straight from the database), and every time someone opens a donor's details it is written to the audit log.
const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { audit } = require("./lib/settle");

const db = getFirestore();
const REGION = { region: "asia-south1" };
const ADMIN_ROLES = ["admin", "super_admin", "owner"];

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!ADMIN_ROLES.includes(me.get("role"))) throw new HttpsError("permission-denied", "Admins only.");
  return req.auth.uid;
}

const iso = (t) => (t && typeof t.toDate === "function" ? t.toDate().toISOString() : null);

/** Everyone who has donated or set up a donor profile, with their totals. No email or phone number in the list. */
exports.listDonors = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const [donations, profiles] = await Promise.all([db.collection("donations").get(), db.collection("donors").get()]);
  const byDonor = new Map();
  for (const d of donations.docs) {
    const payer = d.get("payerId") ?? d.get("donorId");
    if (!payer) continue;
    const row = byDonor.get(payer) ?? { count: 0, total: 0, last: null };
    if (d.get("status") === "paid") {
      row.count += 1;
      row.total += d.get("amount") ?? 0;
    }
    const at = d.get("createdAt")?.toMillis?.() ?? 0;
    if (at > (row.last ?? 0)) row.last = at;
    byDonor.set(payer, row);
  }
  const profile = new Map(profiles.docs.map((p) => [p.id, p.data()]));
  const ids = [...new Set([...byDonor.keys(), ...profile.keys()])];
  const members = await Promise.all(ids.map((id) => db.doc(`members/${id}`).get()));
  const donors = ids
    .map((id, i) => {
      const p = profile.get(id);
      const s = byDonor.get(id);
      return {
        id,
        name: p?.fullName || members[i].get("fullName") || "A donor",
        country: p?.country ?? null,
        preferredCurrency: p?.preferredCurrency ?? null,
        hasProfile: !!p,
        donationCount: s?.count ?? 0,
        totalDonated: s?.total ?? 0,
        lastDonationAt: s?.last ? new Date(s.last).toISOString() : null,
      };
    })
    .sort((a, b) => b.totalDonated - a.totalDonated);
  await audit(db, null, { action: "DONOR_LIST_VIEWED", actor: uid, entityType: "donorList", entityId: "all", newValue: { count: donors.length } });
  return { donors };
});

/** One donor in full: their details and their donations. Never anything about a beneficiary. Recorded in the audit log. */
exports.getDonor = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const { donorId } = req.data ?? {};
  if (typeof donorId !== "string" || !donorId) throw new HttpsError("invalid-argument", "A donor is required.");
  const [p, m, mine] = await Promise.all([
    db.doc(`donors/${donorId}`).get(),
    db.doc(`members/${donorId}`).get(),
    db.collection("donations").where("payerId", "==", donorId).get(),
  ]);
  if (!p.exists && !m.exists && mine.empty) throw new HttpsError("not-found", "No such donor.");
  const donations = mine.docs
    .map((d) => ({
      id: d.id,
      publicReference: d.get("publicReference") ?? null,
      amount: d.get("amount") ?? 0,
      displayCurrency: d.get("displayCurrency") ?? "INR",
      displayAmount: d.get("displayAmount") ?? null,
      purpose: d.get("purpose") ?? null,
      status: d.get("status") ?? null,
      visibility: d.get("visibility") ?? (d.get("anonymous") ? "anonymous" : null),
      allocatedAmount: d.get("allocatedAmount") ?? 0,
      disbursedAmount: d.get("disbursedAmount") ?? 0,
      createdAt: iso(d.get("createdAt")),
    }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const paid = donations.filter((d) => d.status === "paid");
  await audit(db, null, { action: "DONOR_PROFILE_VIEWED", actor: uid, entityType: "donor", entityId: donorId });
  return {
    id: donorId,
    profile: p.exists
      ? { fullName: p.get("fullName") ?? null, displayName: p.get("displayName") ?? null, email: p.get("email") ?? null, phone: p.get("phone") ?? null, country: p.get("country") ?? null, preferredCurrency: p.get("preferredCurrency") ?? null, notifications: p.get("notifications") ?? null, createdAt: iso(p.get("createdAt")) }
      : null,
    member: m.exists ? { fullName: m.get("fullName") ?? null, role: m.get("role") ?? null } : null,
    totals: { paidCount: paid.length, paidTotal: paid.reduce((s, d) => s + d.amount, 0), allocated: paid.reduce((s, d) => s + d.allocatedAmount, 0), disbursed: paid.reduce((s, d) => s + d.disbursedAmount, 0) },
    donations,
  };
});

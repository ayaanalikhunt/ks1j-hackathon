// The public transparency totals, recomputed from the verified records after every money movement.
// Best effort: a failure here never undoes a payment, and the next movement repairs it.
const { FieldValue } = require("firebase-admin/firestore");
const { summarize } = require("./allocation");

async function refreshTransparency(db) {
  try {
    const [d, a, c, l] = await Promise.all([
      db.collection("donations").where("status", "==", "paid").get(),
      db.collection("allocations").get(),
      db.collection("cases").get(),
      db.collection("loans").get(),
    ]);
    const data = summarize({
      donations: d.docs.map((x) => x.data()),
      allocations: a.docs.map((x) => x.data()),
      cases: c.docs.map((x) => x.data()),
      loans: l.docs.map((x) => x.data()),
    });
    await db.doc("publicStats/transparency").set({ ...data, updatedAt: FieldValue.serverTimestamp() });
  } catch (e) {
    console.error("refreshTransparency failed", e);
  }
}

module.exports = { refreshTransparency };

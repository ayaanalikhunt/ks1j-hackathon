// Donor notifications. A donor chooses which ones they want (donors/{uid}.notifications); the server honours that.
// Written after the money transaction commits, so a notification problem can never undo or delay a payment.
const { FieldValue } = require("firebase-admin/firestore");

/** What a donor can switch on or off. In-app only: there is no email or SMS channel. */
const NOTIFICATION_TYPES = ["received", "allocated", "disbursed", "refunded", "completed"];

/** Collect a notification during a transaction (the transaction may retry, so callers clear the list at the start). */
function queue(list, userId, type, text, link) {
  if (userId && NOTIFICATION_TYPES.includes(type)) list.push({ userId, type, text, link: link ?? null });
}

/** A preference is on unless the donor has explicitly turned it off. */
const wanted = (prefs, type) => !prefs || prefs[type] !== false;

async function flush(db, list) {
  const cache = new Map();
  for (const n of list) {
    try {
      if (!cache.has(n.userId)) cache.set(n.userId, (await db.doc(`donors/${n.userId}`).get()).get("notifications") ?? null);
      if (!wanted(cache.get(n.userId), n.type)) continue;
      await db.collection("notifications").add({ ...n, read: false, at: FieldValue.serverTimestamp() });
    } catch (e) {
      console.error("notification failed", e);
    }
  }
}

module.exports = { NOTIFICATION_TYPES, queue, flush, wanted };

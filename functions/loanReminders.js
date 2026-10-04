// The daily loan reminder run, and the staff follow-ups it creates. Reminders are in-app notifications to the borrower;
// from 15 days late a task is opened for a person to reach out. There is no email or SMS channel.
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { planReminders, istToday } = require("./lib/reminders");
const { audit } = require("./lib/settle");

const db = getFirestore();
const REGION = { region: "asia-south1" };
const ADMIN_ROLES = ["admin", "super_admin", "owner"];
const FOLLOW_UP_ROLES = ["trustee", "admin", "super_admin", "owner"];

const isExists = (e) => e?.code === 6 || /ALREADY_EXISTS/.test(String(e?.message));

/** Plan today's reminders and send them. Safe to run twice: each reminder is claimed once per loan, due date and step. */
async function runLoanReminders(now = new Date()) {
  const today = istToday(now);
  const [loans, hardships, sent] = await Promise.all([
    db.collection("loans").where("status", "in", ["disbursed", "repaying"]).get(),
    db.collection("hardships").where("status", "==", "pending").get(),
    db.collection("loanReminders").get(),
  ]);
  const plan = planReminders({
    loans: loans.docs.map((d) => ({ id: d.id, ...d.data() })),
    pausedLoanIds: new Set(hardships.docs.map((d) => d.get("loanId"))),
    sentKeys: new Set(sent.docs.map((d) => d.id)),
    today,
  });
  let reminders = 0;
  let tasks = 0;
  for (const p of plan) {
    try {
      await db.doc(`loanReminders/${p.key}`).create({ loanId: p.loanId, dueDate: p.dueDate, kind: p.kind, borrowerId: p.borrowerId, at: FieldValue.serverTimestamp() });
    } catch (e) {
      if (isExists(e)) continue; // another run already sent it
      throw e;
    }
    await db.collection("notifications").add({ userId: p.borrowerId, type: "loan_reminder", text: p.text, link: null, read: false, at: FieldValue.serverTimestamp() });
    reminders++;
    if (p.task) {
      try {
        await db.doc(`loanFollowUps/${p.task.id}`).create({ ...p.task, status: "open", createdAt: FieldValue.serverTimestamp() });
        tasks++;
      } catch (e) {
        if (!isExists(e)) throw e;
      }
    }
  }
  return { checked: loans.size, reminders, tasks, today };
}

/** Every morning at 9, India time. */
exports.loanRemindersDaily = onSchedule({ ...REGION, schedule: "0 9 * * *", timeZone: "Asia/Kolkata" }, async () => {
  const r = await runLoanReminders();
  console.log("loan reminders", r);
});

/** An admin can run it now, for example after changing something or to check it works. */
exports.runLoanReminders = onCall(REGION, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!ADMIN_ROLES.includes(me.get("role"))) throw new HttpsError("permission-denied", "Admins only.");
  // A pretend date is allowed only on the local emulator, so a real run can never claim reminders for a future day.
  const pretend = process.env.FUNCTIONS_EMULATOR === "true" && typeof req.data?.asOf === "string" ? new Date(`${req.data.asOf}T06:00:00Z`) : null;
  return runLoanReminders(pretend ?? new Date());
});

/** A person records that they reached out, and what happened. */
exports.completeLoanFollowUp = onCall(REGION, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!FOLLOW_UP_ROLES.includes(me.get("role"))) throw new HttpsError("permission-denied", "Trustees and admins only.");
  const { id, note } = req.data ?? {};
  if (typeof id !== "string" || typeof note !== "string" || note.trim().length < 5) throw new HttpsError("invalid-argument", "Say what happened (at least a few words).");
  const ref = db.doc(`loanFollowUps/${id}`);
  const s = await ref.get();
  if (!s.exists || s.get("status") !== "open") throw new HttpsError("failed-precondition", "That follow-up is not open.");
  await ref.update({ status: "done", note: note.trim().slice(0, 300), doneBy: req.auth.uid, doneAt: FieldValue.serverTimestamp() });
  await audit(db, null, { action: "LOAN_FOLLOW_UP_DONE", actor: req.auth.uid, entityType: "loanFollowUp", entityId: id, reason: note.trim().slice(0, 300) });
  return { ok: true };
});


// Loan repayment reminders. Pure planning: given the loans and what has already been sent, decide what to send today.
// The tone is fixed and kind: no interest, no late fee, no threat. From 15 days late a person reaches out.
const MS_DAY = 86_400_000;
const utc = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
/** Whole days from one YYYY-MM-DD date to another (negative if `to` is earlier). */
const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / MS_DAY);
const dmy = (iso) => iso.split("-").reverse().join("/");
const rupees = (n) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

/** Today's date in India, as YYYY-MM-DD. */
function istToday(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** In order. A loan gets the latest one it has reached that has not been sent for its current due date. */
const STEPS = [
  ["upcoming", -3],
  ["due_today", 0],
  ["late_1", 1],
  ["late_7", 7],
  ["late_14", 14],
  ["follow_up", 15],
];
const ACT_AFTER_DAYS = 15;

function stepFor(late) {
  let hit = null;
  for (const [kind, from] of STEPS) if (late >= from) hit = kind;
  return hit;
}

function textFor(kind, amount, dueDate) {
  const a = rupees(amount);
  const d = dmy(dueDate);
  switch (kind) {
    case "upcoming":
      return `Your instalment of ${a} is due on ${d}. There is no interest and no late fee.`;
    case "due_today":
      return `Your instalment of ${a} is due today. Thank you for repaying. There is no late fee.`;
    case "follow_up":
      return `Your instalment of ${a} was due on ${d}. A member of the committee will get in touch to help. There is no late fee, ever.`;
    default:
      return `Your instalment of ${a} was due on ${d}. If paying is difficult, you can ask for a pause or a lower amount from My loans. There is no late fee, ever.`;
  }
}

/**
 * @param p { loans, pausedLoanIds: Set, sentKeys: Set, today }  loans are plain documents with an `id`
 * @returns [{ key, loanId, kind, borrowerId, text, task? }]
 */
function planReminders({ loans, pausedLoanIds, sentKeys, today }) {
  const out = [];
  for (const l of loans) {
    if (!["disbursed", "repaying"].includes(l.status) || !l.nextDue || !l.borrowerId) continue;
    if (pausedLoanIds.has(l.id)) continue; // a hardship request is waiting for a trustee: no reminders until it is decided
    const left = (l.principal ?? 0) - (l.repaid ?? 0);
    if (!(l.emi > 0) || left <= 0) continue;
    const amount = Math.min(l.emi, left);
    const late = daysBetween(l.nextDue, today);
    const kind = stepFor(late);
    if (!kind) continue;
    const key = `${l.id}_${l.nextDue}_${kind}`;
    if (sentKeys.has(key)) continue;
    const item = { key, loanId: l.id, kind, borrowerId: l.borrowerId, dueDate: l.nextDue, text: textFor(kind, amount, l.nextDue) };
    if (late >= ACT_AFTER_DAYS) {
      item.task = { id: `${l.id}_${l.nextDue}`, loanId: l.id, loanRef: l.publicLoanId ?? null, dueDate: l.nextDue, daysLate: late, emi: amount, left, guarantorName: l.guarantorName ?? null, guarantorPhone: l.guarantorPhone ?? null };
    }
    out.push(item);
  }
  return out;
}

module.exports = { planReminders, stepFor, textFor, istToday, daysBetween, STEPS, ACT_AFTER_DAYS };

// Fraud and conflict-of-interest checks. Every result is a question for a person, never a verdict, and nothing here is
// ever acted on automatically. Pure functions over the committee's own records, so they are tested directly.
// Output holds ids, references and amounts only: no names, phone numbers or addresses leave this file.
const crypto = require("node:crypto");

const MINUTES = 60_000;
const dateOf = (t) => (t && typeof t.toDate === "function" ? t.toDate() : null);

const digits = (s) => String(s ?? "").replace(/\D/g, "");
const words = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
const normText = (s) => words(s).join(" ");

/** A short, stable key for a reference number or proof path, so duplicates can be found without storing it in the open. */
function keyOf(value) {
  const n = String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return n.length >= 4 ? crypto.createHash("sha256").update(n).digest("hex") : null;
}

function jaccard(a, b) {
  const x = new Set(words(a).filter((w) => w.length >= 3));
  const y = new Set(words(b).filter((w) => w.length >= 3));
  if (x.size < 3 || y.size < 3) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

const pairId = (kind, a, b) => `${kind}__${[a, b].sort().join("__")}`;

const SEVERITY = { duplicate_beneficiary: "high", similar_request: "medium", duplicate_donation: "medium", reused_payment_id: "high", duplicate_disbursement: "high", reused_reference: "high", reused_proof: "high", conflict_of_interest: "high" };

/**
 * @param d { cases, members, donations, allocations, disbursements }  plain documents, each with an `id`
 * @returns flags: { id, kind, severity, summary, ...ids }
 */
function detectFraud(d) {
  const flags = [];
  const add = (f) => flags.push({ severity: SEVERITY[f.kind], ...f });
  const caseRef = (c) => c.ref ?? c.id;
  const live = d.cases.filter((c) => c.status !== "draft" && c.status !== "declined");
  const household = new Map(d.members.map((m) => [m.id, m.householdId || ""]));

  // ---- duplicate beneficiary: different applicants who look like the same person or household
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (a.applicantId === b.applicantId) continue; // the same applicant is the older "same applicant" flag
      const why = [];
      const pa = digits(a.applicantPhone).slice(-10);
      const pb = digits(b.applicantPhone).slice(-10);
      if (pa.length >= 8 && pa === pb) why.push("the same phone number");
      if (a.idLast4 && a.idLast4 === b.idLast4 && normText(a.applicantName) && normText(a.applicantName) === normText(b.applicantName)) why.push("the same name and ID digits");
      const aa = normText(a.applicantAddress);
      if (aa.length >= 12 && aa === normText(b.applicantAddress)) why.push("the same address");
      if (why.length) add({ id: pairId("duplicate_beneficiary", a.id, b.id), kind: "duplicate_beneficiary", caseId: a.id, otherCaseId: b.id, summary: `Cases ${caseRef(a)} and ${caseRef(b)} share ${why.join(" and ")}.` });
      // ---- similar request: same kind of need, near the same amount, nearly the same words
      else if (a.type && a.type === b.type && a.amountRequested && b.amountRequested && Math.abs(a.amountRequested - b.amountRequested) / Math.max(a.amountRequested, b.amountRequested) <= 0.05
        && jaccard(`${a.title} ${a.requirement}`, `${b.title} ${b.requirement}`) >= 0.8) {
        add({ id: pairId("similar_request", a.id, b.id), kind: "similar_request", caseId: a.id, otherCaseId: b.id, summary: `Cases ${caseRef(a)} and ${caseRef(b)} ask for nearly the same amount in nearly the same words.` });
      }
    }
  }

  // ---- duplicate donations
  const paidish = d.donations.filter((x) => x.status === "paid" || x.status === "pending");
  for (let i = 0; i < paidish.length; i++) {
    for (let j = i + 1; j < paidish.length; j++) {
      const a = paidish[i];
      const b = paidish[j];
      const payer = a.payerId ?? a.donorId;
      if (!payer || payer !== (b.payerId ?? b.donorId)) continue;
      const ta = dateOf(a.createdAt);
      const tb = dateOf(b.createdAt);
      const target = (x) => `${x.caseId ?? ""}|${x.institutionId ?? ""}|${x.purpose ?? ""}`;
      if (a.amount === b.amount && target(a) === target(b) && ta && tb && Math.abs(ta - tb) <= 10 * MINUTES) {
        add({ id: pairId("duplicate_donation", a.id, b.id), kind: "duplicate_donation", donationId: a.id, otherDonationId: b.id, summary: `${a.publicReference ?? a.id} and ${b.publicReference ?? b.id} are the same amount for the same purpose from one donor within ten minutes. Possibly a double payment.` });
      }
    }
  }
  const byPayment = new Map();
  for (const x of d.donations.filter((x) => x.paymentId)) byPayment.set(x.paymentId, [...(byPayment.get(x.paymentId) ?? []), x]);
  for (const [pid, list] of byPayment) {
    for (let i = 1; i < list.length; i++) add({ id: pairId("reused_payment_id", list[0].id, list[i].id), kind: "reused_payment_id", donationId: list[0].id, otherDonationId: list[i].id, summary: `One payment (${pid}) is attached to ${list.length} donations.` });
  }

  // ---- duplicate disbursements and reused receipts
  const done = d.disbursements.filter((x) => x.status === "completed" || x.status === "pending_approval");
  for (let i = 0; i < done.length; i++) {
    for (let j = i + 1; j < done.length; j++) {
      const a = done[i];
      const b = done[j];
      const ta = dateOf(a.createdAt);
      const tb = dateOf(b.createdAt);
      if (a.allocationId === b.allocationId && a.amount === b.amount && a.method === b.method && ta && tb && Math.abs(ta - tb) <= 24 * 60 * MINUTES) {
        add({ id: pairId("duplicate_disbursement", a.id, b.id), kind: "duplicate_disbursement", disbursementId: a.id, otherDisbursementId: b.id, summary: `Two payouts of the same amount and method from one allocation within a day.` });
      }
      if (a.referenceKey && a.referenceKey === b.referenceKey) add({ id: pairId("reused_reference", a.id, b.id), kind: "reused_reference", disbursementId: a.id, otherDisbursementId: b.id, summary: `Two payouts quote the same transfer reference number.` });
      if (a.proofKey && a.proofKey === b.proofKey) add({ id: pairId("reused_proof", a.id, b.id), kind: "reused_proof", disbursementId: a.id, otherDisbursementId: b.id, summary: `Two payouts use the same proof document.` });
    }
  }

  // ---- conflicts of interest: someone acting on a case that is theirs, or their household's
  const conflicted = (actor, applicant) => !!actor && !!applicant && (actor === applicant || (!!household.get(actor) && household.get(actor) === household.get(applicant)));
  const caseById = new Map(d.cases.map((c) => [c.id, c]));
  const seen = new Set();
  const coi = (memberId, c, role) => {
    const id = `conflict_of_interest__${c.id}__${memberId}__${role}`;
    if (seen.has(id)) return;
    seen.add(id);
    add({ id, kind: "conflict_of_interest", caseId: c.id, memberId, summary: `A committee member who ${role} case ${caseRef(c)} is the applicant or in the applicant's household.` });
  };
  for (const c of d.cases) {
    for (const [field, role] of [["verifiedBy", "verified"], ["approvedBy", "approved"], ["publishedBy", "published"], ["disbursedBy", "paid out"], ["closedBy", "closed"]]) {
      if (conflicted(c[field], c.applicantId)) coi(c[field], c, role);
    }
  }
  for (const a of d.allocations) {
    const c = caseById.get(a.caseId);
    if (!c) continue;
    if (conflicted(a.approvedBy, c.applicantId)) coi(a.approvedBy, c, "allocated money to");
    // a donor funding their own case, or their own household's
    if (conflicted(a.donorId, c.applicantId)) coi(a.donorId, c, "donated to their own");
  }
  for (const x of d.disbursements) {
    const c = caseById.get(x.caseId);
    if (!c) continue;
    for (const who of [x.processedBy, x.approvedBy]) if (conflicted(who, c.applicantId)) coi(who, c, "paid out");
  }

  return flags;
}

module.exports = { detectFraud, keyOf, jaccard, SEVERITY };

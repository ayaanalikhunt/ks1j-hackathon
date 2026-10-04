// The public view of a case: a timeline built from the real case events, and nothing that identifies anyone.
// Pure, so the privacy guarantee is tested directly. Whatever is not listed here is never returned.

/** Only these events are shown, with only these words. No actor, no note, no donor. */
const PUBLIC_EVENTS = {
  submitted: "Case submitted",
  verified: "Verified by the committee",
  approved: "Approved by a second committee member",
  emergency_exception: "Marked urgent by the committee",
  published: "Opened for donations",
  funded: "Funding completed",
  paid_out: "Funds disbursed",
  closed: "Case completed",
};

/** A case becomes public when it is opened to donors, and stays so through payout and completion. */
const PUBLIC_STATUSES = ["published", "funded", "disbursed", "closed"];

/** CASE-2026-000184 -> 184, or null. Works for old cases that never had the id stored. */
function numberFromRef(ref) {
  const m = /^CASE-\d{4}-(\d{6})$/.exec(String(ref ?? ""));
  return m ? Number(m[1]) : null;
}

const toIso = (t) => (t && typeof t.toDate === "function" ? t.toDate().toISOString() : null);

/**
 * @param c  the case document
 * @param events  caseEvents rows for it
 * @param allocations  allocation rows for it
 * @param disbursements  disbursement rows for it
 */
function buildPublicCase(c, events, allocations, disbursements, caseRef) {
  const timeline = events
    .filter((e) => PUBLIC_EVENTS[e.kind] && toIso(e.at))
    .sort((a, b) => toIso(a.at).localeCompare(toIso(b.at)))
    // one step per kind: the first time it happened
    .filter((e, i, all) => all.findIndex((x) => x.kind === e.kind) === i)
    .map((e) => ({ kind: e.kind, label: PUBLIC_EVENTS[e.kind], at: toIso(e.at) }));

  const live = allocations.filter((a) => a.status === "allocated");
  const disbursed = live.reduce((s, a) => s + (a.disbursedAmount ?? 0), 0);
  const done = disbursements.filter((d) => d.status === "completed");
  const proofReviewed = done.length > 0 && done.every((d) => d.proofStatus === "verified");

  const requested = c.amountRequested ?? 0;
  const raised = c.raised ?? 0;
  return {
    reference: caseRef,
    needCategory: c.needCategory ?? null,
    type: c.type ?? null,
    priority: c.priority ?? "normal",
    emergency: !!c.emergencyException,
    status: c.status,
    requested,
    approved: requested,
    raised,
    disbursed,
    fundingPercent: requested ? Math.min(100, Math.round((raised / requested) * 100)) : 0,
    disbursementPercent: requested ? Math.min(100, Math.round((disbursed / requested) * 100)) : 0,
    // "verified" only when every payout's proof has been reviewed by someone else. Never earlier.
    disbursementNote: done.length === 0 ? null : proofReviewed ? "Disbursement verified. Proof reviewed by the committee." : "Disbursement completed. Supporting documentation is pending committee verification.",
    timeline,
  };
}

/** The short card used in lists. */
function summarizeCase(c, caseRef, disbursed) {
  return {
    reference: caseRef,
    needCategory: c.needCategory ?? null,
    type: c.type ?? null,
    emergency: !!c.emergencyException,
    status: c.status,
    requested: c.amountRequested ?? 0,
    raised: c.raised ?? 0,
    disbursed,
  };
}

module.exports = { PUBLIC_EVENTS, PUBLIC_STATUSES, numberFromRef, buildPublicCase, summarizeCase };

// Pure rules for allocating donations to cases and for reconciling the books. No database, so they are tested directly.

const PURPOSES = [
  "general_support", "ration", "education_fees", "healthcare", "medical_emergency", "housing", "utility_bills", "food",
  "clothing", "travel", "funeral_support", "children_support", "elderly_support", "disability_support", "special_need",
  "zakat", "khums", "sadaqah", "lillah", "other",
];
/** Funds the committee must keep separate. They are only ever spent on a case the committee has marked eligible. */
const RESTRICTED = ["zakat", "khums"];
const VISIBILITY = ["public", "private", "anonymous"];

/**
 * May this donation's money go to this case? Restricted purposes are never treated as general money.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
function canAllocate(donation, c) {
  if (!c) return { ok: false, reason: "No such case." };
  if (!["published", "funded"].includes(c.status)) return { ok: false, reason: "That case is not open for funding." };
  if (donation.fund === "sehme_sadaat" && !c.beneficiarySadaatVerified) {
    return { ok: false, reason: "Sehme Sadaat money can only go to a verified Sadaat case." };
  }
  if (donation.purpose === "zakat" && c.zakatEligible !== true) {
    return { ok: false, reason: "This is Zakat. The committee has not marked that case Zakat-eligible." };
  }
  if (donation.purpose === "khums" && !(c.khumsEligible === true || c.beneficiarySadaatVerified === true)) {
    return { ok: false, reason: "This is Khums. The committee has not marked that case eligible for it." };
  }
  return { ok: true };
}

const ACTIVE = (a) => a.status === "allocated" || a.status === "disbursed";

/** verified amount = allocations + unallocated, and nothing is negative or over-spent. Returns a list of problems (empty = fine). */
function reconcileDonation(donation, allocations) {
  const problems = [];
  const active = allocations.filter(ACTIVE);
  const sum = active.reduce((s, a) => s + a.amount, 0);
  if (sum > donation.amount) problems.push(`Allocations (${sum}) exceed the verified donation (${donation.amount}).`);
  if ((donation.allocatedAmount ?? 0) !== sum) problems.push(`Donation says ${donation.allocatedAmount ?? 0} allocated but the allocations add up to ${sum}.`);
  const disbursed = active.reduce((s, a) => s + (a.disbursedAmount ?? 0), 0);
  if ((donation.disbursedAmount ?? 0) !== disbursed) problems.push(`Donation says ${donation.disbursedAmount ?? 0} disbursed but its allocations show ${disbursed}.`);
  for (const a of active) {
    if ((a.disbursedAmount ?? 0) > a.amount) problems.push(`Allocation ${a.id} is over-disbursed.`);
    if ((a.reservedAmount ?? 0) < (a.disbursedAmount ?? 0)) problems.push(`Allocation ${a.id} has disbursed more than reserved.`);
  }
  return problems;
}

/** Public totals. Only sums and counts: no donor and no beneficiary is named here. */
function summarize({ donations, allocations, cases, loans = [] }) {
  const paid = donations.filter((d) => d.status === "paid");
  const sum = (rows, f) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const assisted = new Set(allocations.filter((a) => ACTIVE(a) && (a.disbursedAmount ?? 0) > 0 && a.caseId).map((a) => a.caseId));
  const count = (...statuses) => cases.filter((c) => statuses.includes(c.status)).length;
  return {
    totalDonated: sum(paid, (d) => d.amount),
    totalAllocated: sum(paid, (d) => d.allocatedAmount),
    totalDisbursed: sum(paid, (d) => d.disbursedAmount),
    donationCount: paid.length,
    casesAssisted: assisted.size,
    casesCompleted: count("disbursed", "closed"),
    casesFunding: count("published"),
    casesUnderReview: count("submitted", "verified", "approved"),
    // loans are counted apart from donations, and only once paid out
    loansLent: sum(loans.filter((l) => ["disbursed", "repaying", "closed"].includes(l.status)), (l) => l.principal),
    loansRepaid: sum(loans.filter((l) => ["disbursed", "repaying", "closed"].includes(l.status)), (l) => Math.min(l.repaid ?? 0, l.principal ?? 0)),
    loansActive: loans.filter((l) => ["disbursed", "repaying"].includes(l.status)).length,
  };
}

/** CASE-2026-000184 for a case, whether or not the id was stored on it. */
function caseRefOf(c, now = new Date()) {
  if (c.publicCaseId) return c.publicCaseId;
  if (!c.number) return null;
  const year = new Date(now.getTime() + 5.5 * 3600_000).getUTCFullYear();
  return `CASE-${year}-${String(c.number).padStart(6, "0")}`;
}

module.exports = { caseRefOf, PURPOSES, RESTRICTED, VISIBILITY, canAllocate, reconcileDonation, summarize };

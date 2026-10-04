// Committee financial report. Pure: given the verified records and some filters, it returns the totals.
// Every number is added up here, on the server, from donations, allocations, payouts, cases and loans. The browser
// only displays what it is given. No donor or beneficiary is named in anything this returns.
const { reconcileDonation } = require("./allocation");

const IST = "+05:30";
const dateOf = (t) => (t && typeof t.toDate === "function" ? t.toDate() : null);
const sum = (rows, f) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
const bump = (map, key, patch) => {
  const row = map.get(key) ?? { amount: 0, count: 0, allocated: 0, disbursed: 0 };
  for (const k of Object.keys(patch)) row[k] += patch[k];
  map.set(key, row);
};

/** "2026-10-04" -> the start (or end) of that day in India, as a Date. Null when empty or invalid. */
function istBound(day, end) {
  if (!day) return null;
  const d = new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}${IST}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param data  { donations, allocations, disbursements, cases, loans } each an array of plain documents with an `id`
 * @param f     { from, to, category, status, currency, caseId, memberId } all optional; dates are YYYY-MM-DD in IST
 */
function buildReport(data, f = {}) {
  const from = istBound(f.from, false);
  const to = istBound(f.to, true);
  const inRange = (t) => {
    const d = dateOf(t);
    if (!from && !to) return true;
    if (!d) return false;
    return (!from || d >= from) && (!to || d <= to);
  };

  // ---- donations: filtered by when they were made, their purpose, status and original currency
  let donations = data.donations.filter(
    (d) =>
      inRange(d.createdAt) &&
      (!f.category || d.purpose === f.category) &&
      (!f.status || d.status === f.status) &&
      (!f.currency || (d.displayCurrency ?? "INR") === f.currency),
  );
  // For one case, a donation counts only for the part that went to that case. A donation split across several cases
  // must not show its whole amount against one of them.
  if (f.caseId) {
    donations = donations
      .map((d) => {
        const mine = data.allocations.filter((a) => a.donationId === d.id && a.caseId === f.caseId && ACTIVE(a));
        if (mine.length === 0) return null;
        const amount = sum(mine, (a) => a.amount);
        return { ...d, amount, allocatedAmount: amount, disbursedAmount: sum(mine, (a) => a.disbursedAmount) };
      })
      .filter(Boolean);
  }
  const donationIds = new Set(donations.map((d) => d.id));
  const paid = donations.filter((d) => d.status === "paid");

  // ---- allocations belong to the donations that passed, and can be narrowed by case, category and committee member
  const allocations = data.allocations.filter(
    (a) =>
      donationIds.has(a.donationId) &&
      ACTIVE(a) &&
      (!f.caseId || a.caseId === f.caseId) &&
      (!f.memberId || a.approvedBy === f.memberId),
  );
  const allocIds = new Set(allocations.map((a) => a.id));
  const disbursements = data.disbursements.filter(
    (x) => x.status === "completed" && allocIds.has(x.allocationId) && (!f.memberId || x.processedBy === f.memberId || x.approvedBy === f.memberId),
  );

  const donated = sum(paid, (d) => d.amount);
  const allocated = sum(allocations, (a) => a.amount);
  const disbursed = sum(allocations, (a) => a.disbursedAmount);
  const refunded = sum(donations.filter((d) => d.status === "refunded"), (d) => d.amount);
  const awaitingVerification = sum(donations.filter((d) => d.status === "pending"), (d) => d.amount);

  // ---- breakdowns
  const byPurpose = new Map();
  for (const d of paid) bump(byPurpose, d.purpose ?? "unspecified", { amount: d.amount, count: 1, allocated: d.allocatedAmount ?? 0, disbursed: d.disbursedAmount ?? 0 });
  const byFund = new Map();
  for (const d of paid) bump(byFund, d.fund ?? "general", { amount: d.amount, count: 1, allocated: d.allocatedAmount ?? 0, disbursed: d.disbursedAmount ?? 0 });
  const byCurrency = new Map();
  for (const d of paid) bump(byCurrency, d.displayCurrency ?? "INR", { amount: d.amount, count: 1 });
  const byCategory = new Map();
  for (const a of allocations) bump(byCategory, a.category ?? "unspecified", { amount: a.amount, count: 1, allocated: a.amount, disbursed: a.disbursedAmount ?? 0 });

  const caseById = new Map(data.cases.map((c) => [c.id, c]));
  const byCase = new Map();
  for (const a of allocations) if (a.caseId) bump(byCase, a.caseId, { amount: a.amount, count: 1, allocated: a.amount, disbursed: a.disbursedAmount ?? 0 });
  const caseRows = [...byCase.entries()]
    .map(([id, v]) => {
      const c = caseById.get(id) ?? {};
      return { reference: c.ref ?? null, status: c.status ?? "unknown", requested: c.amountRequested ?? 0, raised: c.raised ?? 0, allocated: v.allocated, disbursed: v.disbursed };
    })
    .sort((a, b) => b.allocated - a.allocated);

  // ---- case pipeline. These are the committee's own queues, so they ignore the donation filters.
  const cases = data.cases;
  const count = (...s) => cases.filter((c) => s.includes(c.status)).length;
  const pipeline = {
    pendingVerification: count("submitted"),
    awaitingApproval: count("verified"),
    awaitingPublish: count("approved"),
    fundingOpen: count("published"),
    fundedAwaitingPayout: count("funded"),
    paidOutNotClosed: count("disbursed"),
    completed: count("closed"),
    declined: count("declined"),
    // not yet finished from the donors' side: open for funding, or funded and waiting for payout
    outstanding: count("published", "funded"),
    stillNeeded: sum(cases.filter((c) => c.status === "published"), (c) => Math.max(0, (c.amountRequested ?? 0) - (c.raised ?? 0))),
  };

  // ---- loans (separate from donations, never added to them)
  const lent = data.loans.filter((l) => ["disbursed", "repaying", "closed"].includes(l.status));
  const live = lent.filter((l) => l.status !== "closed");
  const loans = {
    count: lent.length,
    active: live.length,
    lent: sum(lent, (l) => l.principal),
    repaid: sum(lent, (l) => l.repaid),
    outstanding: sum(live, (l) => Math.max(0, (l.principal ?? 0) - (l.repaid ?? 0))),
    pendingApproval: data.loans.filter((l) => !["disbursed", "repaying", "closed", "declined", "rejected"].includes(l.status)).length,
  };

  // ---- reconciliation across what passed the filters
  const allocByDonation = new Map();
  for (const a of data.allocations) allocByDonation.set(a.donationId, [...(allocByDonation.get(a.donationId) ?? []), a]);
  const warnings = [];
  const realById = new Map(data.donations.map((d) => [d.id, d]));
  for (const d of paid) {
    const real = realById.get(d.id) ?? d;
    for (const p of reconcileDonation(real, allocByDonation.get(d.id) ?? [])) warnings.push({ donation: real.publicReference ?? d.id, problem: p });
  }

  const out = (m) => [...m.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.amount - a.amount);
  return {
    totals: {
      verifiedDonations: donated,
      donationCount: paid.length,
      allocated,
      unallocated: donated - allocated,
      disbursed,
      pendingDisbursement: allocated - disbursed,
      refunded,
      awaitingVerification,
    },
    byPurpose: out(byPurpose),
    byFund: out(byFund),
    byCurrency: out(byCurrency),
    byCategory: out(byCategory),
    cases: caseRows,
    pipeline,
    loans,
    donationVsLoan: { donations: donated, loansLent: loans.lent, loansRepaid: loans.repaid },
    payouts: disbursements.length,
    reconciliation: { warnings, ok: warnings.length === 0 },
    // flat rows for a CSV. No donor, no beneficiary.
    rows: paid.map((d) => ({
      reference: d.publicReference ?? d.id,
      date: dateOf(d.createdAt)?.toISOString() ?? null,
      amount: d.amount,
      originalAmount: d.displayAmount ?? d.amount,
      originalCurrency: d.displayCurrency ?? "INR",
      purpose: d.purpose ?? null,
      fund: d.fund ?? null,
      status: d.status,
      allocated: d.allocatedAmount ?? 0,
      disbursed: d.disbursedAmount ?? 0,
    })),
  };
}

function ACTIVE(a) {
  return a.status === "allocated" || a.status === "disbursed";
}

module.exports = { buildReport, istBound };

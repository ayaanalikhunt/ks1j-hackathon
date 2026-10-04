// The public view of a loan: a reference, the amounts, the status and a timeline from real dates. Nothing that identifies
// the borrower, the student, the course, the school or the guarantor ever leaves this file.

/** A loan is public only once it has been paid out. Applications and plans being agreed are private. */
const PUBLIC_LOAN_STATUSES = ["disbursed", "repaying", "closed"];

const STATUS_WORDS = {
  disbursed: "Active: repayment starts after the course",
  repaying: "Active: being repaid",
  closed: "Fully repaid",
};

/** LOAN-2026-000042: readable and sequential. Year is the Indian calendar year. */
function publicLoanRef(n, now = new Date()) {
  const year = new Date(now.getTime() + 5.5 * 3600_000).getUTCFullYear();
  return `LOAN-${year}-${String(n).padStart(6, "0")}`;
}
function numberFromLoanRef(ref) {
  const m = /^LOAN-\d{4}-(\d{6})$/.exec(String(ref ?? ""));
  return m ? Number(m[1]) : null;
}

const iso = (t) => (t && typeof t.toDate === "function" ? t.toDate().toISOString() : null);

function buildPublicLoan(l) {
  const approved = l.principal ?? 0;
  const repaid = Math.min(l.repaid ?? 0, approved);
  const steps = [
    ["Application received", iso(l.createdAt)],
    ["Committee review completed", iso(l.reviewedAt)],
    ["Repayment plan agreed", iso(l.agreedAt)],
    ["Funds disbursed", iso(l.disbursedAt)],
    ["Fully repaid", l.status === "closed" ? iso(l.closedAt) : null],
  ];
  return {
    reference: l.publicLoanId,
    kind: "loan",
    purpose: "Education",
    status: l.status,
    statusLabel: STATUS_WORDS[l.status] ?? l.status,
    approved,
    disbursed: l.disbursedAt ? approved : 0,
    repaid,
    outstanding: l.status === "closed" ? 0 : Math.max(0, approved - repaid),
    repaidPercent: approved ? Math.min(100, Math.round((repaid / approved) * 100)) : 0,
    timeline: steps.filter(([, at]) => at).map(([label, at]) => ({ label, at })),
  };
}

function summarizeLoan(l) {
  const p = buildPublicLoan(l);
  return { reference: p.reference, purpose: p.purpose, status: p.status, statusLabel: p.statusLabel, approved: p.approved, disbursed: p.disbursed, repaid: p.repaid, outstanding: p.outstanding };
}

module.exports = { PUBLIC_LOAN_STATUSES, publicLoanRef, numberFromLoanRef, buildPublicLoan, summarizeLoan };

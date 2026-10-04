import { CASE_STATUS_LABELS, FUND_LABELS, NEED_CATEGORIES, PURPOSE_LABELS } from "@ks1j/shared";
import { committeeReportPdf, rs, type ReportSection } from "./pdf";

export interface Bucket { key: string; amount: number; count: number; allocated: number; disbursed: number }
export interface Report {
  totals: { verifiedDonations: number; donationCount: number; allocated: number; unallocated: number; disbursed: number; pendingDisbursement: number; refunded: number; awaitingVerification: number };
  byPurpose: Bucket[];
  byFund: Bucket[];
  byCurrency: Bucket[];
  byCategory: Bucket[];
  cases: { reference: string | null; status: string; requested: number; raised: number; allocated: number; disbursed: number }[];
  pipeline: Record<string, number>;
  loans: { count: number; active: number; lent: number; repaid: number; outstanding: number; pendingApproval: number };
  donationVsLoan: { donations: number; loansLent: number; loansRepaid: number };
  reconciliation: { ok: boolean; warnings: { donation: string; problem: string }[] };
  rows: { reference: string; date: string | null; amount: number; originalAmount: number; originalCurrency: string; purpose: string | null; fund: string | null; status: string; allocated: number; disbursed: number }[];
}


const PIPELINE: [string, keyof Report["pipeline"]][] = [
  ["Pending verification", "pendingVerification"],
  ["Awaiting approval", "awaitingApproval"],
  ["Awaiting publishing", "awaitingPublish"],
  ["Open for funding", "fundingOpen"],
  ["Funded, awaiting payout", "fundedAwaitingPayout"],
  ["Paid out, not yet closed", "paidOutNotClosed"],
  ["Completed", "completed"],
];

const bucketRows = (rows: Bucket[], label: (k: string) => string) => rows.map((x) => [label(x.key), rs(x.amount), rs(x.allocated), rs(x.disbursed)]);
const bucketCols = [
  { head: "Name", width: 70 },
  { head: "Amount", width: 38, align: "right" as const },
  { head: "Allocated", width: 38, align: "right" as const },
  { head: "Paid out", width: 32, align: "right" as const },
];

/** Builds the committee report PDF from the figures the server returned, and the filters that produced them. */
export function committeePdf(r: Report, f: Record<string, string>) {
  const t = r.totals;
  const used = Object.entries({ From: f.from, To: f.to, Purpose: PURPOSE_LABELS[f.category] ?? f.category, Status: f.status, Currency: f.currency, Case: f.caseRef })
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v}`);
  const sections: ReportSection[] = [
    {
      title: "Totals",
      pairs: [
        ["Verified donations", `${rs(t.verifiedDonations)} (${t.donationCount} donations)`],
        ["Allocated to cases", rs(t.allocated)],
        ["Unallocated", rs(t.unallocated)],
        ["Paid out", rs(t.disbursed)],
        ["Pending payout", rs(t.pendingDisbursement)],
        ["Refunded", rs(t.refunded)],
        ["Awaiting verification (not counted)", rs(t.awaitingVerification)],
        ["Reconciliation", r.reconciliation.ok ? "Reconciled: donation = allocations + unallocated" : `${r.reconciliation.warnings.length} problem(s): ${r.reconciliation.warnings.map((w) => `${w.donation} ${w.problem}`).join("; ")}`],
      ],
    },
    { title: "By donation purpose", table: { cols: bucketCols, rows: bucketRows(r.byPurpose, (k) => PURPOSE_LABELS[k] ?? k) } },
    { title: "By fund", table: { cols: bucketCols, rows: bucketRows(r.byFund, (k) => FUND_LABELS[k] ?? k) } },
    { title: "By allocation category", table: { cols: bucketCols, rows: bucketRows(r.byCategory, (k) => PURPOSE_LABELS[k] ?? NEED_CATEGORIES[k] ?? k) } },
    { title: "By original currency (value in rupees)", table: { cols: bucketCols, rows: bucketRows(r.byCurrency, (k) => k) } },
    {
      title: "By case",
      table: {
        cols: [
          { head: "Case", width: 44 },
          { head: "Status", width: 34 },
          { head: "Requested", width: 24, align: "right" },
          { head: "Raised", width: 24, align: "right" },
          { head: "Allocated", width: 26, align: "right" },
          { head: "Paid out", width: 26, align: "right" },
        ],
        rows: r.cases.map((c) => [c.reference ?? "", CASE_STATUS_LABELS[c.status] ?? c.status, rs(c.requested), rs(c.raised), rs(c.allocated), rs(c.disbursed)]),
        empty: "No allocations for these filters.",
      },
    },
    { title: "Case pipeline (all cases, not filtered)", pairs: [...PIPELINE.map(([k, key]): [string, string] => [k, String(r.pipeline[key] ?? 0)]), ["Still needed on open cases", rs(r.pipeline.stillNeeded ?? 0)]] },
    {
      title: "Donations and loans (kept separate)",
      pairs: [
        ["Donations (verified)", rs(r.donationVsLoan.donations)],
        ["Loans lent", `${rs(r.loans.lent)} (${r.loans.count} loans)`],
        ["Loans repaid", rs(r.loans.repaid)],
        ["Loans outstanding", `${rs(r.loans.outstanding)} (${r.loans.active} active, ${r.loans.pendingApproval} awaiting a decision)`],
      ],
      note: "Loan figures are not filtered by date, purpose or currency.",
    },
  ];
  return committeeReportPdf({ filters: used.length ? used.join(", ") : "none (all records)", sections, generatedAt: new Date() });
}

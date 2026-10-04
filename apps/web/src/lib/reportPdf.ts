import { CASE_STATUS_LABELS, FUND_LABELS, NEED_CATEGORIES, PURPOSE_LABELS, formatDateTime, formatRupees } from "@ks1j/shared";

export interface PdfBucket { key: string; amount: number; count: number; allocated: number; disbursed: number }
export interface PdfReport {
  totals: { verifiedDonations: number; donationCount: number; allocated: number; unallocated: number; disbursed: number; pendingDisbursement: number; refunded: number; awaitingVerification: number };
  byPurpose: PdfBucket[];
  byFund: PdfBucket[];
  byCurrency: PdfBucket[];
  byCategory: PdfBucket[];
  cases: { reference: string | null; status: string; requested: number; raised: number; allocated: number; disbursed: number }[];
  pipeline: Record<string, number>;
  loans: { count: number; active: number; lent: number; repaid: number; outstanding: number; pendingApproval: number };
  donationVsLoan: { donations: number; loansLent: number; loansRepaid: number };
  reconciliation: { ok: boolean; warnings: { donation: string; problem: string }[] };
}

// The built-in PDF fonts have no rupee sign, so amounts print as "Rs. 9,225".
const rs = (n: number) => formatRupees(n).replace("₹", "Rs. ");

/** Build the committee report as a PDF and save it. Loaded on demand so the PDF library stays out of the main bundle. */
export async function downloadReportPdf(r: PdfReport, filters: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const t = r.totals;
  const p = r.pipeline;
  let y = 48;

  pdf.setFontSize(18);
  pdf.text("KS1J committee report", 40, y);
  pdf.setFontSize(9);
  y += 16;
  pdf.text(`Generated ${formatDateTime(new Date())}. No donor or family is named.`, 40, y);
  y += 12;
  pdf.text(`Filters: ${filters || "none"}`, 40, y, { maxWidth: 515 });
  y += 14;

  const table = (head: string[], body: (string | number)[][], title?: string) => {
    if (title) {
      pdf.setFontSize(12);
      pdf.text(title, 40, y + 14);
      y += 18;
    }
    autoTable(pdf, { startY: y + 4, head: [head], body, styles: { fontSize: 9 }, headStyles: { fillColor: [40, 60, 50] }, margin: { left: 40, right: 40 } });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  };

  table(["Measure", "Value"], [
    ["Verified donations", `${rs(t.verifiedDonations)} (${t.donationCount} donations)`],
    ["Allocated", rs(t.allocated)],
    ["Unallocated", rs(t.unallocated)],
    ["Paid out", rs(t.disbursed)],
    ["Pending payout", rs(t.pendingDisbursement)],
    ["Refunded", rs(t.refunded)],
    ["Awaiting verification (not counted above)", rs(t.awaitingVerification)],
    ["Reconciliation (donation = allocations + unallocated)", r.reconciliation.ok ? "Reconciled" : `${r.reconciliation.warnings.length} problem(s)`],
  ], "Totals");
  if (!r.reconciliation.ok) table(["Donation", "Problem"], r.reconciliation.warnings.map((w) => [w.donation, w.problem]), "Reconciliation problems");

  const bucket = (title: string, rows: PdfBucket[], label: (k: string) => string) =>
    table(["Name", "Amount", "Allocated", "Paid out"], rows.length ? rows.map((b) => [label(b.key), rs(b.amount), rs(b.allocated), rs(b.disbursed)]) : [["Nothing for these filters", "", "", ""]], title);
  bucket("By donation purpose", r.byPurpose, (k) => PURPOSE_LABELS[k] ?? k);
  bucket("By fund", r.byFund, (k) => FUND_LABELS[k] ?? k);
  bucket("By allocation category", r.byCategory, (k) => PURPOSE_LABELS[k] ?? NEED_CATEGORIES[k] ?? k);
  bucket("By original currency (value in rupees)", r.byCurrency, (k) => k);

  table(["Case", "Status", "Requested", "Raised", "Allocated", "Paid out"],
    r.cases.length ? r.cases.map((c) => [c.reference ?? "", CASE_STATUS_LABELS[c.status] ?? c.status, rs(c.requested), rs(c.raised), rs(c.allocated), rs(c.disbursed)]) : [["No allocations for these filters", "", "", "", "", ""]],
    "By case");

  table(["Stage", "Cases"], [
    ["Pending verification", p.pendingVerification], ["Awaiting approval", p.awaitingApproval], ["Awaiting publishing", p.awaitingPublish],
    ["Open for funding", `${p.fundingOpen} (${rs(p.stillNeeded)} still needed)`], ["Funded, awaiting payout", p.fundedAwaitingPayout],
    ["Paid out, not yet closed", p.paidOutNotClosed], ["Completed", p.completed], ["Outstanding", p.outstanding],
  ], "Case pipeline (all cases, not filtered)");

  table(["Measure", "Value"], [
    ["Donations (verified, given not repaid)", rs(r.donationVsLoan.donations)],
    ["Loans lent", `${rs(r.loans.lent)} (${r.loans.count} loans)`],
    ["Loans repaid", rs(r.loans.repaid)],
    ["Loans outstanding", `${rs(r.loans.outstanding)} (${r.loans.active} active, ${r.loans.pendingApproval} awaiting a decision)`],
  ], "Donations and loans (kept separate)");
  pdf.setFontSize(8);
  pdf.text("Loan figures are not filtered by date, purpose or currency.", 40, y + 6);

  pdf.save("ks1j-report.pdf");
}

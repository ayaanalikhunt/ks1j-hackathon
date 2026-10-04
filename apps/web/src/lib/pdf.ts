// PDF documents: a donation receipt, a donor's statement and the public transparency report. Built in the browser with
// jsPDF, so nothing about a donor is sent anywhere. Plain black on white: these are records that get printed and filed.
//
// The standard PDF fonts have no rupee sign or Indian scripts, so amounts are written "Rs." and any character outside
// the Latin set is replaced with "?". Nothing here names a donor or a beneficiary.
import { jsPDF } from "jspdf";
import { formatDate, formatDateTime } from "@ks1j/shared";

const W = 210;
const M = 16;
const FOOT = 282;

const safe = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E -ÿ]/g, "?");
export const rs = (n: number) => `Rs. ${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;
const day = (d: Date | null | undefined) => (d ? formatDate(d) : "");

function start(title: string, subtitle?: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  doc.setProperties({ title: safe(title), author: "KS1J Mumbai Jamaat", creator: "KS1J" });
  doc.setTextColor(0).setDrawColor(0);
  doc.setFont("helvetica", "bold").setFontSize(20).text("KS1J", M, 20);
  doc.setFont("helvetica", "normal").setFontSize(9).text("Mumbai Jamaat  |  One Jamaat. One app.", M, 25.5);
  doc.setFont("helvetica", "bold").setFontSize(15).text(safe(title), W - M, 20, { align: "right" });
  if (subtitle) doc.setFont("helvetica", "normal").setFontSize(9).text(safe(subtitle), W - M, 25.5, { align: "right" });
  doc.setLineWidth(0.5).line(M, 29, W - M, 29);
  return { doc, y: 38 };
}

function footer(doc: jsPDF, note: string) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setLineWidth(0.2).line(M, FOOT - 4, W - M, FOOT - 4);
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(doc.splitTextToSize(safe(note), W - 2 * M - 20), M, FOOT);
    doc.text(`Page ${p} of ${pages}`, W - M, FOOT, { align: "right" });
  }
}

/** Keep going on a new page when there is not room for `need` more millimetres. */
function room(doc: jsPDF, y: number, need: number, redrawHead?: () => number) {
  if (y + need <= FOOT - 8) return y;
  doc.addPage();
  return redrawHead ? redrawHead() : 20;
}

function pairs(doc: jsPDF, y: number, rows: [string, string][]) {
  for (const [k, v] of rows) {
    const lines = doc.splitTextToSize(safe(v), 105);
    y = room(doc, y, 6 * lines.length + 1);
    doc.setFont("helvetica", "normal").setFontSize(10).text(safe(k), M, y);
    doc.setFont("helvetica", "bold").text(lines, M + 62, y);
    doc.setLineWidth(0.1).line(M, y + 1.8 + (lines.length - 1) * 5, W - M, y + 1.8 + (lines.length - 1) * 5);
    y += 6 * lines.length;
  }
  return y;
}

interface Col {
  head: string;
  width: number;
  align?: "left" | "right";
}
function table(doc: jsPDF, y: number, cols: Col[], rows: string[][]) {
  const total = cols.reduce((s, c) => s + c.width, 0);
  const head = () => {
    let x = M;
    doc.setFont("helvetica", "bold").setFontSize(8.5);
    for (const c of cols) {
      doc.text(safe(c.head), c.align === "right" ? x + c.width - 1 : x + 1, 20, { align: c.align === "right" ? "right" : "left" });
      x += c.width;
    }
    doc.setLineWidth(0.4).line(M, 22, M + total, 22);
    return 28;
  };
  const header = (at: number) => {
    let x = M;
    doc.setFont("helvetica", "bold").setFontSize(8.5);
    for (const c of cols) {
      doc.text(safe(c.head), c.align === "right" ? x + c.width - 1 : x + 1, at, { align: c.align === "right" ? "right" : "left" });
      x += c.width;
    }
    doc.setLineWidth(0.4).line(M, at + 1.8, M + total, at + 1.8);
    return at + 7;
  };
  y = header(y);
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  for (const r of rows) {
    const cells = r.map((v, i) => doc.splitTextToSize(safe(v), cols[i].width - 2));
    const h = Math.max(...cells.map((c) => c.length)) * 4.4 + 1.6;
    if (y + h > FOOT - 8) {
      doc.addPage();
      y = head();
      doc.setFont("helvetica", "normal").setFontSize(8.5);
    }
    let x = M;
    cells.forEach((lines, i) => {
      doc.text(lines, cols[i].align === "right" ? x + cols[i].width - 1 : x + 1, y, { align: cols[i].align === "right" ? "right" : "left" });
      x += cols[i].width;
    });
    doc.setLineWidth(0.1).line(M, y + h - 3, M + total, y + h - 3);
    y += h;
  }
  return y;
}

// ---------------------------------------------------------------------------------------------------------------------

export interface ReceiptData {
  reference: string;
  createdAt: Date | null;
  paidAt?: Date | null;
  amount: number;
  purpose: string;
  status: string;
  visibility?: string;
  displayCurrency?: string;
  displayAmount?: number | null;
  exchangeRate?: number | null;
  fxMarkupPercent?: number | null;
  fxMarkupAmount?: number | null;
  effectiveRate?: number | null;
  paymentMethod?: string | null;
  paymentId?: string | null;
  allocatedAmount: number;
  disbursedAmount: number;
  allocations: { ref: string; category: string; amount: number; disbursed: number }[];
}

/** A receipt exists only for a verified payment. It never says a gift has helped someone before an allocation exists. */
export function receiptPdf(r: ReceiptData) {
  if (r.status !== "paid") throw new Error("A receipt is available once the payment is verified.");
  const { doc, y: y0 } = start("Donation receipt", r.reference);
  let y = pairs(doc, y0, [
    ["Receipt / donation ID", r.reference],
    ["Date", r.createdAt ? formatDateTime(r.createdAt) : ""],
    ["Payment verified", r.paidAt ? formatDateTime(r.paidAt) : "Yes"],
    ["Amount received", rs(r.amount)],
    ["Purpose", r.purpose],
    ...((r.displayCurrency && r.displayCurrency !== "INR" && r.displayAmount
      ? [
          ["Original amount", `${r.displayAmount} ${r.displayCurrency}`],
          ["Exchange rate", r.exchangeRate ? `1 ${r.displayCurrency} = Rs. ${r.exchangeRate.toFixed(2)}` : ""],
          ["Currency conversion margin", r.fxMarkupPercent != null ? `${r.fxMarkupPercent}% (${rs(r.fxMarkupAmount ?? 0)})` : ""],
          ["Rate applied", r.effectiveRate ? `Rs. ${r.effectiveRate.toFixed(2)}` : ""],
        ]
      : []) as [string, string][]),
    ["Payment method", r.paymentMethod ?? "Online payment"],
    ["Payment reference", r.paymentId ?? ""],
    ["Payment status", "Verified"],
    ["Name shown publicly", r.visibility ?? "Private"],
  ].filter((p): p is [string, string] => !!p[1] || p[0] === "Payment verified"));

  y += 8;
  doc.setFont("helvetica", "bold").setFontSize(12).text("What has happened to this donation", M, y);
  y += 7;
  if (r.allocations.length === 0) {
    doc.setFont("helvetica", "normal").setFontSize(10).text("Allocation pending. The committee has not yet allocated this donation to a case.", M, y);
    y += 6;
    doc.setFontSize(9).text("We do not say a donation has helped a family until the committee has actually allocated it.", M, y);
    y += 6;
  } else {
    y = table(doc, y, [
      { head: "Case", width: 50 },
      { head: "Category", width: 52 },
      { head: "Allocated", width: 38, align: "right" },
      { head: "Paid out", width: 38, align: "right" },
    ], r.allocations.map((a) => [a.ref, a.category, rs(a.amount), rs(a.disbursed)]));
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(10).text(`Total allocated ${rs(r.allocatedAmount)}   |   Total paid out ${rs(r.disbursedAmount)}   |   Not yet allocated ${rs(Math.max(0, r.amount - r.allocatedAmount))}`, M, y);
  }
  footer(doc, "KS1J receipts show only what the committee has recorded. Beneficiary names and details are never included. Education loans carry zero interest and zero late fees. Keep this for your records.");
  return doc;
}

export interface StatementRow {
  reference: string;
  createdAt: Date | null;
  amount: number;
  displayCurrency?: string;
  displayAmount?: number | null;
  purpose: string;
  status: string;
  allocatedAmount: number;
  disbursedAmount: number;
}

/** A donor's own donations, one page or more: reference, date, amount, purpose, stage. */
export function statementPdf(rows: StatementRow[], generatedAt: Date = new Date()) {
  const { doc, y: y0 } = start("Donation statement", `Prepared ${day(generatedAt)}`);
  const verified = rows.filter((r) => r.status === "paid");
  let y = pairs(doc, y0, [
    ["Verified donations", String(verified.length)],
    ["Total verified", rs(verified.reduce((s, r) => s + r.amount, 0))],
    ["Allocated to cases", rs(verified.reduce((s, r) => s + r.allocatedAmount, 0))],
    ["Paid out", rs(verified.reduce((s, r) => s + r.disbursedAmount, 0))],
  ]);
  y += 8;
  y = table(doc, y, [
    { head: "Reference", width: 40 },
    { head: "Date", width: 24 },
    { head: "Purpose", width: 34 },
    { head: "Amount", width: 28, align: "right" },
    { head: "Allocated", width: 26, align: "right" },
    { head: "Paid out", width: 26, align: "right" },
  ], rows.map((r) => [
    `${r.reference}${r.status === "paid" ? "" : r.status === "refunded" ? " (refunded)" : " (not verified)"}`,
    day(r.createdAt),
    r.purpose,
    rs(r.amount) + (r.displayCurrency && r.displayCurrency !== "INR" && r.displayAmount ? `\n${r.displayAmount} ${r.displayCurrency}` : ""),
    rs(r.allocatedAmount),
    rs(r.disbursedAmount),
  ]));
  void y;
  footer(doc, "Only verified donations are counted in the totals. This statement names no beneficiary and is built from the committee's own records.");
  return doc;
}

export interface TransparencyData {
  totals: { totalDonated: number; totalAllocated: number; totalDisbursed: number; donationCount: number; casesAssisted: number; casesCompleted: number; casesFunding: number; casesUnderReview: number; loansLent?: number; loansRepaid?: number; loansActive?: number } | null;
  cases: { reference: string; category: string; status: string; requested: number; raised: number; disbursed: number; emergency?: boolean }[];
  loans: { reference: string; purpose: string; statusLabel: string; approved: number; repaid: number; outstanding: number }[];
  generatedAt: Date;
}

/** The public report: totals, recent cases and loans. Aggregates only. No donor and no family is named. */
export function transparencyPdf(d: TransparencyData) {
  const { doc, y: y0 } = start("Donation transparency report", `As of ${formatDateTime(d.generatedAt)}`);
  let y = y0;
  if (!d.totals) {
    doc.setFont("helvetica", "normal").setFontSize(11).text("No verified donations have been recorded yet.", M, y);
    y += 8;
  } else {
    const t = d.totals;
    y = pairs(doc, y, [
      ["Total verified donations", rs(t.totalDonated)],
      ["Allocated to cases", rs(t.totalAllocated)],
      ["Paid out", rs(t.totalDisbursed)],
      ["Waiting to be allocated", rs(t.totalDonated - t.totalAllocated)],
      ["Verified donations", String(t.donationCount)],
      ["Families and individuals assisted", String(t.casesAssisted)],
      ["Cases completed", String(t.casesCompleted)],
      ["Cases open for funding", String(t.casesFunding)],
      ["Cases being reviewed", String(t.casesUnderReview)],
    ]);
  }
  y += 8;
  y = room(doc, y, 30);
  doc.setFont("helvetica", "bold").setFontSize(12).text("Recent cases", M, y);
  y += 6;
  if (d.cases.length === 0) {
    doc.setFont("helvetica", "normal").setFontSize(10).text("No verified cases are currently available.", M, y);
    y += 8;
  } else {
    y = table(doc, y, [
      { head: "Case", width: 38 },
      { head: "Need", width: 36 },
      { head: "Status", width: 30 },
      { head: "Requested", width: 26, align: "right" },
      { head: "Raised", width: 24, align: "right" },
      { head: "Paid out", width: 24, align: "right" },
    ], d.cases.map((c) => [c.reference + (c.emergency ? " *" : ""), c.category, c.status, rs(c.requested), rs(c.raised), rs(c.disbursed)]));
    y += 2;
    if (d.cases.some((c) => c.emergency)) doc.setFontSize(8).text("* Emergency case", M, y + 2);
    y += 8;
  }
  if (d.totals && ((d.totals.loansLent ?? 0) > 0 || d.loans.length > 0)) {
    y = room(doc, y, 40);
    doc.setFont("helvetica", "bold").setFontSize(12).text("Education loans (repaid, shown apart from donations)", M, y);
    y += 6;
    doc.setFont("helvetica", "normal").setFontSize(10).text(`Lent ${rs(d.totals.loansLent ?? 0)}   |   Repaid ${rs(d.totals.loansRepaid ?? 0)}   |   Active loans ${d.totals.loansActive ?? 0}`, M, y);
    y += 6;
    if (d.loans.length > 0) {
      y = table(doc, y, [
        { head: "Loan", width: 38 },
        { head: "Purpose", width: 28 },
        { head: "Status", width: 48 },
        { head: "Approved", width: 24, align: "right" },
        { head: "Repaid", width: 22, align: "right" },
        { head: "To repay", width: 22, align: "right" },
      ], d.loans.map((l) => [l.reference, l.purpose, l.statusLabel, rs(l.approved), rs(l.repaid), rs(l.outstanding)]));
    }
  }
  footer(doc, "Every figure is added up from verified payments, committee allocations and recorded payouts. No donor or family is named and no private detail is published. Loans carry zero interest and zero late fees.");
  return doc;
}

export interface ReportSection {
  title: string;
  pairs?: [string, string][];
  table?: { cols: { head: string; width: number; align?: "left" | "right" }[]; rows: string[][]; empty?: string };
  note?: string;
}

/** The committee's financial report: filters used, then sections of figures and tables. Aggregates only; no donor or family is named. */
export function committeeReportPdf(d: { filters: string; sections: ReportSection[]; generatedAt: Date }) {
  const { doc, y: y0 } = start("Committee financial report", `Generated ${formatDateTime(d.generatedAt)}`);
  let y = y0;
  doc.setFont("helvetica", "normal").setFontSize(9).text(doc.splitTextToSize(`Filters: ${safe(d.filters)}`, W - 2 * M), M, y);
  y += 8;
  for (const s of d.sections) {
    y = room(doc, y, 30);
    doc.setFont("helvetica", "bold").setFontSize(12).text(safe(s.title), M, y);
    y += 6;
    if (s.pairs) y = pairs(doc, y, s.pairs) + 2;
    if (s.table) {
      if (s.table.rows.length === 0) {
        doc.setFont("helvetica", "normal").setFontSize(10).text(safe(s.table.empty ?? "Nothing for these filters."), M, y);
        y += 8;
      } else {
        y = table(doc, y, s.table.cols, s.table.rows) + 4;
      }
    }
    if (s.note) {
      doc.setFont("helvetica", "normal").setFontSize(8).text(doc.splitTextToSize(safe(s.note), W - 2 * M), M, y);
      y += 8;
    }
    y += 4;
  }
  footer(doc, "Added up on the server from verified payments, committee allocations, recorded payouts, cases and loans. No donor or family is named. Loans are kept apart from donations.");
  return doc;
}

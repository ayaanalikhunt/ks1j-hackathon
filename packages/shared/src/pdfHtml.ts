// Printable receipt and statement pages as plain HTML, for the mobile app to turn into a PDF. They mirror the website's PDFs:
// black on white, amounts written "Rs.", and no donor or beneficiary named. Pure functions, so they are tested here.
import { formatDate, formatDateTime } from "./dates";

export interface ReceiptDoc {
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
  paymentMethod?: string | null;
  paymentId?: string | null;
  allocatedAmount: number;
  disbursedAmount: number;
  allocations: { ref: string; category: string; amount: number; disbursed: number }[];
}

export interface StatementDocRow {
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

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export const rsText = (n: number) => `Rs. ${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;

const CSS = `
  @page { margin: 18mm 16mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 11pt; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
  .brand { font-size: 22pt; font-weight: 700; } .sub { font-size: 9pt; }
  .title { font-size: 15pt; font-weight: 700; text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 5px 4px; border-bottom: 1px solid #000; text-align: left; vertical-align: top; }
  th { font-size: 9pt; border-bottom: 2px solid #000; }
  .num { text-align: right; white-space: nowrap; }
  td.k { width: 38%; } td.v { font-weight: 700; }
  h2 { font-size: 12pt; margin: 22px 0 6px; }
  .foot { margin-top: 28px; border-top: 1px solid #000; padding-top: 6px; font-size: 8pt; }
`;

function page(title: string, subtitle: string, body: string, note: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${CSS}</style></head><body>
<div class="head"><div><div class="brand">KS1J</div><div class="sub">Mumbai Jamaat | One Jamaat. One app.</div></div>
<div><div class="title">${esc(title)}</div><div class="sub" style="text-align:right">${esc(subtitle)}</div></div></div>
${body}
<div class="foot">${esc(note)}</div></body></html>`;
}

const rows = (pairs: [string, string][]) =>
  `<table>${pairs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join("")}</table>`;

/** A receipt exists only for a verified payment. It never says a gift has helped someone before an allocation exists. */
export function receiptHtml(r: ReceiptDoc): string {
  if (r.status !== "paid") throw new Error("A receipt is available once the payment is verified.");
  const foreign = r.displayCurrency && r.displayCurrency !== "INR" && r.displayAmount;
  const pairs: [string, string][] = [
    ["Receipt / donation ID", r.reference],
    ["Date", r.createdAt ? formatDateTime(r.createdAt) : ""],
    ["Payment verified", r.paidAt ? formatDateTime(r.paidAt) : "Yes"],
    ["Amount received", rsText(r.amount)],
    ["Purpose", r.purpose],
    ...(foreign
      ? ([
          ["Original amount", `${r.displayAmount} ${r.displayCurrency}`],
          ["Exchange rate", r.exchangeRate ? `1 ${r.displayCurrency} = Rs. ${r.exchangeRate.toFixed(2)}` : ""],
        ] as [string, string][])
      : []),
    ["Payment method", r.paymentMethod ?? "Online payment"],
    ["Payment reference", r.paymentId ?? ""],
    ["Payment status", "Verified"],
    ["Name shown publicly", r.visibility ?? "Private"],
  ];
  const kept = pairs.filter(([k, v]) => v || k === "Payment verified");

  const what =
    r.allocations.length === 0
      ? `<p>Allocation pending. The committee has not yet allocated this donation to a case.</p><p style="font-size:9pt">We do not say a donation has helped a family until the committee has actually allocated it.</p>`
      : `<table><tr><th>Case</th><th>Category</th><th class="num">Allocated</th><th class="num">Paid out</th></tr>${r.allocations
          .map((a) => `<tr><td>${esc(a.ref)}</td><td>${esc(a.category)}</td><td class="num">${esc(rsText(a.amount))}</td><td class="num">${esc(rsText(a.disbursed))}</td></tr>`)
          .join("")}</table><p><b>Total allocated ${esc(rsText(r.allocatedAmount))} | Total paid out ${esc(rsText(r.disbursedAmount))} | Not yet allocated ${esc(rsText(Math.max(0, r.amount - r.allocatedAmount)))}</b></p>`;

  return page(
    "Donation receipt",
    r.reference,
    `${rows(kept)}<h2>What has happened to this donation</h2>${what}`,
    "KS1J receipts show only what the committee has recorded. Beneficiary names and details are never included. Education loans carry zero interest and zero late fees. Keep this for your records.",
  );
}

/** A donor's own donations: reference, date, amount, purpose and stage. Totals count verified donations only. */
export function statementHtml(list: StatementDocRow[], generatedAt: Date = new Date()): string {
  const verified = list.filter((r) => r.status === "paid");
  const sum = (f: (r: StatementDocRow) => number) => verified.reduce((s, r) => s + f(r), 0);
  const body = `${rows([
    ["Verified donations", String(verified.length)],
    ["Total verified", rsText(sum((r) => r.amount))],
    ["Allocated to cases", rsText(sum((r) => r.allocatedAmount))],
    ["Paid out", rsText(sum((r) => r.disbursedAmount))],
  ])}<h2>Your donations</h2><table><tr><th>Reference</th><th>Date</th><th>Purpose</th><th class="num">Amount</th><th class="num">Allocated</th><th class="num">Paid out</th></tr>${list
    .map((r) => {
      const state = r.status === "paid" ? "" : r.status === "refunded" ? " (refunded)" : " (not verified)";
      const orig = r.displayCurrency && r.displayCurrency !== "INR" && r.displayAmount ? `<br>${esc(r.displayAmount)} ${esc(r.displayCurrency)}` : "";
      return `<tr><td>${esc(r.reference)}${state}</td><td>${esc(r.createdAt ? formatDate(r.createdAt) : "")}</td><td>${esc(r.purpose)}</td><td class="num">${esc(rsText(r.amount))}${orig}</td><td class="num">${esc(rsText(r.allocatedAmount))}</td><td class="num">${esc(rsText(r.disbursedAmount))}</td></tr>`;
    })
    .join("")}</table>`;
  return page(
    "Donation statement",
    `Prepared ${formatDate(generatedAt)}`,
    body,
    "Only verified donations are counted in the totals. This statement names no beneficiary and is built from the committee's own records.",
  );
}

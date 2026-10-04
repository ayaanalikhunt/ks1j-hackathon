// PDF documents: what a receipt, a statement and the transparency report say, and what they refuse to say.
import { describe, expect, it } from "vitest";
import { receiptPdf, rs, statementPdf, transparencyPdf, type ReceiptData } from "../../../apps/web/src/lib/pdf";

/** The words actually drawn on the pages, with the PDF's own escaping undone. Not the file's internal plumbing. */
const text = (doc: { output: (t: "arraybuffer") => ArrayBuffer }) => {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const drawn = [...raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\([()\\])/g, "$1"));
  return `${raw.slice(0, 8)}\n${drawn.join("\n")}`;
};
const pages = (doc: { getNumberOfPages: () => number }) => doc.getNumberOfPages();

const receipt = (extra: Partial<ReceiptData> = {}): ReceiptData => ({
  reference: "KS1J-DON-2026-004821",
  createdAt: new Date("2026-10-04T10:30:00Z"),
  paidAt: new Date("2026-10-04T10:31:00Z"),
  amount: 10000,
  purpose: "Healthcare",
  status: "paid",
  visibility: "Anonymous",
  paymentMethod: "upi",
  paymentId: "pay_ABC123",
  allocatedAmount: 0,
  disbursedAmount: 0,
  allocations: [],
  ...extra,
});

describe("amounts", () => {
  it("writes rupees the Indian way, without the rupee sign the PDF fonts lack", () => {
    expect(rs(10000)).toBe("Rs. 10,000");
    expect(rs(1245000)).toBe("Rs. 12,45,000");
    expect(rs(0)).toBe("Rs. 0");
  });
});

describe("donation receipt", () => {
  it("is a real PDF with the reference, date in 12-hour India time, amount, purpose and payment reference", () => {
    const doc = receiptPdf(receipt());
    const t = text(doc);
    expect(t.startsWith("%PDF")).toBe(true);
    for (const s of ["KS1J-DON-2026-004821", "Rs. 10,000", "Healthcare", "pay_ABC123", "Donation receipt", "04/10/2026, 4:00 pm"]) expect(t).toContain(s);
    expect(pages(doc)).toBe(1);
  });
  it("says allocation is pending until the committee has allocated it, and never claims help early", () => {
    const t = text(receiptPdf(receipt()));
    expect(t).toContain("Allocation pending");
    expect(t).toContain("do not say a donation has helped a family until");
    expect(t).not.toMatch(/has been allocated to|Allocated to CASE/);
  });
  it("lists each allocation by case reference with what was allocated and paid out, and the balance still unallocated", () => {
    const t = text(receiptPdf(receipt({ allocatedAmount: 7000, disbursedAmount: 2000, allocations: [{ ref: "CASE-2026-000184", category: "Healthcare", amount: 5000, disbursed: 2000 }, { ref: "CASE-2026-000201", category: "Ration", amount: 2000, disbursed: 0 }] })));
    for (const s of ["CASE-2026-000184", "CASE-2026-000201", "Rs. 5,000", "Total allocated Rs. 7,000", "Total paid out Rs. 2,000", "Not yet allocated Rs. 3,000"]) expect(t).toContain(s);
    expect(t).not.toContain("Allocation pending");
  });
  it("shows the conversion for a foreign-currency gift, and omits it for rupees", () => {
    const usd = text(receiptPdf(receipt({ displayCurrency: "USD", displayAmount: 110, exchangeRate: 90, fxMarkupPercent: 2.5, fxMarkupAmount: 247.5, effectiveRate: 92.25 })));
    for (const s of ["110 USD", "1 USD = Rs. 90.00", "2.5% (Rs. 248)", "Rs. 92.25"]) expect(usd).toContain(s);
    const inr = text(receiptPdf(receipt({ displayCurrency: "INR", displayAmount: 10000 })));
    expect(inr).not.toContain("Exchange rate");
  });
  it("refuses to make a receipt for a payment that is not verified", () => {
    expect(() => receiptPdf(receipt({ status: "pending" }))).toThrow(/once the payment is verified/);
    expect(() => receiptPdf(receipt({ status: "refunded" }))).toThrow();
  });
  it("is safe with text the PDF fonts cannot draw, and never prints undefined or NaN", () => {
    const t = text(receiptPdf(receipt({ purpose: "ગુજરાતી सहायता", paymentId: null })));
    expect(t).not.toMatch(/undefined|NaN|null/);
    expect(t).toContain("????");
  });
  it("names no donor and no beneficiary", () => {
    const t = text(receiptPdf(receipt({ allocations: [{ ref: "CASE-2026-000184", category: "Healthcare", amount: 5000, disbursed: 0 }], allocatedAmount: 5000 })));
    expect(t).toContain("Beneficiary names and details are never included");
  });
});

describe("donor statement", () => {
  const rows = [
    { reference: "KS1J-DON-2026-000001", createdAt: new Date("2026-09-01T06:00:00Z"), amount: 5000, purpose: "Ration", status: "paid", allocatedAmount: 5000, disbursedAmount: 2000 },
    { reference: "KS1J-DON-2026-000002", createdAt: new Date("2026-09-02T06:00:00Z"), amount: 9999, purpose: "Zakat", status: "pending", allocatedAmount: 0, disbursedAmount: 0 },
    { reference: "KS1J-DON-2026-000003", createdAt: new Date("2026-09-03T06:00:00Z"), amount: 700, purpose: "Sadaqah", status: "refunded", allocatedAmount: 0, disbursedAmount: 0 },
  ];
  it("totals only verified donations and marks the others", () => {
    const t = text(statementPdf(rows, new Date("2026-10-04T06:00:00Z")));
    expect(t).toContain("Donation statement");
    expect(t).toMatch(/Verified donations\n1\n/); // one verified donation, not three
    expect(t).toMatch(/Total verified\nRs\. 5,000\n/); // the 9,999 pending and 700 refunded are not in it
    expect(t).toContain("Rs. 5,000");
    expect(t).toContain("(not verified)");
    expect(t).toContain("(refunded)");
    expect(t).toContain("Prepared 04/10/2026");
  });
  it("runs onto more pages when there are many donations", () => {
    const many = Array.from({ length: 90 }, (_, i) => ({ ...rows[0], reference: `KS1J-DON-2026-${String(i).padStart(6, "0")}` }));
    const doc = statementPdf(many);
    expect(pages(doc)).toBeGreaterThan(1);
    expect(text(doc)).toContain(`Page ${pages(doc)} of ${pages(doc)}`);
  });
});

describe("transparency report", () => {
  const totals = { totalDonated: 1245000, totalAllocated: 1082000, totalDisbursed: 974000, donationCount: 40, casesAssisted: 127, casesCompleted: 90, casesFunding: 6, casesUnderReview: 3, loansLent: 300000, loansRepaid: 80000, loansActive: 4 };
  const cases = [{ reference: "CASE-2026-000184", category: "Healthcare", status: "Fully funded", requested: 50000, raised: 50000, disbursed: 50000, emergency: true }];
  const loans = [{ reference: "LOAN-2026-000042", purpose: "Education", statusLabel: "Active: being repaid", approved: 50000, repaid: 20000, outstanding: 30000 }];
  it("shows the public totals, recent cases and loans, with the date it was made", () => {
    const t = text(transparencyPdf({ totals, cases, loans, generatedAt: new Date("2026-10-04T10:30:00Z") }));
    for (const s of ["Donation transparency report", "Rs. 12,45,000", "Rs. 10,82,000", "Rs. 9,74,000", "127", "CASE-2026-000184 *", "* Emergency case", "LOAN-2026-000042", "Education loans", "As of 04/10/2026, 4:00 pm"]) expect(t).toContain(s);
    expect(t).toContain("No donor or family is named");
  });
  it("says so plainly when there is nothing yet, instead of showing made-up figures", () => {
    const t = text(transparencyPdf({ totals: null, cases: [], loans: [], generatedAt: new Date() }));
    expect(t).toContain("No verified donations have been recorded yet.");
    expect(t).toContain("No verified cases are currently available.");
    expect(t).not.toContain("Education loans");
    expect(t).not.toMatch(/Rs\. [1-9]/);
  });
  it("keeps going over several pages for a long list", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ ...cases[0], reference: `CASE-2026-${String(i).padStart(6, "0")}`, emergency: false }));
    expect(pages(transparencyPdf({ totals, cases: many, loans, generatedAt: new Date() }))).toBeGreaterThan(1);
  });
});

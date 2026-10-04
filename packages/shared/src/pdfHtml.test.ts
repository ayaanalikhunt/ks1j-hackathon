import { describe, expect, it } from "vitest";
import { esc, receiptHtml, statementHtml, type ReceiptDoc } from "./index";

const base: ReceiptDoc = {
  reference: "DON-2026-000042",
  createdAt: new Date("2026-10-04T08:30:00Z"),
  amount: 9225,
  purpose: "General",
  status: "paid",
  allocatedAmount: 0,
  disbursedAmount: 0,
  allocations: [],
};

describe("receipt html", () => {
  it("refuses a payment that is not verified", () => {
    expect(() => receiptHtml({ ...base, status: "pending" })).toThrow(/verified/);
  });
  it("says allocation is pending rather than claiming help", () => {
    const h = receiptHtml(base);
    expect(h).toContain("Allocation pending");
    expect(h).toContain("Rs. 9,225");
    expect(h).toContain("DON-2026-000042");
  });
  it("lists allocations by case reference only", () => {
    const h = receiptHtml({ ...base, allocatedAmount: 5000, disbursedAmount: 2000, allocations: [{ ref: "CASE-2026-000007", category: "Medical", amount: 5000, disbursed: 2000 }] });
    expect(h).toContain("CASE-2026-000007");
    expect(h).toContain("Not yet allocated Rs. 4,225");
  });
  it("escapes anything that could break the page", () => {
    expect(esc('<script>"x"&')).toBe("&lt;script&gt;&quot;x&quot;&amp;");
    expect(receiptHtml({ ...base, purpose: "<b>x</b>" })).not.toContain("<b>x</b>");
  });
});

describe("statement html", () => {
  it("totals only verified donations", () => {
    const h = statementHtml([
      { reference: "A", createdAt: null, amount: 1000, purpose: "General", status: "paid", allocatedAmount: 400, disbursedAmount: 100 },
      { reference: "B", createdAt: null, amount: 9999, purpose: "General", status: "pending", allocatedAmount: 0, disbursedAmount: 0 },
    ]);
    expect(h).toContain("Rs. 1,000");
    expect(h).toContain("B (not verified)");
    expect(h).not.toMatch(/Total verified<\/td><td class="v">Rs\. 10,999/);
  });
});

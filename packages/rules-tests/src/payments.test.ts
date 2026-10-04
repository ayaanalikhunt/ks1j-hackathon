import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
// The functions are plain CommonJS; these are pure helpers, so they are tested directly with no emulator.
import * as fx from "../../../functions/lib/fx.js";
import * as rz from "../../../functions/lib/razorpay-core.js";

describe("forex quote", () => {
  it("matches the worked example: $100 at 90 with a 2.5% markup is 9,225 rupees", () => {
    const q = fx.computeQuote({ amount: 100, currency: "USD", rateToInr: 90, markupPercent: 2.5 });
    expect(q).toMatchObject({
      displayCurrency: "USD",
      displayAmountMinor: 10000,
      exchangeRate: 90,
      fxMarkupPercent: 2.5,
      effectiveRate: 92.25,
      convertedAtBaseRate: 9000,
      fxMarkupAmount: 225,
      donationInr: 9225,
      chargeInr: 9225,
      chargePaise: 922500,
    });
  });
  it("never marks up or converts rupees, and never loses the original amount", () => {
    const q = fx.computeQuote({ amount: 500, currency: "INR", rateToInr: 1, markupPercent: 9, fixedInr: 50 });
    expect(q).toMatchObject({ exchangeRate: 1, fxMarkupPercent: 0, fxMarkupAmount: 0, donationInr: 500, displayAmount: 500 });
  });
  it("lets the donor cover the payment fee so the fund still receives the full donation", () => {
    const q = fx.computeQuote({ amount: 1000, currency: "INR", rateToInr: 1, coverFees: true, feeRate: 0.0236 });
    expect(q.donationInr).toBe(1000);
    expect(q.chargeInr).toBeGreaterThan(1000);
    expect(q.chargeInr * (1 - 0.0236)).toBeGreaterThanOrEqual(1000);
    expect(q.estimatedFee).toBe(q.chargeInr - 1000);
  });
  it("supports the three rounding rules and a fixed adjustment", () => {
    const base = { amount: 10, currency: "USD", rateToInr: 83.333, markupPercent: 0 };
    expect(fx.computeQuote({ ...base, rounding: "nearest" }).donationInr).toBe(833);
    expect(fx.computeQuote({ ...base, rounding: "up" }).donationInr).toBe(834);
    expect(fx.computeQuote({ ...base, rounding: "down" }).donationInr).toBe(833);
    expect(fx.computeQuote({ ...base, fixedInr: 20 }).donationInr).toBe(853);
  });
  it("handles three-decimal currencies and rejects amounts the currency cannot hold", () => {
    expect(fx.toMinor(1.234, "KWD")).toBe(1234);
    expect(fx.toMinor(10.005, "USD")).toBeNull();
    expect(fx.toMinor(0, "USD")).toBeNull();
    expect(fx.toMinor(-5, "USD")).toBeNull();
    expect(fx.toMinor(Number.NaN, "USD")).toBeNull();
  });
  it("refuses unsupported currencies, missing rates and negligible amounts", () => {
    expect(() => fx.computeQuote({ amount: 5, currency: "JPY", rateToInr: 0.6 })).toThrow(/Unsupported/);
    expect(() => fx.computeQuote({ amount: 5, currency: "USD", rateToInr: 0 })).toThrow(/rate/);
    expect(() => fx.computeQuote({ amount: 0.001, currency: "KWD", rateToInr: 270 })).toThrow(/too small/); // 0.27 rupee rounds to 0
  });
  it("UPI is offered for rupee payments only", () => {
    expect(fx.methodsFor("INR")).toEqual(["upi", "card", "netbanking"]);
    expect(fx.methodsFor("USD")).not.toContain("upi");
    expect(fx.methodsFor("USD", { internationalMethods: ["card", "upi"] })).not.toContain("upi");
  });
  it("reads the rate from the provider, and fails loudly when it is missing", async () => {
    const ok = async () => ({ ok: true, json: async () => ({ rates: { INR: 88.5 } }) }) as Response;
    expect(await fx.fetchRateToInr("USD", ok)).toBe(88.5);
    expect(await fx.fetchRateToInr("INR", ok)).toBe(1);
    await expect(fx.fetchRateToInr("USD", async () => ({ ok: false, status: 503 }) as Response)).rejects.toThrow(/503/);
    await expect(fx.fetchRateToInr("USD", async () => ({ ok: true, json: async () => ({ rates: {} }) }) as Response)).rejects.toThrow(/no INR rate/);
  });
});

describe("razorpay signatures", () => {
  const secret = "test_secret_value";
  const sign = (s: string, key = secret) => createHmac("sha256", key).update(s).digest("hex");

  it("accepts the right checkout signature and rejects every wrong one", () => {
    const good = sign("order_A|pay_B");
    expect(rz.verifyPaymentSignature("order_A", "pay_B", good, secret)).toBe(true);
    expect(rz.verifyPaymentSignature("order_A", "pay_B", sign("order_A|pay_X"), secret)).toBe(false); // other payment
    expect(rz.verifyPaymentSignature("order_X", "pay_B", good, secret)).toBe(false); // other order
    expect(rz.verifyPaymentSignature("order_A", "pay_B", good, "wrong_secret")).toBe(false);
    expect(rz.verifyPaymentSignature("order_A", "pay_B", "", secret)).toBe(false);
    expect(rz.verifyPaymentSignature("order_A", "pay_B", "zz", secret)).toBe(false);
    expect(rz.verifyPaymentSignature("order_A", "pay_B", undefined as never, secret)).toBe(false);
    expect(rz.verifyPaymentSignature("order_A", "pay_B", good.slice(0, -2), secret)).toBe(false); // truncated
  });
  it("verifies the webhook over the exact raw body", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const sig = sign(body, "whsec");
    expect(rz.verifyWebhookSignature(body, sig, "whsec")).toBe(true);
    expect(rz.verifyWebhookSignature(body + " ", sig, "whsec")).toBe(false); // body tampered with
    expect(rz.verifyWebhookSignature(body, sig, "other")).toBe(false);
    expect(rz.verifyWebhookSignature(body, undefined as never, "whsec")).toBe(false);
  });
  it("builds a donation reference that does not expose a database id", () => {
    expect(rz.publicReference(4821, new Date("2026-10-04T00:00:00Z"))).toBe("KS1J-DON-2026-004821");
    expect(rz.publicReference(7, new Date("2027-01-01T00:00:00Z"))).toBe("KS1J-DON-2027-000007");
  });
  it("checks that Razorpay's payment record really matches the donation before it counts", () => {
    const donation = { orderId: "order_A", chargePaise: 922500, chargeCurrency: "INR" };
    const paid = { id: "pay_B", order_id: "order_A", amount: 922500, currency: "INR", status: "captured" };
    expect(rz.paymentMatches(paid, donation)).toEqual({ ok: true });
    expect(rz.paymentMatches({ ...paid, status: "authorized" }, donation).ok).toBe(false); // not captured yet
    expect(rz.paymentMatches({ ...paid, status: "failed" }, donation).ok).toBe(false);
    expect(rz.paymentMatches({ ...paid, amount: 100 }, donation).ok).toBe(false); // underpaid
    expect(rz.paymentMatches({ ...paid, currency: "USD" }, donation).ok).toBe(false);
    expect(rz.paymentMatches({ ...paid, order_id: "order_Z" }, donation).ok).toBe(false); // a different order
  });
});

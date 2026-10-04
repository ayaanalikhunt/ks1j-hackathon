// The parts of the Razorpay integration that decide whether money is real. Pure and tested without a network.
const crypto = require("node:crypto");

/** Constant-time comparison of two hex digests. Anything malformed is simply "not equal". */
function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || a.length !== b.length || !/^[0-9a-f]+$/i.test(a)) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** The signature Checkout hands back: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
function verifyPaymentSignature(orderId, paymentId, signature, keySecret) {
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(signature, expected);
}

/** The signature on a webhook: HMAC-SHA256 of the exact raw request body with the webhook secret. */
function verifyWebhookSignature(rawBody, signature, webhookSecret) {
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(signature, expected);
}

/** "KS1J-DON-2026-004821": readable, sequential and not a database id. Year is the Indian calendar year. */
function publicReference(n, now = new Date()) {
  const year = new Date(now.getTime() + 5.5 * 3600_000).getUTCFullYear();
  return `KS1J-DON-${year}-${String(n).padStart(6, "0")}`;
}

/**
 * Never take the browser's word for it. The payment fetched from Razorpay's own API must be captured, for this order,
 * in the amount and currency we charged. Anything else does not count as money received.
 */
function paymentMatches(payment, donation) {
  if (!payment) return { ok: false, reason: "No such payment at Razorpay." };
  if (payment.order_id !== donation.orderId) return { ok: false, reason: "The payment belongs to a different order." };
  if (payment.status !== "captured") return { ok: false, reason: `The payment is ${payment.status}, not captured.` };
  if (payment.currency !== donation.chargeCurrency) return { ok: false, reason: "The payment currency does not match the donation." };
  if (payment.amount < donation.chargePaise) return { ok: false, reason: "The payment is less than the amount charged." };
  return { ok: true };
}

module.exports = { safeEqualHex, verifyPaymentSignature, verifyWebhookSignature, publicReference, paymentMatches };

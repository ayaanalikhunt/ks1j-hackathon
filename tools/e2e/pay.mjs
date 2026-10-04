// Pretend Razorpay captured a payment, then deliver the signed webhook to the LOCAL functions emulator.
//   node tools/e2e/pay.mjs <orderId> <amountPaise> [paymentId]
import { createHmac } from "node:crypto";

const [orderId, amountPaise, paymentId = `pay_${orderId}`] = process.argv.slice(2);
if (!orderId || !amountPaise) {
  console.error("usage: node tools/e2e/pay.mjs <orderId> <amountPaise> [paymentId]");
  process.exit(1);
}
const cap = await fetch("http://127.0.0.1:9555/__capture", { method: "POST", body: JSON.stringify({ orderId, paymentId, amountPaise: Number(amountPaise), method: "card" }) }).then((r) => r.json());
const event = { event: "payment.captured", payload: { payment: { entity: cap } } };
const raw = JSON.stringify(event);
const res = await fetch("http://127.0.0.1:5001/ks1j-8a2e3/asia-south1/razorpayWebhook", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-razorpay-signature": createHmac("sha256", "test_webhook_secret").update(raw).digest("hex"), "x-razorpay-event-id": `evt_${paymentId}_${Date.now()}` },
  body: raw,
});
console.log("webhook", res.status, await res.text());

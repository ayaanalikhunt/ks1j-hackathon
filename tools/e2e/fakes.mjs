// Fake Razorpay (port 9555) and fake Anthropic (port 9556) for end-to-end browser tests on the local emulators.
// Nothing here talks to the real services and no real key is involved.
//
//   node tools/e2e/fakes.mjs
//
// Razorpay: POST /v1/orders, GET /v1/payments/:id, POST /v1/payments/:id/refund, and a test helper
//   POST /__capture {orderId, paymentId, amountPaise, method}  makes a payment "captured" for that order.
// Anthropic: POST /v1/messages answers with the persona's name and the question, so a test can see what was asked.
import { createServer } from "node:http";

const payments = new Map();
let seq = 0;

function serve(port, handler) {
  createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (code, json) => {
        res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(json));
      };
      try {
        handler(req, body ? JSON.parse(body) : {}, send);
      } catch (e) {
        send(500, { error: String(e) });
      }
    });
  }).listen(port, "127.0.0.1", () => console.log("fake listening on", port));
}

serve(9555, (req, body, send) => {
  const url = req.url ?? "";
  if (req.method === "POST" && url === "/__capture") {
    payments.set(body.paymentId, { id: body.paymentId, order_id: body.orderId, amount: body.amountPaise, currency: "INR", status: "captured", method: body.method ?? "upi", fee: Math.round(body.amountPaise * 0.0236), tax: Math.round(body.amountPaise * 0.0036) });
    return send(200, payments.get(body.paymentId));
  }
  if (url.startsWith("/fx/")) return send(200, { rates: { INR: 90 } });
  if (url === "/v1/orders") return send(200, { id: `order_E2E${++seq}`, amount: body.amount, currency: body.currency });
  const refund = url.match(/^\/v1\/payments\/(\w+)\/refund$/);
  if (refund) return send(200, { id: `rfnd_${refund[1]}` });
  const p = url.match(/^\/v1\/payments\/(\w+)$/);
  if (p) return payments.has(p[1]) ? send(200, payments.get(p[1])) : send(404, { error: { description: "not found" } });
  send(404, {});
});

serve(9556, (req, body, send) => {
  const who = /Sistani/.test(body.system ?? "") ? "Ayatollah Sistani" : /Khamenei/.test(body.system ?? "") ? "Ayatollah Khamenei" : "Ayatollah Makarem Shirazi";
  const q = body.messages?.at(-1)?.content ?? "";
  send(200, { content: [{ type: "text", text: `**${who}** (test answer). You asked: ${q}\n\n- This is a fake model for testing.\n- Confirm with the office.` }] });
});

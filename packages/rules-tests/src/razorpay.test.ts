// Razorpay end to end on the emulators, against a fake Razorpay HTTP server. No real money, no real keys.
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PROJECT = "ks1j-8a2e3";
const KEY_SECRET = "test_key_secret";
const WH_SECRET = "test_webhook_secret";
const hmac = (s: string, k: string) => createHmac("sha256", k).update(s).digest("hex");

const payments = new Map<string, Record<string, unknown>>();
let orderSeq = 0;
let server: Server;

function startFake() {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (code: number, j: unknown) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(j));
      };
      const url = req.url ?? "";
      if (url.startsWith("/fx/USD")) return send(200, { rates: { INR: 90 } });
      if (url === "/v1/orders") {
        const o = JSON.parse(body);
        return send(200, { id: `order_T${++orderSeq}`, amount: o.amount, currency: o.currency });
      }
      const r = url.match(/^\/v1\/payments\/(\w+)\/refund$/);
      if (r) return send(200, { id: `rfnd_${r[1]}` });
      const p = url.match(/^\/v1\/payments\/(\w+)$/);
      if (p) return payments.has(p[1]) ? send(200, payments.get(p[1])) : send(404, { error: { description: "not found" } });
      send(404, {});
    });
  });
  return new Promise<void>((ok) => server.listen(9555, "127.0.0.1", ok));
}

let n = 0;
function client(name: string) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "fake" }, `${name}-${n++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const fns = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  return { auth, fns };
}
async function person(uid: string, role: string) {
  const c = client(uid);
  await adminAuth().createUser({ uid, email: `${uid}@test.invalid` });
  await adminDb().doc(`members/${uid}`).set({ fullName: uid, role });
  await signInWithCustomToken(c.auth, await adminAuth().createCustomToken(uid));
  return c;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (c: ReturnType<typeof client>, name: string, data: unknown) => httpsCallable<unknown, any>(c.fns, name)(data).then((r) => r.data);
const hook = (event: object, id: string, secret = WH_SECRET) => {
  const raw = JSON.stringify(event);
  return fetch(`http://127.0.0.1:5001/${PROJECT}/asia-south1/razorpayWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": hmac(raw, secret), "x-razorpay-event-id": id },
    body: raw,
  });
};

describe("razorpay donations", () => {
  let donor: ReturnType<typeof client>;
  let admin: ReturnType<typeof client>;
  const db = () => adminDb();

  beforeAll(async () => {
    await startFake();
    initAdmin({ projectId: PROJECT });
    donor = await person("rz-donor", "member");
    admin = await person("rz-admin", "admin");
    await db().doc("cases/rz-case").set({ status: "published", applicantId: "x", amountRequested: 20000, raised: 0, number: 9, title: "T" });
  });
  afterAll(() => server?.close());

  it("quotes a dollar gift with the markup shown, and refuses junk", async () => {
    const q = await call(donor, "quoteDonation", { amount: 100, currency: "USD" });
    expect(q).toMatchObject({ donationInr: 9225, fxMarkupAmount: 225, exchangeRate: 90 });
    expect(q.methods).not.toContain("upi");
    await expect(call(donor, "quoteDonation", { amount: 1, currency: "INR" })).rejects.toThrow(/minimum/);
    await expect(call(donor, "quoteDonation", { amount: 5, currency: "JPY" })).rejects.toThrow(/not supported/);
  });

  it("creates a pending donation; a forged signature does not count it", async () => {
    const o = await call(donor, "createDonationOrder", { consent: true, amount: 500, currency: "INR", caseId: "rz-case" });
    expect(o.reference).toMatch(/^KS1J-DON-\d{4}-\d{6}$/);
    const pending = (await db().doc(`donations/${o.donationId}`).get()).data()!;
    expect(pending).toMatchObject({ status: "pending", amount: 500, donorId: "rz-donor" });
    payments.set("pay_forged", { id: "pay_forged", order_id: o.orderId, amount: 50000, currency: "INR", status: "captured" });
    await expect(call(donor, "verifyRazorpayPayment", { donationId: o.donationId, paymentId: "pay_forged", signature: "00".repeat(32) })).rejects.toThrow(/could not be verified/);
    expect((await db().doc(`donations/${o.donationId}`).get()).get("status")).toBe("pending");
  });

  it("a genuine payment is counted once, on the case, ledger and audit log", async () => {
    const o = await call(donor, "createDonationOrder", { consent: true, amount: 1000, currency: "INR", caseId: "rz-case" });
    payments.set("pay_ok", { id: "pay_ok", order_id: o.orderId, amount: 100000, currency: "INR", status: "captured", method: "upi", fee: 2000, tax: 360 });
    const sig = hmac(`${o.orderId}|pay_ok`, KEY_SECRET);
    await call(donor, "verifyRazorpayPayment", { donationId: o.donationId, paymentId: "pay_ok", signature: sig });
    await call(donor, "verifyRazorpayPayment", { donationId: o.donationId, paymentId: "pay_ok", signature: sig }); // double click
    const d = (await db().doc(`donations/${o.donationId}`).get()).data()!;
    expect(d).toMatchObject({ status: "paid", gatewayFee: 20, paymentMethod: "upi", donationStatus: "allocated" });
    expect((await db().doc("cases/rz-case").get()).get("raised")).toBe(1000);
    expect((await db().doc(`ledger/donation-${o.donationId}`).get()).get("amount")).toBe(1000);
    const logs = await db().collection("auditLogs").where("entityId", "==", o.donationId).where("action", "==", "PAYMENT_VERIFIED").get();
    expect(logs.size).toBe(1);
  });

  it("an underpaid payment is not money received", async () => {
    const o = await call(donor, "createDonationOrder", { consent: true, amount: 300, currency: "INR" });
    payments.set("pay_low", { id: "pay_low", order_id: o.orderId, amount: 100, currency: "INR", status: "captured" });
    await expect(call(donor, "verifyRazorpayPayment", { donationId: o.donationId, paymentId: "pay_low", signature: hmac(`${o.orderId}|pay_low`, KEY_SECRET) })).rejects.toThrow(/less than/);
    expect((await db().doc(`donations/${o.donationId}`).get()).get("status")).toBe("pending");
  });

  it("the webhook counts a payment the donor never confirmed, once, and rejects bad signatures", async () => {
    const o = await call(donor, "createDonationOrder", { consent: true, amount: 250, currency: "INR" });
    const ev = { event: "payment.captured", payload: { payment: { entity: { id: "pay_wh", order_id: o.orderId, amount: 25000, currency: "INR", status: "captured", method: "card", fee: 590, tax: 90 } } } };
    expect((await hook(ev, "evt_bad", "wrong")).status).toBe(400);
    expect((await hook(ev, "evt_1")).status).toBe(200);
    expect((await hook(ev, "evt_1")).status).toBe(200); // retried by Razorpay
    expect((await hook(ev, "evt_2")).status).toBe(200); // a different event for the same payment
    const d = (await db().doc(`donations/${o.donationId}`).get()).data()!;
    expect(d).toMatchObject({ status: "paid", donationStatus: "available_for_allocation", confirmedBy: "system" });
    expect((await db().collection("ledger").where("refId", "==", o.donationId).get()).size).toBe(1);
  });

  it("refund reverses the ledger and the case total; only admins, with a reason", async () => {
    const donations = await db().collection("donations").where("payerId", "==", "rz-donor").where("amount", "==", 1000).where("status", "==", "paid").get();
    const id = donations.docs[0].id;
    await expect(call(donor, "refundDonation", { donationId: id, reason: "changed my mind" })).rejects.toThrow(/Admins only/);
    await expect(call(admin, "refundDonation", { donationId: id, reason: "" })).rejects.toThrow(/reason/);
    await call(admin, "refundDonation", { donationId: id, reason: "Duplicate gift, donor asked" });
    expect((await db().doc(`donations/${id}`).get()).get("status")).toBe("refunded");
    expect((await db().doc("cases/rz-case").get()).get("raised")).toBe(0);
    expect((await db().doc(`ledger/refund-${id}`).get()).get("direction")).toBe("out");
  });

  it("only admins change the forex markup, and the change is audited", async () => {
    await expect(call(donor, "updatePaymentSettings", { fxMarkupPercent: 0 })).rejects.toThrow(/Admins only/);
    await expect(call(admin, "updatePaymentSettings", { fxMarkupPercent: 50 })).rejects.toThrow(/between/);
    await call(admin, "updatePaymentSettings", { fxMarkupPercent: 3, reason: "test" });
    const q = await call(donor, "quoteDonation", { amount: 100, currency: "USD" });
    expect(q.donationInr).toBe(9270);
    expect((await db().collection("auditLogs").where("action", "==", "PAYMENT_SETTINGS_CHANGED").get()).size).toBe(1);
  });
});

// Razorpay donations: quote, order, verify, webhook, refund, settings. Loaded by index.js only when ENABLE_RAZORPAY=true,
// because it needs the key secret and webhook secret to exist (see functions/README-razorpay.md).
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { computeQuote, fetchRateToInr, methodsFor, SUPPORTED } = require("./lib/fx");
const { paymentMatches, publicReference, verifyPaymentSignature, verifyWebhookSignature } = require("./lib/razorpay-core");
const { audit, settleDonation, caseEvent, notify } = require("./lib/settle");
const { PURPOSES, VISIBILITY } = require("./lib/allocation");
const { refreshTransparency } = require("./lib/transparency");

const db = getFirestore();
const REGION = { region: "asia-south1" };
const KEY_ID = defineString("RAZORPAY_KEY_ID");
const KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const API = () => process.env.RAZORPAY_API_BASE || "https://api.razorpay.com/v1";
const ADMIN_ROLES = ["admin", "super_admin", "owner"];
const DEFAULTS = { fxMarkupPercent: 2.5, fixedInr: 0, rounding: "nearest", feeRate: 0.0236, internationalMethods: ["card"], fxCacheMinutes: 60 };
const POOL_FUNDS = ["general", "sehme_sadaat"];
const MIN_INR = 10;
const MAX_INR = 1_000_000;

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  if (!ADMIN_ROLES.includes(me.get("role"))) throw new HttpsError("permission-denied", "Admins only.");
  return req.auth.uid;
}

async function settings() {
  const s = await db.doc("settings/payments").get();
  return { ...DEFAULTS, ...(s.exists ? s.data() : {}) };
}

async function rzp(path, init = {}) {
  const auth = Buffer.from(`${KEY_ID.value()}:${KEY_SECRET.value()}`).toString("base64");
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpsError("unavailable", `Razorpay: ${body?.error?.description ?? res.status}`);
  return body;
}

/** The day's rate, cached so a donor page does not hit the provider every time. A stale rate is used only if the provider is down. */
async function rateFor(currency, cfg) {
  if (currency === "INR") return { rate: 1, asOf: new Date() };
  const ref = db.doc(`fxRates/${currency}`);
  const cached = await ref.get();
  const fresh = cached.exists && Date.now() - cached.get("fetchedAt").toMillis() < cfg.fxCacheMinutes * 60_000;
  if (fresh) return { rate: cached.get("rate"), asOf: cached.get("fetchedAt").toDate() };
  try {
    const rate = await fetchRateToInr(currency, fetch, process.env.FX_API_BASE || undefined);
    await ref.set({ rate, fetchedAt: FieldValue.serverTimestamp(), provider: "open.er-api.com" });
    return { rate, asOf: new Date() };
  } catch (e) {
    if (cached.exists) return { rate: cached.get("rate"), asOf: cached.get("fetchedAt").toDate(), stale: true };
    throw new HttpsError("unavailable", "Exchange rate is unavailable right now. Please try rupees or try again shortly.");
  }
}

async function quoteFrom(data) {
  const cfg = await settings();
  const currency = String(data.currency ?? "INR").toUpperCase();
  if (!SUPPORTED.includes(currency)) throw new HttpsError("invalid-argument", "That currency is not supported.");
  const { rate, asOf, stale } = await rateFor(currency, cfg);
  let q;
  try {
    q = computeQuote({
      amount: Number(data.amount),
      currency,
      rateToInr: rate,
      markupPercent: cfg.fxMarkupPercent,
      fixedInr: cfg.fixedInr,
      rounding: cfg.rounding,
      coverFees: Boolean(data.coverFees),
      feeRate: cfg.feeRate,
    });
  } catch (e) {
    throw new HttpsError("invalid-argument", e.message);
  }
  if (q.donationInr < MIN_INR) throw new HttpsError("invalid-argument", `The minimum donation is ₹${MIN_INR}.`);
  if (q.donationInr > MAX_INR) throw new HttpsError("invalid-argument", "For gifts this large, please contact the committee.");
  return { ...q, methods: methodsFor(currency, cfg), rateAsOf: asOf.toISOString(), rateStale: Boolean(stale) };
}

/** Show the donor every number before they pay. Nothing is written. */
exports.quoteDonation = onCall(REGION, async (req) => quoteFrom(req.data ?? {}));

/**
 * Create the donation (pending) and the Razorpay order together. The donation records what the donor chose and the
 * rate used, so the conversion can be explained later. Only a verified payment ever makes it count.
 */
exports.createDonationOrder = onCall({ ...REGION, secrets: [KEY_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in to donate.");
  const d = req.data ?? {};
  const q = await quoteFrom(d);
  if (d.consent !== true) throw new HttpsError("failed-precondition", "Please accept the donation terms first.");
  const purpose = d.purpose ?? "general_support";
  if (!PURPOSES.includes(purpose)) throw new HttpsError("invalid-argument", "Unknown donation purpose.");
  const visibility = d.anonymous ? "anonymous" : d.visibility ?? "private";
  if (!VISIBILITY.includes(visibility)) throw new HttpsError("invalid-argument", "Unknown visibility.");

  let fund = "general";
  let caseId = null;
  if (d.caseId) {
    const c = await db.doc(`cases/${d.caseId}`).get();
    if (!c.exists || c.get("status") !== "published") throw new HttpsError("failed-precondition", "That case is not open for donations.");
    caseId = d.caseId;
    const sadaat = c.get("beneficiarySadaatVerified") === true;
    fund = d.fund === "sehme_sadaat" ? "sehme_sadaat" : d.fund === "general" ? "general" : sadaat ? "sehme_sadaat" : "general";
    if (fund === "sehme_sadaat" && !sadaat) throw new HttpsError("failed-precondition", "Sehme Sadaat goes only to a verified Sadaat case.");
  } else if (POOL_FUNDS.includes(d.fund)) {
    fund = d.fund;
  } else if (d.fund) {
    throw new HttpsError("invalid-argument", "Choose a case or a fund that accepts online gifts.");
  }

  const counter = db.doc("counters/donations");
  const donationRef = db.collection("donations").doc();
  let number = 0;
  await db.runTransaction(async (tx) => {
    const s = await tx.get(counter);
    number = (s.exists ? s.get("n") : 0) + 1;
    tx.set(counter, { n: number });
  });
  const reference = publicReference(number);

  const order = await rzp("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: q.chargePaise,
      currency: "INR",
      receipt: reference,
      notes: { donationId: donationRef.id, reference, caseId: caseId ?? "", fund },
    }),
  });

  await db.runTransaction(async (tx) => {
    tx.create(donationRef, {
      donorId: req.auth.uid,
      payerId: req.auth.uid,
      publicReference: reference,
      consent: true,
      visibility,
      displayName: visibility === "public" && typeof d.displayName === "string" ? d.displayName.slice(0, 60) : null,
      caseId,
      fund,
      purpose,
      amount: q.donationInr,
      baseCurrency: "INR",
      displayCurrency: q.displayCurrency,
      displayAmount: q.displayAmount,
      exchangeRate: q.exchangeRate,
      fxMarkupPercent: q.fxMarkupPercent,
      fxMarkupAmount: q.fxMarkupAmount,
      effectiveRate: q.effectiveRate,
      coverFees: Boolean(d.coverFees),
      estimatedFee: q.estimatedFee,
      chargePaise: q.chargePaise,
      chargeCurrency: "INR",
      anonymous: visibility === "anonymous",
      status: "pending",
      paymentStatus: "created",
      gateway: "razorpay",
      orderId: order.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(db.doc(`payments/${order.id}`), {
      donationId: donationRef.id,
      donorId: req.auth.uid,
      gateway: "razorpay",
      orderId: order.id,
      amountPaise: q.chargePaise,
      currency: "INR",
      status: "created",
      createdAt: FieldValue.serverTimestamp(),
    });
    audit(db, tx, { action: "DONATION_ORDER_CREATED", actor: req.auth.uid, entityType: "donation", entityId: donationRef.id, newValue: { orderId: order.id, amount: q.donationInr } });
  });

  return { donationId: donationRef.id, orderId: order.id, keyId: KEY_ID.value(), reference, quote: q };
});

/** The browser says "I paid". We do not believe it: the signature is checked and the payment is fetched from Razorpay. */
exports.verifyRazorpayPayment = onCall({ ...REGION, secrets: [KEY_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { donationId, paymentId, signature } = req.data ?? {};
  if (![donationId, paymentId, signature].every((v) => typeof v === "string" && v)) throw new HttpsError("invalid-argument", "Missing payment details.");
  const snap = await db.doc(`donations/${donationId}`).get();
  if (!snap.exists || snap.get("donorId") !== req.auth.uid) throw new HttpsError("not-found", "No such donation.");
  const d = snap.data();
  if (d.status === "paid") return { ok: true, already: true, reference: d.publicReference };

  if (!verifyPaymentSignature(d.orderId, paymentId, signature, KEY_SECRET.value())) {
    await audit(db, null, { action: "PAYMENT_SIGNATURE_REJECTED", actor: req.auth.uid, entityType: "donation", entityId: donationId, newValue: { paymentId } });
    throw new HttpsError("permission-denied", "The payment could not be verified.");
  }
  const payment = await rzp(`/payments/${paymentId}`);
  const check = paymentMatches(payment, d);
  if (!check.ok) {
    await db.doc(`donations/${donationId}`).update({ paymentStatus: "failed_check", paymentNote: check.reason });
    throw new HttpsError("failed-precondition", check.reason);
  }
  await settleDonation(db, donationId, { source: "razorpay_verify", paymentId, method: payment.method, feePaise: payment.fee, taxPaise: payment.tax }, req.auth.uid);
  return { ok: true, reference: d.publicReference };
});

/** Razorpay tells us directly, so a donor who closes the tab after paying is still counted. Idempotent on the event id. */
exports.razorpayWebhook = onRequest({ ...REGION, secrets: [WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== "POST") return void res.status(405).send("POST only");
  const raw = req.rawBody?.toString("utf8") ?? "";
  if (!verifyWebhookSignature(raw, req.get("x-razorpay-signature"), WEBHOOK_SECRET.value())) {
    return void res.status(400).send("bad signature");
  }
  const eventId = req.get("x-razorpay-event-id");
  if (!eventId) return void res.status(400).send("no event id");
  const event = JSON.parse(raw);

  const seen = db.doc(`webhookEvents/${eventId}`);
  try {
    await seen.create({ event: event.event, receivedAt: FieldValue.serverTimestamp() });
  } catch {
    return void res.status(200).send("duplicate"); // already handled; tell Razorpay to stop retrying
  }

  try {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && (event.event === "payment.captured" || event.event === "payment.failed")) {
      const found = await db.collection("donations").where("orderId", "==", payment.order_id).limit(1).get();
      if (!found.empty) {
        const doc = found.docs[0];
        if (event.event === "payment.captured") {
          const check = paymentMatches(payment, doc.data());
          if (check.ok) {
            await settleDonation(db, doc.id, { source: "razorpay_webhook", paymentId: payment.id, method: payment.method, feePaise: payment.fee, taxPaise: payment.tax }, "system");
          } else {
            await doc.ref.update({ paymentStatus: "failed_check", paymentNote: check.reason });
            await audit(db, null, { action: "PAYMENT_MISMATCH", entityType: "donation", entityId: doc.id, reason: check.reason });
          }
        } else if (doc.get("status") !== "paid") {
          await doc.ref.update({ paymentStatus: "failed", paymentNote: payment.error_description ?? "Payment failed" });
        }
      }
    }
    res.status(200).send("ok");
  } catch (e) {
    await seen.delete().catch(() => {}); // let Razorpay retry
    res.status(500).send("error");
  }
});

/** Refund a paid donation at Razorpay and reverse it in the ledger. Admin only, reason required, audited. */
exports.refundDonation = onCall({ ...REGION, secrets: [KEY_SECRET] }, async (req) => {
  const uid = await requireAdmin(req);
  const { donationId, reason } = req.data ?? {};
  if (typeof donationId !== "string" || typeof reason !== "string" || reason.trim().length < 5) {
    throw new HttpsError("invalid-argument", "A donation id and a reason are required.");
  }
  const ref = db.doc(`donations/${donationId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get("status") !== "paid" || !snap.get("paymentId")) throw new HttpsError("failed-precondition", "Only a paid Razorpay donation can be refunded.");
  const d = snap.data();
  const allocs = await db.collection("allocations").where("donationId", "==", donationId).get();
  if (allocs.docs.some((x) => (x.get("reservedAmount") ?? 0) > 0)) throw new HttpsError("failed-precondition", "Money from this donation has already been paid out. It cannot be refunded.");

  const refund = await rzp(`/payments/${d.paymentId}/refund`, { method: "POST", body: JSON.stringify({ amount: d.chargePaise, notes: { donationId, reason: reason.slice(0, 200) } }) });

  await db.runTransaction(async (tx) => {
    const live = allocs.docs.filter((x) => !["reversed", "cancelled"].includes(x.get("status")));
    const cases = await Promise.all(live.map((x) => (x.get("caseId") ? tx.get(db.doc(`cases/${x.get("caseId")}`)) : null)));
    tx.update(ref, { status: "refunded", donationStatus: "refunded", paymentStatus: "refunded", refundId: refund.id, refundReason: reason, refundedAt: FieldValue.serverTimestamp() });
    tx.create(db.doc(`ledger/refund-${donationId}`), {
      kind: "refund", direction: "out", refId: donationId, amount: d.amount, fund: d.fund, caseId: d.caseId ?? null,
      currency: "INR", createdAt: FieldValue.serverTimestamp(), confirmedBy: uid,
    });
    live.forEach((x, i) => {
      tx.update(x.ref, { status: "reversed", reversedAt: FieldValue.serverTimestamp() });
      const c = cases[i];
      if (c?.exists) {
        tx.update(c.ref, { raised: Math.max(0, (c.get("raised") ?? 0) - x.get("amount")) });
        caseEvent(db, tx, c.data(), c.id, "gift_refunded", uid);
      }
    });
    tx.update(ref, { allocatedAmount: 0 });
    notify(db, tx, d.payerId ?? d.donorId, "Your donation has been refunded.", null);
    audit(db, tx, { action: "DONATION_REFUNDED", actor: uid, entityType: "donation", entityId: donationId, oldValue: { status: "paid" }, newValue: { status: "refunded", refundId: refund.id }, reason });
  });
  await refreshTransparency(db);
  return { ok: true, refundId: refund.id };
});

/** Forex markup, rounding and methods are set by admins and every change is audited. */
exports.updatePaymentSettings = onCall(REGION, async (req) => {
  const uid = await requireAdmin(req);
  const d = req.data ?? {};
  const next = {};
  const num = (k, lo, hi) => {
    if (d[k] === undefined) return;
    const v = Number(d[k]);
    if (!Number.isFinite(v) || v < lo || v > hi) throw new HttpsError("invalid-argument", `${k} must be between ${lo} and ${hi}.`);
    next[k] = v;
  };
  num("fxMarkupPercent", 0, 20);
  num("fixedInr", 0, 1000);
  num("feeRate", 0, 0.1);
  num("fxCacheMinutes", 5, 1440);
  num("disbursementCheckerThreshold", 0, 10_000_000);
  if (d.rounding !== undefined) {
    if (!["nearest", "up", "down"].includes(d.rounding)) throw new HttpsError("invalid-argument", "Bad rounding rule.");
    next.rounding = d.rounding;
  }
  if (d.internationalMethods !== undefined) {
    if (!Array.isArray(d.internationalMethods) || d.internationalMethods.some((m) => !["card", "netbanking", "wallet"].includes(m))) throw new HttpsError("invalid-argument", "Bad method list.");
    next.internationalMethods = d.internationalMethods;
  }
  if (!Object.keys(next).length) throw new HttpsError("invalid-argument", "Nothing to change.");
  const before = await settings();
  await db.doc("settings/payments").set({ ...next, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(db, null, { action: "PAYMENT_SETTINGS_CHANGED", actor: uid, entityType: "settings", entityId: "payments", oldValue: before, newValue: next, reason: typeof d.reason === "string" ? d.reason : null });
  return { ok: true };
});

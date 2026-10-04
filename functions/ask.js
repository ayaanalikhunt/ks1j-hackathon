// POST-style pipeline for the Ask AI Guide (a callable function):
//   rate limit -> detect language -> deterministic classifier ->
//   { open a page (registry only) | the member's OWN donation status (authorised here) | a fiqh answer from a Marja persona } ->
//   privacy-safe audit row.
// The guide explains published positions only. It never issues a ruling, and the model never decides who may see what.
const crypto = require("node:crypto");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { classify, isAmbiguous, routeById } = require("./lib/ask/actions");
const { rateLimit, ipPrefix, cacheGet, cacheSet } = require("./lib/ask/infra");
const { complete, configured, sanitizeHistory, toTurns } = require("./lib/ask/llm");
const { detectLanguage, languageInstruction } = require("./lib/ask/lang");
const { MARJAS, getMarja, buildCompareSystemPrompt, buildMarjaSystemPrompt, INJECTION_DEFENSE } = require("./lib/ask/marja");
const { actionLabel, speak } = require("./lib/ask/strings");

const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const ACTION_THRESHOLD = 0.85;

const model = () => process.env.AI_MODEL || "claude-sonnet-5-5";
const apiBase = () => process.env.ANTHROPIC_API_BASE || undefined;

/** Never stores the question. Only what is needed to see how the guide is used and whether it works. */
async function audit(row) {
  try {
    await db.collection("aiAuditLog").add({ ...row, at: FieldValue.serverTimestamp() });
  } catch (e) {
    console.error("ask audit failed", e instanceof Error ? e.message : e);
  }
}

const stage = (d) => {
  if (d.status === "refunded") return "refunded";
  if (d.status !== "paid") return "payment pending";
  const a = d.allocatedAmount ?? 0;
  const p = d.disbursedAmount ?? 0;
  if (p >= d.amount) return "disbursed";
  if (p > 0) return "partly disbursed";
  if (a >= d.amount) return "allocated, disbursement pending";
  if (a > 0) return "partly allocated";
  return "payment verified, allocation pending";
};
const inr = (n) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

/** A member's OWN donations, in words. No beneficiary identity: only references, amounts and stages. */
async function donationSummary(uid) {
  const snap = await db.collection("donations").where("payerId", "==", uid).get();
  const rows = snap.docs.map((d) => d.data()).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  if (rows.length === 0) return "No donations are recorded on your account yet.";
  const paid = rows.filter((d) => d.status === "paid");
  const total = paid.reduce((s, d) => s + d.amount, 0);
  const lines = rows.slice(0, 3).map((d) => `• ${d.publicReference ?? "Donation"}: ${inr(d.amount)}, ${stage(d)}`);
  return `You have ${rows.length} recorded donation${rows.length === 1 ? "" : "s"} (${paid.length} verified, ${inr(total)} in total). Your latest:\n${lines.join("\n")}`;
}

function openPage(lang, action, routeId, signedIn) {
  const route = routeById(routeId);
  if (!route) throw new HttpsError("internal", "Unknown route in the action registry.");
  if (route.memberOnly && !signedIn) {
    const login = routeById("login");
    return { outcome: "DENIED", body: { action: { id: action.id, routeId: "login", params: {} }, path: login.path, speak: speak(lang, "denied"), title: login.title, outcome: "DENIED" } };
  }
  return { outcome: "EXECUTED", body: { action: { id: action.id, routeId, params: action.marjaId ? { marjaId: action.marjaId } : {} }, path: route.path, speak: speak(lang, "opening", route.title), opened: speak(lang, "opened", route.title), title: route.title, outcome: "EXECUTED" } };
}

exports.askGuide = onCall({ region: "asia-south1", cors: true, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 }, async (req) => {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  const ip = req.rawRequest?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req.rawRequest?.ip || "local";
  const uid = req.auth?.uid ?? null;
  let lang = "en";
  let intent = "UNKNOWN";
  const base = { requestId, ipPrefix: ipPrefix(ip), signedIn: !!uid };

  try {
    const limit = await rateLimit(db, uid ? `m:${uid}` : `ip:${ipPrefix(ip)}`, !!uid);
    if (!limit.allowed) {
      await audit({ ...base, lang: "-", intent: "RATE_LIMITED", outcome: "DENIED", httpStatus: 429 });
      throw new HttpsError("resource-exhausted", "Too many questions right now — please wait a moment and try again.");
    }

    const d = req.data ?? {};
    const question = typeof d.question === "string" ? d.question.trim() : "";
    if (!question) throw new HttpsError("invalid-argument", "question is required.");
    if (question.length > 600) throw new HttpsError("invalid-argument", "question is too long.");
    const history = sanitizeHistory(d.history);
    const ctx = { currentMarja: typeof d.currentMarja === "string" ? d.currentMarja.slice(0, 40) : undefined };

    lang = detectLanguage(question).lang;
    const result = classify(question, ctx);
    intent = result.action.id;
    const c = result.confidence;

    // ---- commands: no model involved ----
    if (result.action.id !== "ASK_FIQH" && c >= ACTION_THRESHOLD) {
      if (result.action.id === "GET_DONATION_STATUS") {
        if (!uid) {
          await audit({ ...base, lang, intent, confidence: c, routeId: "login", outcome: "DENIED", httpStatus: 401 });
          const login = routeById("login");
          return { action: { id: "OPEN_LOGIN", routeId: "login", params: {} }, path: login.path, speak: speak(lang, "denied"), title: login.title, outcome: "DENIED" };
        }
        const summary = await donationSummary(uid); // authorised here, never by the model; never cached
        const page = routeById("my_donations");
        await audit({ ...base, lang, intent, confidence: c, routeId: "my_donations", outcome: "EXECUTED", latencyMs: Date.now() - started });
        return { action: { id: "GET_DONATION_STATUS", routeId: "my_donations", params: {} }, path: page.path, speak: summary, title: page.title, outcome: "EXECUTED" };
      }
      if (result.action.routeId) {
        const { outcome, body } = openPage(lang, result.action, result.action.routeId, !!uid);
        await audit({ ...base, lang, intent, confidence: c, routeId: result.action.routeId, outcome, latencyMs: Date.now() - started });
        return body;
      }
    }

    // ---- ambiguous: ask, never guess ----
    if (result.action.id !== "ASK_FIQH" && isAmbiguous(result)) {
      const route = result.action.routeId ? routeById(result.action.routeId) : null;
      const options = [
        { label: actionLabel(result.action), action: result.action, path: route?.path ?? null },
        { label: actionLabel({ id: "ASK_FIQH" }), action: { id: "ASK_FIQH" }, path: null },
      ];
      await audit({ ...base, lang, intent, confidence: c, routeId: result.action.routeId, outcome: "CLARIFIED", latencyMs: Date.now() - started });
      return { clarify: { speak: speak(lang, "clarify"), options }, outcome: "CLARIFIED" };
    }

    // ---- a fiqh question: needs the model ----
    const apiKey = ANTHROPIC_API_KEY.value();
    if (!configured(apiKey)) {
      await audit({ ...base, lang, intent, outcome: "ERROR", httpStatus: 412, errorCode: "ai_not_configured", latencyMs: Date.now() - started });
      throw new HttpsError("failed-precondition", "The AI guide is not switched on yet. Commands such as “open donation” still work.");
    }
    const ask = (system, turns) => complete({ apiKey, model: model(), base: apiBase(), system, turns });
    const scholar = typeof d.scholar === "string" && d.scholar ? d.scholar.slice(0, 40) : "sistani";

    if (scholar === "compare") {
      const hit = cacheGet(["compare", question, lang]);
      if (hit) {
        await audit({ ...base, lang, intent: "ASK_FIQH", scholar: "compare", outcome: "ANSWERED", cached: true, latencyMs: Date.now() - started });
        return { answers: hit.answers, cached: true, lang };
      }
      const settled = await Promise.allSettled(
        MARJAS.map(async (m) => [m.id, await ask(`${buildCompareSystemPrompt(m)}\n\n${languageInstruction(lang)}\n\n${INJECTION_DEFENSE}`, toTurns([], question))]),
      );
      const answers = {};
      const errors = [];
      for (const r of settled) {
        if (r.status === "fulfilled") answers[r.value[0]] = r.value[1];
        else errors.push(r.reason instanceof Error ? r.reason.message : "failed");
      }
      if (Object.keys(answers).length === 0) throw new HttpsError("unavailable", errors[0] ?? "The guides could not answer just now.");
      cacheSet(["compare", question, lang], { answers });
      await audit({ ...base, lang, intent: "ASK_FIQH", scholar: "compare", outcome: "ANSWERED", latencyMs: Date.now() - started });
      return { answers, ...(errors.length ? { errors } : {}), lang };
    }

    const marja = getMarja(scholar);
    if (!marja) throw new HttpsError("invalid-argument", "Unknown scholar — pick one of the three Maraji'.");
    const hit = cacheGet([marja.id, question, lang]);
    if (hit && history.length === 0) {
      await audit({ ...base, lang, intent: "ASK_FIQH", scholar: marja.id, outcome: "ANSWERED", cached: true, latencyMs: Date.now() - started });
      return { answer: hit.answer, marja: marja.id, cached: true, lang };
    }
    // The questioner's words go in as a plain user message. The system block orders the model to treat them as data.
    const answer = await ask(`${buildMarjaSystemPrompt(marja)}\n\n${languageInstruction(lang)}\n\n${INJECTION_DEFENSE}`, toTurns(history, question));
    if (history.length === 0) cacheSet([marja.id, question, lang], { answer });
    await audit({ ...base, lang, intent: "ASK_FIQH", scholar: marja.id, outcome: "ANSWERED", latencyMs: Date.now() - started });
    return { answer, marja: marja.id, lang };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    await audit({ ...base, lang, intent, outcome: "ERROR", httpStatus: 500, errorCode: e instanceof Error ? e.message.slice(0, 200) : "unknown", latencyMs: Date.now() - started });
    throw new HttpsError("unavailable", "The guide could not answer just now. Please try again.");
  }
});

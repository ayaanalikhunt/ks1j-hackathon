// Fraud and conflict-of-interest: detection (pure), the checks and decisions (functions), and the guards that stop it.
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fr from "../../../functions/lib/fraud.js";

const ts = (iso: string) => ({ toDate: () => new Date(iso) });
const T = "2026-10-04T10:00:00Z";
const kinds = (flags: { kind: string }[]) => flags.map((f) => f.kind).sort();
const base = { cases: [], members: [], donations: [], allocations: [], disbursements: [] };

describe("fraud detection (pure)", () => {
  const c = (id: string, applicantId: string, extra: object = {}) => ({ id, ref: `CASE-2026-00000${id.slice(1)}`, applicantId, status: "submitted", ...extra });

  it("finds the same person under different accounts, however the phone is written", () => {
    const flags = fr.detectFraud({ ...base, cases: [c("c1", "u1", { applicantPhone: "+91 98765 43210" }), c("c2", "u2", { applicantPhone: "09876543210" })] });
    expect(kinds(flags)).toEqual(["duplicate_beneficiary"]);
    expect(flags[0].summary).toMatch(/phone/);
  });
  it("finds the same name and ID digits, or the same address, but not the same applicant (an older check handles that)", () => {
    const byId = fr.detectFraud({ ...base, cases: [c("c1", "u1", { applicantName: "Ali  Khan", idLast4: "1234" }), c("c2", "u2", { applicantName: "ali khan.", idLast4: "1234" })] });
    expect(kinds(byId)).toEqual(["duplicate_beneficiary"]);
    const addr = fr.detectFraud({ ...base, cases: [c("c1", "u1", { applicantAddress: "12, Hill Road, Mumbai 400050" }), c("c2", "u2", { applicantAddress: "12 hill road mumbai 400050" })] });
    expect(kinds(addr)).toEqual(["duplicate_beneficiary"]);
    expect(fr.detectFraud({ ...base, cases: [c("c1", "u1", { applicantPhone: "9876543210" }), c("c2", "u1", { applicantPhone: "9876543210" })] })).toEqual([]);
    expect(fr.detectFraud({ ...base, cases: [c("c1", "u1", { applicantName: "Ali Khan", idLast4: "1234" }), c("c2", "u2", { applicantName: "Ali Khan", idLast4: "9999" })] })).toEqual([]);
  });
  it("flags near-identical requests for nearly the same amount, not merely similar ones", () => {
    const text = { type: "education", title: "Class ten school fees", requirement: "Need money to pay my daughter's annual school fees this year" };
    expect(kinds(fr.detectFraud({ ...base, cases: [c("c1", "u1", { ...text, amountRequested: 20000 }), c("c2", "u2", { ...text, amountRequested: 20500 })] }))).toEqual(["similar_request"]);
    expect(fr.detectFraud({ ...base, cases: [c("c1", "u1", { ...text, amountRequested: 20000 }), c("c2", "u2", { ...text, amountRequested: 40000 })] })).toEqual([]);
    expect(fr.detectFraud({ ...base, cases: [c("c1", "u1", { ...text, amountRequested: 20000 }), c("c2", "u2", { ...text, requirement: "Surgery for my father at the city hospital", amountRequested: 20000 })] })).toEqual([]);
  });
  it("flags a possible double payment within ten minutes and one payment reused on two donations", () => {
    const d = (id: string, min: number, extra: object = {}) => ({ id, status: "paid", payerId: "p1", amount: 500, purpose: "ration", publicReference: `KS1J-DON-${id}`, createdAt: ts(new Date(Date.parse(T) + min * 60_000).toISOString()), ...extra });
    expect(kinds(fr.detectFraud({ ...base, donations: [d("a", 0), d("b", 9)] }))).toEqual(["duplicate_donation"]);
    expect(fr.detectFraud({ ...base, donations: [d("a", 0), d("b", 11)] })).toEqual([]);
    expect(fr.detectFraud({ ...base, donations: [d("a", 0), d("b", 1, { payerId: "p2" })] })).toEqual([]);
    expect(fr.detectFraud({ ...base, donations: [d("a", 0), d("b", 1, { amount: 600 })] })).toEqual([]);
    expect(kinds(fr.detectFraud({ ...base, donations: [d("a", 0, { paymentId: "pay_X" }), d("b", 500, { paymentId: "pay_X" })] }))).toEqual(["reused_payment_id"]);
  });
  it("flags duplicate payouts, a reused reference number and a reused proof", () => {
    const x = (id: string, extra: object = {}) => ({ id, status: "completed", allocationId: "al1", amount: 1000, method: "upi", createdAt: ts(T), ...extra });
    expect(kinds(fr.detectFraud({ ...base, disbursements: [x("x1"), x("x2")] }))).toEqual(["duplicate_disbursement"]);
    expect(fr.detectFraud({ ...base, disbursements: [x("x1"), x("x2", { amount: 900 })] })).toEqual([]);
    expect(kinds(fr.detectFraud({ ...base, disbursements: [x("x1", { allocationId: "a", referenceKey: "K" }), x("x2", { allocationId: "b", amount: 5, referenceKey: "K" })] }))).toEqual(["reused_reference"]);
    expect(kinds(fr.detectFraud({ ...base, disbursements: [x("x1", { allocationId: "a", proofKey: "P" }), x("x2", { allocationId: "b", amount: 5, proofKey: "P" })] }))).toEqual(["reused_proof"]);
  });
  it("flags committee members acting on their own or their household's case, and donors funding their own", () => {
    const members = [{ id: "u1", householdId: "h1" }, { id: "staff1", householdId: "h1" }, { id: "staff2", householdId: "h2" }];
    const cases = [c("c1", "u1", { verifiedBy: "staff1", approvedBy: "staff2" })];
    const out = fr.detectFraud({ ...base, members, cases });
    expect(kinds(out)).toEqual(["conflict_of_interest"]); // staff1 shares a household; staff2 does not
    expect(out[0].memberId).toBe("staff1");
    expect(kinds(fr.detectFraud({ ...base, members, cases: [c("c1", "u1", { approvedBy: "u1" })] }))).toEqual(["conflict_of_interest"]);
    expect(kinds(fr.detectFraud({ ...base, members, cases, allocations: [{ id: "a1", caseId: "c1", donorId: "u1", approvedBy: "staff2", amount: 1 }] }))).toEqual(["conflict_of_interest", "conflict_of_interest"]);
    expect(kinds(fr.detectFraud({ ...base, members, cases: [c("c1", "u1")], disbursements: [{ id: "x1", status: "completed", caseId: "c1", processedBy: "staff1", amount: 1, createdAt: ts(T) }] }))).toEqual(["conflict_of_interest"]);
  });
  it("names no one: no phone, name or address in any flag", () => {
    const flags = fr.detectFraud({ ...base, cases: [c("c1", "u1", { applicantPhone: "9876543210", applicantName: "Secret Name", applicantAddress: "Secret Lane 1234567" }), c("c2", "u2", { applicantPhone: "9876543210" })] });
    expect(JSON.stringify(flags)).not.toMatch(/9876543210|Secret/);
  });
  it("makes a stable key from a reference number, ignoring case and punctuation", () => {
    expect(fr.keyOf("UTR-123 456")).toBe(fr.keyOf("utr123456"));
    expect(fr.keyOf("abc")).toBeNull();
    expect(fr.keyOf(undefined)).toBeNull();
  });
});

describe("rules: never your own case", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: "ks1j-8a2e3", firestore: { rules: readFileSync("../../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "members", "fr-ver"), { role: "verifier", fullName: "v" });
      await setDoc(doc(db, "members", "fr-tru"), { role: "trustee", fullName: "t" });
      await setDoc(doc(db, "cases", "own-sub"), { applicantId: "fr-ver", status: "submitted" });
      await setDoc(doc(db, "cases", "own-ver"), { applicantId: "fr-tru", status: "verified", verifiedBy: "someone" });
      await setDoc(doc(db, "cases", "own-appr"), { applicantId: "fr-tru", status: "approved" });
      await setDoc(doc(db, "cases", "other-sub"), { applicantId: "someone-else", status: "submitted" });
    });
  });
  afterAll(() => env.cleanup());
  const as = (uid: string) => env.authenticatedContext(uid).firestore();
  it("a verifier cannot verify, and a trustee cannot approve or publish, a case they applied for", async () => {
    await assertFails(updateDoc(doc(as("fr-ver"), "cases", "own-sub"), { status: "verified", verifiedBy: "fr-ver" }));
    await assertFails(updateDoc(doc(as("fr-tru"), "cases", "own-ver"), { status: "approved", approvedBy: "fr-tru" }));
    await assertFails(updateDoc(doc(as("fr-tru"), "cases", "own-appr"), { status: "published", publishedBy: "fr-tru" }));
    await assertSucceeds(updateDoc(doc(as("fr-ver"), "cases", "other-sub"), { status: "verified", verifiedBy: "fr-ver" }));
  });
});

describe("fraud checks, decisions and guards (emulator)", () => {
  const PROJECT = "ks1j-8a2e3";
  const mk = async (uid: string, role: string, extra: object = {}) => {
    const app = initializeApp({ projectId: PROJECT, apiKey: "fake" }, `fr-${uid}`);
    const auth = getAuth(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    await adminAuth().createUser({ uid, email: `${uid}@test.invalid` });
    await adminDb().doc(`members/${uid}`).set({ role, fullName: uid, ...extra });
    await signInWithCustomToken(auth, await adminAuth().createCustomToken(uid));
    const fns = getFunctions(app, "asia-south1");
    connectFunctionsEmulator(fns, "127.0.0.1", 5001);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (name: string, d: unknown) => httpsCallable<unknown, any>(fns, name)(d).then((r) => r.data);
  };
  let admin: Awaited<ReturnType<typeof mk>>;
  let admin2: Awaited<ReturnType<typeof mk>>;
  let member: Awaited<ReturnType<typeof mk>>;
  let selfAdmin: Awaited<ReturnType<typeof mk>>;
  let kin: Awaited<ReturnType<typeof mk>>;
  const db = () => adminDb();

  beforeAll(async () => {
    initAdmin({ projectId: PROJECT });
    admin = await mk("fr-admin", "admin");
    admin2 = await mk("fr-admin2", "admin");
    member = await mk("fr-member", "member");
    selfAdmin = await mk("fr-self", "admin", { householdId: "hh-fr" });
    kin = await mk("fr-kin", "admin", { householdId: "hh-fr" });
    await db().doc("members/fr-applicant").set({ role: "member", fullName: "fr-applicant", householdId: "hh-fr" });
    // two cases from different accounts that share a phone number
    const c = { status: "published", amountRequested: 50000, raised: 0, applicantId: "fr-x", type: "medical" };
    await db().doc("cases/fr-dup1").set({ ...c, number: 870001, applicantPhone: "+91 99999 11111", applicantName: "A" });
    await db().doc("cases/fr-dup2").set({ ...c, applicantId: "fr-y", number: 870002, applicantPhone: "09999911111", applicantName: "B" });
    // a case that belongs to the self-admin's household
    await db().doc("cases/fr-own").set({ ...c, applicantId: "fr-self", number: 870003 });
    await db().doc("cases/fr-kin").set({ ...c, applicantId: "fr-applicant", number: 870004 });
  });

  it("only committee staff can run the checks; a member cannot", async () => {
    await expect(member("runFraudChecks", {})).rejects.toThrow(/Committee staff only/);
    const r = await admin("runFraudChecks", {});
    const flag = r.flags.find((f: { kind: string; summary: string }) => f.kind === "duplicate_beneficiary" && /phone/.test(f.summary));
    expect(flag).toBeTruthy();
    expect(flag.decision).toBeNull();
    expect(JSON.stringify(r.flags)).not.toMatch(/99999 ?11111/);
  });
  it("a decision needs a note, is stored and audited, and shows on the next run", async () => {
    const r = await admin("runFraudChecks", {});
    const flag = r.flags.find((f: { kind: string }) => f.kind === "duplicate_beneficiary");
    await expect(admin("decideFraudFlag", { id: flag.id, kind: flag.kind, status: "clear", note: "" })).rejects.toThrow(/how you checked/);
    await expect(admin("decideFraudFlag", { id: flag.id, kind: flag.kind, status: "maybe", note: "looked at it" })).rejects.toThrow(/decision/);
    await expect(member("decideFraudFlag", { id: flag.id, kind: flag.kind, status: "clear", note: "looked at it" })).rejects.toThrow(/staff only/);
    await admin("decideFraudFlag", { id: flag.id, kind: flag.kind, status: "confirmed", note: "Same family, called both numbers" });
    const again = await admin("runFraudChecks", {});
    expect(again.flags.find((f: { id: string }) => f.id === flag.id).decision).toMatchObject({ status: "confirmed", by: "fr-admin" });
    const logs = await db().collection("auditLogs").where("action", "==", "FRAUD_FLAG_DECIDED").get();
    expect(logs.size).toBeGreaterThanOrEqual(1);
  });
  it("a committee member cannot allocate, pay out, or close their own or their household's case", async () => {
    const don = await db().collection("donations").add({ payerId: "someone-fr", status: "paid", amount: 5000, fund: "general", purpose: "ration", allocatedAmount: 0, disbursedAmount: 0 });
    for (const who of [selfAdmin, kin]) {
      await expect(who("allocateDonation", { donationId: don.id, allocations: [{ caseId: "fr-own", amount: 1000 }] })).rejects.toThrow(/yours or your household/);
    }
    await expect(selfAdmin("closeCase", { caseId: "fr-own" })).rejects.toThrow(/yours or your household/);
    await expect(kin("payOutCase", { caseId: "fr-kin" })).rejects.toThrow(/yours or your household/);
    await admin("allocateDonation", { donationId: don.id, allocations: [{ caseId: "fr-own", amount: 1000 }] }); // another admin may
  });
  it("money from a donor cannot be allocated back to that donor's own case or household", async () => {
    const own = await db().collection("donations").add({ payerId: "fr-applicant", status: "paid", amount: 2000, fund: "general", purpose: "ration", allocatedAmount: 0, disbursedAmount: 0 });
    await expect(admin("allocateDonation", { donationId: own.id, allocations: [{ caseId: "fr-kin", amount: 500 }] })).rejects.toThrow(/own case or your household/);
    await expect(admin("allocateDonation", { donationId: own.id, allocations: [{ caseId: "fr-dup1", amount: 500 }] })).resolves.toBeTruthy();
  });
  it("a payout cannot be entered twice by accident, or reuse another payout's receipt or proof", async () => {
    const don = await db().collection("donations").add({ payerId: "someone-fr2", status: "paid", amount: 9000, fund: "general", purpose: "ration", allocatedAmount: 0, disbursedAmount: 0 });
    await admin("allocateDonation", { donationId: don.id, allocations: [{ caseId: "fr-dup2", amount: 9000 }] });
    const al = (await db().collection("allocations").where("donationId", "==", don.id).get()).docs[0].id;
    const pay = (extra: object) => admin("createDisbursement", { allocationId: al, amount: 1000, method: "bank_transfer", ...extra });
    await pay({ referenceNumber: "UTR 55501", proofPath: "private/p/one.pdf" });
    await expect(pay({})).rejects.toThrow(/identical payout/);
    await pay({ confirmDuplicate: true, referenceNumber: "UTR 55502" }); // on purpose, with a new reference
    await expect(pay({ confirmDuplicate: true, referenceNumber: "utr-55501" })).rejects.toThrow(/reference number was already used/);
    await expect(pay({ confirmDuplicate: true, referenceNumber: "UTR 55503", proofPath: "PRIVATE/p/one.PDF" })).rejects.toThrow(/proof document was already used/);
    await admin2("createDisbursement", { allocationId: al, amount: 500, method: "cash", referenceNumber: "UTR 55504" }); // a different payout is fine
  });
});

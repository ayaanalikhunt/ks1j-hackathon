// Loan reminders (gentle, once each, never a fee) and the public loan page (a reference, amounts, status, no identities).
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { beforeAll, describe, expect, it } from "vitest";
import * as pl from "../../../functions/lib/publicLoan.js";
import * as rm from "../../../functions/lib/reminders.js";

const DUE = "2027-03-10";
const day = (offset: number) => new Date(Date.UTC(2027, 2, 10 + offset)).toISOString().slice(0, 10);
const loan = (extra: object = {}) => ({ id: "L1", status: "repaying", borrowerId: "u1", emi: 2000, principal: 20000, repaid: 4000, nextDue: DUE, guarantorName: "G Person", guarantorPhone: "+91 90000 00000", ...extra });
const plan = (loans: object[], today: string, extra: Partial<{ paused: string[]; sent: string[] }> = {}) =>
  rm.planReminders({ loans, pausedLoanIds: new Set(extra.paused ?? []), sentKeys: new Set(extra.sent ?? []), today });

describe("loan reminder planning (pure)", () => {
  it("sends the right gentle step on the right day, and nothing earlier than three days before", () => {
    expect(plan([loan()], day(-4))).toEqual([]);
    expect(plan([loan()], day(-3))[0].kind).toBe("upcoming");
    expect(plan([loan()], day(0))[0].kind).toBe("due_today");
    expect(plan([loan()], day(1))[0].kind).toBe("late_1");
    expect(plan([loan()], day(7))[0].kind).toBe("late_7");
    expect(plan([loan()], day(14))[0].kind).toBe("late_14");
    expect(plan([loan()], day(15))[0].kind).toBe("follow_up");
  });
  it("after a missed day it sends only the latest step, not a pile of old ones", () => {
    expect(plan([loan()], day(5)).map((x) => x.kind)).toEqual(["late_1"]);
    expect(plan([loan()], day(40)).map((x) => x.kind)).toEqual(["follow_up"]);
  });
  it("never repeats a step for the same due date, and starts again when the due date moves", () => {
    expect(plan([loan()], day(1), { sent: [`L1_${DUE}_late_1`] })).toEqual([]);
    expect(plan([loan({ nextDue: "2027-04-10" })], day(1))).toEqual([]); // a new due date in the future: nothing yet
    expect(plan([loan({ nextDue: day(1) })], day(2), { sent: [`L1_${DUE}_late_1`] })[0].kind).toBe("late_1"); // paid, moved on, late again
  });
  it("a person is asked to reach out from 15 days late, with the guarantor's details for staff only", () => {
    const [r] = plan([loan()], day(20));
    expect(r.task).toMatchObject({ id: `L1_${DUE}`, daysLate: 20, guarantorName: "G Person", emi: 2000, left: 16000 });
    expect(plan([loan()], day(14))[0].task).toBeUndefined();
    expect(r.text).not.toMatch(/G Person|90000/); // the message to the borrower holds no guarantor details
  });
  it("is silent for a pending hardship request, an unpaid-out loan, a repaid loan, or a loan with no borrower", () => {
    expect(plan([loan()], day(3), { paused: ["L1"] })).toEqual([]);
    expect(plan([loan({ status: "agreed" }), loan({ id: "L2", status: "closed" }), loan({ id: "L3", repaid: 20000 }), loan({ id: "L4", borrowerId: undefined })], day(3))).toEqual([]);
  });
  it("asks for the instalment, or what is left if that is smaller", () => {
    expect(plan([loan({ repaid: 19000 })], day(0))[0].text).toMatch(/₹1,000/);
    expect(plan([loan()], day(0))[0].text).toMatch(/₹2,000/);
  });
  it("is always kind: says there is no late fee, never threatens, and offers a pause", () => {
    for (const off of [-3, 0, 1, 7, 14, 15]) {
      const t = plan([loan()], day(off))[0].text;
      expect(t).toMatch(/no (interest and no )?late fee|No late fee|no late fee/i);
      expect(t).not.toMatch(/penalt|legal|court|police|default|blacklist|action will be taken/i);
    }
    expect(plan([loan()], day(7))[0].text).toMatch(/pause or a lower amount/);
  });
  it("works out India's date, not UTC's", () => {
    expect(rm.istToday(new Date("2027-03-10T20:00:00Z"))).toBe("2027-03-11");
    expect(rm.istToday(new Date("2027-03-10T10:00:00Z"))).toBe("2027-03-10");
  });
});

describe("public loan view (pure)", () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) });
  const l = { publicLoanId: "LOAN-2026-000042", status: "repaying", principal: 50000, repaid: 20000, borrowerName: "Secret Payer", studentName: "Secret Student", course: "Secret College MBBS", guarantorName: "Secret G", guarantorPhone: "99999", borrowerId: "SECRET-UID", orphan: true, createdAt: ts("2026-06-01T00:00:00Z"), agreedAt: ts("2026-07-01T00:00:00Z"), disbursedAt: ts("2026-07-05T00:00:00Z") };
  it("shows the amounts, status and only the dates that really happened", () => {
    const p = pl.buildPublicLoan(l);
    expect(p).toMatchObject({ reference: "LOAN-2026-000042", purpose: "Education", approved: 50000, disbursed: 50000, repaid: 20000, outstanding: 30000, repaidPercent: 40, statusLabel: "Active: being repaid" });
    expect(p.timeline.map((x: { label: string }) => x.label)).toEqual(["Application received", "Repayment plan agreed", "Funds disbursed"]);
  });
  it("names no one: no borrower, student, course, guarantor, id or orphan status", () => {
    expect(JSON.stringify(pl.buildPublicLoan(l))).not.toMatch(/Secret|99999|SECRET|orphan/i);
    expect(JSON.stringify(pl.summarizeLoan(l))).not.toMatch(/Secret|99999|SECRET|orphan/i);
  });
  it("marks a repaid loan complete and reads a reference", () => {
    const p = pl.buildPublicLoan({ ...l, status: "closed", repaid: 50000, closedAt: ts("2027-01-01T00:00:00Z") });
    expect(p).toMatchObject({ outstanding: 0, repaidPercent: 100, statusLabel: "Fully repaid" });
    expect(p.timeline.at(-1).label).toBe("Fully repaid");
    expect(pl.publicLoanRef(42, new Date("2026-10-04T00:00:00Z"))).toBe("LOAN-2026-000042");
    expect(pl.numberFromLoanRef("LOAN-2026-000042")).toBe(42);
    expect(pl.numberFromLoanRef("CASE-2026-000042")).toBeNull();
  });
});

describe("loans on the emulators", () => {
  const PROJECT = "ks1j-8a2e3";
  const mk = async (uid: string, role: string) => {
    const app = initializeApp({ projectId: PROJECT, apiKey: "fake" }, `lp-${uid}`);
    const auth = getAuth(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    await adminAuth().createUser({ uid, email: `${uid}@test.invalid` });
    await adminDb().doc(`members/${uid}`).set({ role, fullName: uid });
    await signInWithCustomToken(auth, await adminAuth().createCustomToken(uid));
    const fns = getFunctions(app, "asia-south1");
    connectFunctionsEmulator(fns, "127.0.0.1", 5001);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (name: string, d: unknown) => httpsCallable<unknown, any>(fns, name)(d).then((r) => r.data);
  };
  const anonApp = initializeApp({ projectId: PROJECT, apiKey: "fake" }, "lp-anon");
  const anonFns = getFunctions(anonApp, "asia-south1");
  connectFunctionsEmulator(anonFns, "127.0.0.1", 5001);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anon = (name: string, d: unknown) => httpsCallable<unknown, any>(anonFns, name)(d).then((r) => r.data);
  let admin: Awaited<ReturnType<typeof mk>>;
  let trustee: Awaited<ReturnType<typeof mk>>;
  let member: Awaited<ReturnType<typeof mk>>;
  const db = () => adminDb();
  const texts = async (uid: string) => (await db().collection("notifications").where("userId", "==", uid).get()).docs.map((d) => d.get("text") as string);

  beforeAll(async () => {
    initAdmin({ projectId: PROJECT });
    admin = await mk("lp-admin", "admin");
    trustee = await mk("lp-trustee", "trustee");
    member = await mk("lp-member", "member");
  });

  it("a loan gets a public reference when it is paid out, and only then is it public", async () => {
    const base = { borrowerId: "lp-b1", borrowerName: "Hidden Payer", studentName: "Hidden Student", course: "Hidden Course", principal: 30000, emi: 1500, courseEnd: "2027-06-30", guarantorName: "Hidden G", createdAt: Timestamp.now() };
    await db().doc("loans/lp-l1").set({ ...base, status: "agreed" });
    await expect(anon("getPublicLoan", { ref: "LOAN-2026-987654" })).rejects.toThrow(/No public loan/);
    await admin("disburseLoan", { loanId: "lp-l1" });
    const l = (await db().doc("loans/lp-l1").get()).data()!;
    expect(l.publicLoanId).toMatch(/^LOAN-\d{4}-\d{6}$/);
    const pub = await anon("getPublicLoan", { ref: l.publicLoanId });
    expect(pub).toMatchObject({ purpose: "Education", approved: 30000, disbursed: 30000, repaid: 0, outstanding: 30000 });
    expect(JSON.stringify(pub)).not.toMatch(/Hidden|lp-b1/);
    await db().doc("loans/lp-l2").set({ ...base, status: "agreed" });
    await admin("disburseLoan", { loanId: "lp-l2" });
    expect((await db().doc("loans/lp-l2").get()).get("publicLoanNumber")).toBe(l.publicLoanNumber + 1); // sequential
    await db().doc("loans/lp-l3").set({ ...base, status: "applied" });
    const list = await anon("listPublicLoans", {});
    expect(list.loans.map((x: { reference: string }) => x.reference)).toContain(l.publicLoanId);
    expect(JSON.stringify(list)).not.toMatch(/Hidden/);
    await expect(anon("getPublicLoan", { ref: "lp-l3" })).rejects.toThrow(/not a loan reference/);
    const totals = (await db().doc("publicStats/transparency").get()).data()!;
    expect(totals.loansLent).toBeGreaterThanOrEqual(60000);
    expect(totals.loansActive).toBeGreaterThanOrEqual(2);
  });

  it("the daily run sends each reminder once, opens a follow-up from 15 days late, and respects a pending hardship", async () => {
    await db().doc("loans/rm-1").set({ status: "repaying", borrowerId: "rm-borrower", emi: 2000, principal: 20000, repaid: 4000, nextDue: "2027-03-10", guarantorName: "Guarantor X", guarantorPhone: "+91 90000 11111" });
    await db().doc("loans/rm-2").set({ status: "repaying", borrowerId: "rm-paused", emi: 2000, principal: 20000, repaid: 0, nextDue: "2027-03-10" });
    await db().doc("hardships/rm-h").set({ loanId: "rm-2", status: "pending", type: "pause" });

    await expect(member("runLoanReminders", {})).rejects.toThrow(/Admins only/);
    const first = await admin("runLoanReminders", { asOf: "2027-03-07" }); // three days before
    expect(first.reminders).toBeGreaterThanOrEqual(1);
    expect((await texts("rm-borrower")).join(" ")).toMatch(/due on 10\/03\/2027/);
    expect(await texts("rm-paused")).toEqual([]);

    await admin("runLoanReminders", { asOf: "2027-03-07" }); // run again: nothing repeated
    expect((await texts("rm-borrower")).length).toBe(1);

    await admin("runLoanReminders", { asOf: "2027-03-11" });
    expect((await texts("rm-borrower")).length).toBe(2);
    expect((await db().collection("loanFollowUps").get()).size).toBe(0); // too early for a person to call

    const late = await admin("runLoanReminders", { asOf: "2027-03-26" });
    expect(late.tasks).toBe(1);
    const task = (await db().doc("loanFollowUps/rm-1_2027-03-10").get()).data()!;
    expect(task).toMatchObject({ status: "open", daysLate: 16, guarantorName: "Guarantor X", left: 16000 });
    expect((await texts("rm-borrower")).join(" ")).toMatch(/committee will get in touch/);
    await admin("runLoanReminders", { asOf: "2027-03-27" });
    expect((await db().collection("loanFollowUps").get()).size).toBe(1); // still one task
    expect((await texts("rm-borrower")).join(" ")).not.toMatch(/Guarantor X|90000/);
  });

  it("a person records the follow-up with a note; members cannot; it is audited and cannot be closed twice", async () => {
    await expect(member("completeLoanFollowUp", { id: "rm-1_2027-03-10", note: "Called the family" })).rejects.toThrow(/Trustees and admins only/);
    await expect(trustee("completeLoanFollowUp", { id: "rm-1_2027-03-10", note: "ok" })).rejects.toThrow(/at least a few words/);
    await trustee("completeLoanFollowUp", { id: "rm-1_2027-03-10", note: "Called the family, they will pay on the 30th" });
    expect((await db().doc("loanFollowUps/rm-1_2027-03-10").get()).data()).toMatchObject({ status: "done", doneBy: "lp-trustee" });
    await expect(trustee("completeLoanFollowUp", { id: "rm-1_2027-03-10", note: "Called again today" })).rejects.toThrow(/not open/);
    expect((await db().collection("auditLogs").where("action", "==", "LOAN_FOLLOW_UP_DONE").get()).size).toBe(1);
  });
});

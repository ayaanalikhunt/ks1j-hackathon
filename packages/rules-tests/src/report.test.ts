// The committee report: totals come from verified records on the server, filters narrow them, and nobody is named.
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { beforeAll, describe, expect, it } from "vitest";
import * as rp from "../../../functions/lib/report.js";

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

const data = () => ({
  donations: [
    { id: "d1", status: "paid", amount: 10000, purpose: "healthcare", fund: "general", displayCurrency: "USD", displayAmount: 110, createdAt: ts("2026-10-02T06:00:00Z"), allocatedAmount: 10000, disbursedAmount: 4000, payerId: "SECRET-DONOR-1", publicReference: "KS1J-DON-2026-000001" },
    { id: "d2", status: "paid", amount: 5000, purpose: "ration", fund: "general", createdAt: ts("2026-10-10T06:00:00Z"), allocatedAmount: 2000, disbursedAmount: 0, payerId: "SECRET-DONOR-2" },
    { id: "d3", status: "pending", amount: 700, purpose: "ration", createdAt: ts("2026-10-11T06:00:00Z") },
    { id: "d4", status: "refunded", amount: 300, purpose: "ration", createdAt: ts("2026-10-03T06:00:00Z") },
  ],
  allocations: [
    { id: "a1", donationId: "d1", caseId: "c1", amount: 8000, category: "healthcare", status: "allocated", disbursedAmount: 4000, reservedAmount: 4000, approvedBy: "adm1" },
    { id: "a2", donationId: "d1", caseId: "c2", amount: 2000, category: "education_fees", status: "allocated", disbursedAmount: 0, reservedAmount: 0, approvedBy: "adm2" },
    { id: "a3", donationId: "d2", caseId: "c1", amount: 2000, category: "ration", status: "allocated", disbursedAmount: 0, reservedAmount: 0, approvedBy: "adm1" },
    { id: "a4", donationId: "d2", caseId: "c2", amount: 999, category: "ration", status: "reversed", disbursedAmount: 0, reservedAmount: 0, approvedBy: "adm1" },
  ],
  disbursements: [{ id: "x1", allocationId: "a1", status: "completed", processedBy: "adm1", amount: 4000 }],
  cases: [
    { id: "c1", ref: "CASE-2026-000001", status: "published", amountRequested: 20000, raised: 10000 },
    { id: "c2", ref: "CASE-2026-000002", status: "funded", amountRequested: 2000, raised: 2000 },
    { id: "c3", ref: "CASE-2026-000003", status: "submitted" },
    { id: "c4", ref: "CASE-2026-000004", status: "closed" },
    { id: "c5", ref: "CASE-2026-000005", status: "verified" },
  ],
  loans: [
    { id: "l1", status: "repaying", principal: 50000, repaid: 10000 },
    { id: "l2", status: "closed", principal: 20000, repaid: 20000 },
    { id: "l3", status: "agreed", principal: 30000 },
  ],
});

describe("committee report (pure)", () => {
  it("adds up verified money only: pending and refunded gifts are not donations", () => {
    const r = rp.buildReport(data());
    expect(r.totals).toEqual({ verifiedDonations: 15000, donationCount: 2, allocated: 12000, unallocated: 3000, disbursed: 4000, pendingDisbursement: 8000, refunded: 300, awaitingVerification: 700 });
    expect(r.totals.verifiedDonations).toBe(r.totals.allocated + r.totals.unallocated); // donation = allocations + unallocated
  });
  it("breaks money down by purpose, fund, currency, allocation category and case", () => {
    const r = rp.buildReport(data());
    expect(r.byPurpose.find((x: { key: string }) => x.key === "healthcare")).toMatchObject({ amount: 10000, allocated: 10000, disbursed: 4000 });
    expect(r.byCurrency.map((x: { key: string }) => x.key).sort()).toEqual(["INR", "USD"]);
    expect(r.byCategory.map((x: { key: string }) => x.key).sort()).toEqual(["education_fees", "healthcare", "ration"]); // the reversed one is not counted
    expect(r.cases[0]).toMatchObject({ reference: "CASE-2026-000001", allocated: 10000, disbursed: 4000, raised: 10000 });
  });
  it("filters by date in India time, currency, category, case and committee member", () => {
    const d = data();
    expect(rp.buildReport(d, { from: "2026-10-05" }).totals.verifiedDonations).toBe(5000);
    expect(rp.buildReport(d, { to: "2026-10-02" }).totals.verifiedDonations).toBe(10000);
    expect(rp.buildReport(d, { from: "2026-10-02", to: "2026-10-02" }).totals.verifiedDonations).toBe(10000); // the whole day counts
    expect(rp.buildReport(d, { currency: "USD" }).totals.verifiedDonations).toBe(10000);
    expect(rp.buildReport(d, { category: "ration" }).totals.verifiedDonations).toBe(5000);
    expect(rp.buildReport(d, { status: "refunded" }).totals.refunded).toBe(300);
    expect(rp.buildReport(d, { caseId: "c2" }).totals.allocated).toBe(2000);
    const byMember = rp.buildReport(d, { memberId: "adm1" });
    expect(byMember.totals.allocated).toBe(10000);
    expect(byMember.totals.disbursed).toBe(4000);
  });
  it("shows the case pipeline and what is still needed", () => {
    expect(rp.buildReport(data()).pipeline).toMatchObject({ pendingVerification: 1, awaitingApproval: 1, fundingOpen: 1, fundedAwaitingPayout: 1, completed: 1, outstanding: 2, stillNeeded: 10000 });
  });
  it("keeps loans apart from donations", () => {
    const r = rp.buildReport(data());
    expect(r.loans).toMatchObject({ count: 2, active: 1, lent: 70000, repaid: 30000, outstanding: 40000, pendingApproval: 1 });
    expect(r.donationVsLoan).toEqual({ donations: 15000, loansLent: 70000, loansRepaid: 30000 });
  });
  it("reconciles, and reports a mismatch instead of hiding it", () => {
    expect(rp.buildReport(data()).reconciliation.ok).toBe(true);
    const bad = data();
    bad.donations[0].allocatedAmount = 9000;
    const r = rp.buildReport(bad);
    expect(r.reconciliation.ok).toBe(false);
    expect(r.reconciliation.warnings[0].donation).toBe("KS1J-DON-2026-000001");
  });
  it("names no donor", () => {
    expect(JSON.stringify(rp.buildReport(data()))).not.toMatch(/SECRET|payerId|donorId/);
  });
});

describe("committee report (emulator)", () => {
  const PROJECT = "ks1j-8a2e3";
  const mk = async (uid: string, role: string) => {
    const app = initializeApp({ projectId: PROJECT, apiKey: "fake" }, `rep-${uid}`);
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
  let admin: Awaited<ReturnType<typeof mk>>;
  let trustee: Awaited<ReturnType<typeof mk>>;
  beforeAll(async () => {
    initAdmin({ projectId: PROJECT });
    admin = await mk("rep-admin", "admin");
    trustee = await mk("rep-trustee", "trustee");
    const db = adminDb();
    await db.doc("cases/rep-c1").set({ number: 880001, status: "published", amountRequested: 9000, raised: 4000, applicantId: "x" });
    await db.doc("donations/rep-d1").set({ status: "paid", amount: 4000, purpose: "healthcare", fund: "general", createdAt: Timestamp.fromDate(new Date("2026-09-15T06:00:00Z")), allocatedAmount: 4000, disbursedAmount: 0, payerId: "rep-secret" });
    await db.doc("allocations/rep-a1").set({ donationId: "rep-d1", caseId: "rep-c1", amount: 4000, category: "healthcare", status: "allocated", disbursedAmount: 0, reservedAmount: 0, approvedBy: "rep-admin" });
  });

  it("only admins can run it", async () => {
    await expect(trustee("getFinancialReport", {})).rejects.toThrow(/Admins only/);
  });
  it("runs from the real records, filters by case reference and date, and rejects bad input", async () => {
    const all = await admin("getFinancialReport", {});
    expect(all.totals.verifiedDonations).toBeGreaterThanOrEqual(4000);
    const one = await admin("getFinancialReport", { caseRef: "CASE-2026-880001", from: "2026-09-01", to: "2026-09-30" });
    expect(one.totals).toMatchObject({ verifiedDonations: 4000, allocated: 4000, unallocated: 0, disbursed: 0 });
    expect(one.cases[0]).toMatchObject({ reference: expect.stringMatching(/^CASE-\d{4}-880001$/), requested: 9000 });
    expect(JSON.stringify(one)).not.toContain("rep-secret");
    await expect(admin("getFinancialReport", { caseRef: "CASE-2026-123456" })).rejects.toThrow(/No case/);
    await expect(admin("getFinancialReport", { from: "04/10/2026" })).rejects.toThrow(/must be a date/);
  });
});

// Allocation, disbursement, reconciliation and transparency on the emulators. Donations are seeded as already verified
// (the Razorpay path has its own tests), so these exercise only what happens after the money is real.
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, where } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { beforeAll, describe, expect, it } from "vitest";
import * as al from "../../../functions/lib/allocation.js";

const PROJECT = "ks1j-8a2e3";
let n = 0;
function client(name: string) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "fake" }, `${name}-${n++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  return { auth, db, fns };
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

describe("allocation rules (pure)", () => {
  const base = { fund: "general", purpose: "general_support" };
  const open = { status: "published", amountRequested: 1000, raised: 0 };
  it("restricted money only goes to eligible cases", () => {
    expect(al.canAllocate(base, open).ok).toBe(true);
    expect(al.canAllocate({ ...base, purpose: "zakat" }, open).ok).toBe(false);
    expect(al.canAllocate({ ...base, purpose: "zakat" }, { ...open, zakatEligible: true }).ok).toBe(true);
    expect(al.canAllocate({ ...base, purpose: "khums" }, open).ok).toBe(false);
    expect(al.canAllocate({ fund: "sehme_sadaat", purpose: "general_support" }, open).ok).toBe(false);
    expect(al.canAllocate({ fund: "sehme_sadaat", purpose: "general_support" }, { ...open, beneficiarySadaatVerified: true }).ok).toBe(true);
    expect(al.canAllocate(base, { ...open, status: "submitted" }).ok).toBe(false);
  });
  it("reconciliation flags over-allocation and mismatched totals, and passes clean books", () => {
    const d = { amount: 1000, allocatedAmount: 600, disbursedAmount: 200 };
    const a = [{ id: "a", amount: 600, status: "allocated", disbursedAmount: 200, reservedAmount: 200 }];
    expect(al.reconcileDonation(d, a)).toEqual([]);
    expect(al.reconcileDonation({ ...d, allocatedAmount: 700 }, a).length).toBe(1);
    expect(al.reconcileDonation(d, [{ ...a[0], amount: 1200 }]).length).toBeGreaterThan(0);
    expect(al.reconcileDonation({ ...d, disbursedAmount: 0 }, a).length).toBe(1);
  });
  it("public totals count only verified money and name no one", () => {
    const s = al.summarize({
      donations: [{ status: "paid", amount: 1000, allocatedAmount: 600, disbursedAmount: 200 }, { status: "pending", amount: 999 }, { status: "refunded", amount: 500 }],
      allocations: [{ status: "allocated", caseId: "c1", disbursedAmount: 200 }, { status: "reversed", caseId: "c2", disbursedAmount: 0 }],
      cases: [{ status: "published" }, { status: "closed" }, { status: "submitted" }],
    });
    expect(s).toEqual({ totalDonated: 1000, totalAllocated: 600, totalDisbursed: 200, donationCount: 1, casesAssisted: 1, casesCompleted: 1, casesFunding: 1, casesUnderReview: 1 });
  });
});

describe("allocation, disbursement and transparency, end to end", () => {
  let donor: ReturnType<typeof client>;
  let other: ReturnType<typeof client>;
  let admin1: ReturnType<typeof client>;
  let admin2: ReturnType<typeof client>;
  const db = () => adminDb();
  const seedCase = (id: string, extra: object = {}) =>
    db().doc(`cases/${id}`).set({ status: "published", applicantId: "x", amountRequested: 30000, raised: 0, number: 1, title: "T", ...extra });
  let donationId = "";

  beforeAll(async () => {
    initAdmin({ projectId: PROJECT });
    donor = await person("al-donor", "member");
    other = await person("al-other", "member");
    admin1 = await person("al-admin1", "admin");
    admin2 = await person("al-admin2", "admin");
    await seedCase("al-c1");
    await seedCase("al-c2");
    await seedCase("al-small", { amountRequested: 1000 });
    const ref = await db().collection("donations").add({
      payerId: "al-donor", donorId: "al-donor", status: "paid", amount: 20000, fund: "general", purpose: "healthcare", baseCurrency: "INR",
      allocatedAmount: 0, disbursedAmount: 0, publicReference: "KS1J-DON-2026-000001", visibility: "private",
    });
    donationId = ref.id;
  });

  it("refuses to allocate more than the verified amount, to a case that needs less, or by a non-admin", async () => {
    await expect(call(donor, "allocateDonation", { donationId, allocations: [{ caseId: "al-c1", amount: 100 }] })).rejects.toThrow(/Admins only/);
    await expect(call(admin1, "allocateDonation", { donationId, allocations: [{ caseId: "al-c1", amount: 15000 }, { caseId: "al-c2", amount: 6000 }] })).rejects.toThrow(/unallocated/);
    await expect(call(admin1, "allocateDonation", { donationId, allocations: [{ caseId: "al-small", amount: 5000 }] })).rejects.toThrow(/needs only/);
    expect((await db().doc(`donations/${donationId}`).get()).get("allocatedAmount")).toBe(0);
  });

  it("splits a donation across cases and the books reconcile", async () => {
    await call(admin1, "allocateDonation", { donationId, allocations: [{ caseId: "al-c1", amount: 12000, category: "healthcare" }, { caseId: "al-c2", amount: 5000, category: "education_fees" }] });
    const d = (await db().doc(`donations/${donationId}`).get()).data()!;
    expect(d).toMatchObject({ allocatedAmount: 17000, allocationStatus: "partially_allocated" });
    expect((await db().doc("cases/al-c1").get()).get("raised")).toBe(12000);
    await expect(call(admin1, "allocateDonation", { donationId, allocations: [{ caseId: "al-c1", amount: 3001 }] })).rejects.toThrow(/unallocated/);
    const rec = await call(admin1, "reconcileFunds", {});
    expect(rec.warnings.filter((w: { donation: string }) => w.donation === "KS1J-DON-2026-000001")).toEqual([]);
  });

  it("Zakat money is not given to a case the committee has not marked eligible", async () => {
    const z = await db().collection("donations").add({ payerId: "al-donor", status: "paid", amount: 1000, fund: "general", purpose: "zakat", allocatedAmount: 0, disbursedAmount: 0 });
    await expect(call(admin1, "allocateDonation", { donationId: z.id, allocations: [{ caseId: "al-c2", amount: 1000 }] })).rejects.toThrow(/Zakat/);
    await seedCase("al-zakat", { zakatEligible: true });
    await call(admin1, "allocateDonation", { donationId: z.id, allocations: [{ caseId: "al-zakat", amount: 1000 }] });
  });

  it("the donor sees their own allocations and no one else does; recipient details stay private", async () => {
    const mine = await getDocs(query(collection(donor.db, "allocations"), where("donorId", "==", "al-donor")));
    expect(mine.size).toBeGreaterThanOrEqual(2);
    await expect(getDocs(query(collection(other.db, "allocations"), where("donorId", "==", "al-donor")))).rejects.toThrow();
    const alloc = mine.docs.find((x) => x.get("amount") === 12000)!;
    // 12000 is below the approval threshold, so it completes at once
    const r = await call(admin1, "createDisbursement", { allocationId: alloc.id, amount: 12000, method: "bank_transfer", recipientType: "hospital", recipientName: "City Hospital", referenceNumber: "UTR123", proofPath: "private/proofs/x.pdf" });
    expect(r.needsApproval).toBe(false);
    const dis = await getDocs(query(collection(donor.db, "disbursements"), where("donorId", "==", "al-donor")));
    expect(dis.size).toBe(1);
    expect(dis.docs[0].data()).not.toHaveProperty("recipientName");
    await expect(getDoc(doc(donor.db, "disbursements", dis.docs[0].id, "private", "details"))).rejects.toThrow();
    await expect(call(admin1, "verifyDisbursementProof", { id: r.id })).rejects.toThrow(/other than/);
    await call(admin2, "verifyDisbursementProof", { id: r.id });
    expect((await db().doc(`donations/${donationId}`).get()).get("disbursedAmount")).toBe(12000);
    await expect(call(admin1, "reverseAllocation", { allocationId: alloc.id, reason: "wrong case entered" })).rejects.toThrow(/already been paid/);
  });

  it("a large payout needs a different admin to approve it", async () => {
    await db().doc("settings/payments").set({ disbursementCheckerThreshold: 4000 }, { merge: true });
    const alloc = (await db().collection("allocations").where("donationId", "==", donationId).where("amount", "==", 5000).get()).docs[0];
    const r = await call(admin1, "createDisbursement", { allocationId: alloc.id, amount: 4500, method: "upi" });
    expect(r.needsApproval).toBe(true);
    expect((await db().doc(`donations/${donationId}`).get()).get("disbursedAmount")).toBe(12000); // not counted yet
    await expect(call(admin1, "decideDisbursement", { id: r.id, approve: true })).rejects.toThrow(/different admin/);
    await expect(call(admin1, "createDisbursement", { allocationId: alloc.id, amount: 600, method: "upi" })).rejects.toThrow(/left to pay out/);
    await call(admin2, "decideDisbursement", { id: r.id, approve: true });
    expect((await db().doc(`donations/${donationId}`).get()).get("disbursedAmount")).toBe(16500);
    expect((await db().doc(`allocations/${alloc.id}`).get()).get("disbursedAmount")).toBe(4500);
  });

  it("an unspent allocation can be reversed, with a reason, and the case total drops back", async () => {
    const free = await db().collection("donations").add({ payerId: "al-donor", status: "paid", amount: 2000, fund: "general", purpose: "ration", allocatedAmount: 0, disbursedAmount: 0 });
    await call(admin1, "allocateDonation", { donationId: free.id, allocations: [{ caseId: "al-c2", amount: 2000 }] });
    const a2 = (await db().collection("allocations").where("donationId", "==", free.id).get()).docs[0];
    await expect(call(admin1, "reverseAllocation", { allocationId: a2.id, reason: "x" })).rejects.toThrow(/reason/);
    const before = (await db().doc("cases/al-c2").get()).get("raised");
    await call(admin1, "reverseAllocation", { allocationId: a2.id, reason: "Entered against the wrong case" });
    expect((await db().doc("cases/al-c2").get()).get("raised")).toBe(before - 2000);
    expect((await db().doc(`donations/${free.id}`).get()).get("allocatedAmount")).toBe(0);
  });

  it("public totals come from verified records, and every step is in the audit log and the donor notifications", async () => {
    const t = (await getDoc(doc(client("anon").db, "publicStats", "transparency"))).data()!;
    expect(t.totalDonated).toBeGreaterThanOrEqual(20000);
    expect(t.totalDisbursed).toBeGreaterThanOrEqual(16500);
    expect(t).not.toHaveProperty("donors");
    const actions = (await db().collection("auditLogs").get()).docs.map((x) => x.get("action"));
    for (const a of ["ALLOCATION_CREATED", "ALLOCATION_REVERSED", "DISBURSEMENT_COMPLETED", "DISBURSEMENT_APPROVED", "PROOF_VERIFIED"]) expect(actions).toContain(a);
    const notes = await getDocs(query(collection(donor.db, "notifications"), where("userId", "==", "al-donor")));
    const text = notes.docs.map((x) => x.get("text")).join(" ");
    expect(text).toMatch(/allocated to Case/);
    expect(text).toMatch(/disbursed/);
    await expect(getDocs(query(collection(other.db, "notifications"), where("userId", "==", "al-donor")))).rejects.toThrow();
  });
});

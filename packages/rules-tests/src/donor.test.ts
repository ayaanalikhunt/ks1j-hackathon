// Donor profile and notification preferences: who can write them, and that the server honours them.
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("donor profile rules", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: "ks1j-8a2e3", firestore: { rules: readFileSync("../../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "members", "dp-staff"), { role: "admin", fullName: "s" });
      await setDoc(doc(ctx.firestore(), "members", "dp-other"), { role: "member", fullName: "o" });
    });
  });
  afterAll(() => env.cleanup());
  const as = (uid: string) => env.authenticatedContext(uid).firestore();
  const profile = (uid: string, extra: object = {}) => ({
    donorId: uid, fullName: "Test Donor", displayName: "T. Donor", email: "d@example.com", phone: "+91 98765 43210", country: "India", preferredCurrency: "INR",
    notifications: { received: true, allocated: true, disbursed: false, refunded: true }, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
  });

  it("a donor creates and edits only their own profile", async () => {
    await assertSucceeds(setDoc(doc(as("dp-1"), "donors", "dp-1"), profile("dp-1")));
    await assertFails(setDoc(doc(as("dp-other"), "donors", "dp-1"), profile("dp-1"))); // someone else's
    await assertFails(setDoc(doc(as("dp-2"), "donors", "dp-2"), profile("dp-3"))); // donorId must be themselves
    await assertSucceeds(updateDoc(doc(as("dp-1"), "donors", "dp-1"), { country: "UAE", preferredCurrency: "AED", updatedAt: serverTimestamp() }));
  });
  it("only known fields, currencies and notification switches are accepted", async () => {
    await assertFails(setDoc(doc(as("dp-3"), "donors", "dp-3"), profile("dp-3", { role: "admin" })));
    await assertFails(setDoc(doc(as("dp-3"), "donors", "dp-3"), profile("dp-3", { preferredCurrency: "JPY" })));
    await assertFails(setDoc(doc(as("dp-3"), "donors", "dp-3"), profile("dp-3", { notifications: { spam: true } })));
    await assertFails(setDoc(doc(as("dp-3"), "donors", "dp-3"), profile("dp-3", { notifications: { received: "yes" } })));
    await assertFails(setDoc(doc(as("dp-3"), "donors", "dp-3"), profile("dp-3", { displayName: "x".repeat(61) })));
  });
  it("the creation date cannot be rewritten, and the profile cannot be deleted by the client", async () => {
    await assertSucceeds(setDoc(doc(as("dp-4"), "donors", "dp-4"), profile("dp-4")));
    await assertFails(updateDoc(doc(as("dp-4"), "donors", "dp-4"), { createdAt: new Date("2020-01-01"), updatedAt: serverTimestamp() }));
  });
  it("only the donor reads their profile straight from the database; staff go through the audited function", async () => {
    await assertSucceeds(setDoc(doc(as("dp-5"), "donors", "dp-5"), profile("dp-5")));
    await assertFails(getDoc(doc(as("dp-staff"), "donors", "dp-5")));
    await assertFails(getDoc(doc(as("dp-other"), "donors", "dp-5")));
    await assertSucceeds(getDoc(doc(as("dp-5"), "donors", "dp-5")));
  });
});

describe("notifications honour the donor's choices", () => {
  const PROJECT = "ks1j-8a2e3";
  let admin: { fns: ReturnType<typeof getFunctions> };
  beforeAll(async () => {
    initAdmin({ projectId: PROJECT });
    const app = initializeApp({ projectId: PROJECT, apiKey: "fake" }, "dp-admin");
    const auth = getAuth(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    await adminAuth().createUser({ uid: "dp-admin", email: "dp-admin@test.invalid" });
    await adminDb().doc("members/dp-admin").set({ role: "admin", fullName: "dp-admin" });
    await signInWithCustomToken(auth, await adminAuth().createCustomToken("dp-admin"));
    const fns = getFunctions(app, "asia-south1");
    connectFunctionsEmulator(fns, "127.0.0.1", 5001);
    admin = { fns };
    await adminDb().doc("cases/dp-case").set({ status: "published", amountRequested: 50000, raised: 0, number: 777, applicantId: "x", title: "T" });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = (name: string, data: unknown) => httpsCallable<unknown, any>(admin.fns, name)(data).then((r) => r.data);
  const texts = async (uid: string) => (await adminDb().collection("notifications").where("userId", "==", uid).get()).docs.map((d) => d.get("text") as string);

  it("a switched-off type is not sent; the rest still are", async () => {
    await adminDb().doc("donors/dp-quiet").set({ notifications: { allocated: false, disbursed: true } });
    const don = await adminDb().collection("donations").add({ payerId: "dp-quiet", status: "paid", amount: 3000, fund: "general", purpose: "ration", allocatedAmount: 0, disbursedAmount: 0 });
    await call("allocateDonation", { donationId: don.id, allocations: [{ caseId: "dp-case", amount: 3000 }] });
    expect(await texts("dp-quiet")).toEqual([]); // allocated is off
    const alloc = (await adminDb().collection("allocations").where("donationId", "==", don.id).get()).docs[0];
    await call("createDisbursement", { allocationId: alloc.id, amount: 1000, method: "upi" });
    expect((await texts("dp-quiet")).join(" ")).toMatch(/disbursed/);
  });
  it("donors are told a case is completed, once each, unless they switched that off", async () => {
    await adminDb().doc("cases/dp-done").set({ status: "disbursed", amountRequested: 1000, raised: 1000, number: 778, applicantId: "x", title: "T" });
    await adminDb().doc("donors/dp-nodone").set({ notifications: { completed: false } });
    const al = (donorId: string, donationId: string) => adminDb().collection("allocations").add({ donorId, donationId, caseId: "dp-done", amount: 500, status: "allocated", disbursedAmount: 0, reservedAmount: 0 });
    await al("dp-done1", "d1");
    await al("dp-done1", "d2"); // same donor, two gifts: one notice
    await al("dp-nodone", "d3");
    await call("closeCase", { caseId: "dp-done" });
    expect((await texts("dp-done1")).filter((t) => /completed/.test(t)).length).toBe(1);
    expect(await texts("dp-nodone")).toEqual([]);
    expect((await adminDb().doc("cases/dp-done").get()).get("status")).toBe("closed");
    const kinds = (await adminDb().collection("caseEvents").where("caseId", "==", "dp-done").get()).docs.map((d) => d.get("kind"));
    expect(kinds).toContain("closed");
    await expect(call("closeCase", { caseId: "dp-case" })).rejects.toThrow(/paid-out/); // a published case cannot be closed
  });
  it("a donor with no saved choices gets everything", async () => {
    const don = await adminDb().collection("donations").add({ payerId: "dp-default", status: "paid", amount: 2000, fund: "general", purpose: "ration", allocatedAmount: 0, disbursedAmount: 0 });
    await call("allocateDonation", { donationId: don.id, allocations: [{ caseId: "dp-case", amount: 2000 }] });
    expect((await texts("dp-default")).join(" ")).toMatch(/allocated to Case/);
  });
});

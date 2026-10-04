// The staff view of donors: admins only, private details through audited functions, totals from verified gifts only.
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { beforeAll, describe, expect, it } from "vitest";

describe("staff view of donors (emulator)", () => {
  const PROJECT = "ks1j-8a2e3";
  const mk = async (uid: string, role: string) => {
    const app = initializeApp({ projectId: PROJECT, apiKey: "fake" }, `ds-${uid}`);
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
  let member: Awaited<ReturnType<typeof mk>>;
  const db = () => adminDb();

  beforeAll(async () => {
    initAdmin({ projectId: PROJECT });
    admin = await mk("ds-admin", "admin");
    trustee = await mk("ds-trustee", "trustee");
    member = await mk("ds-member", "member");
    await db().doc("members/ds-donor1").set({ role: "member", fullName: "Member Name One" });
    await db().doc("members/ds-donor2").set({ role: "member", fullName: "No Profile Donor" });
    await db().doc("donors/ds-donor1").set({ donorId: "ds-donor1", fullName: "Asha Profile", displayName: "A. Public", email: "asha@example.com", phone: "+91 98111 22233", country: "UAE", preferredCurrency: "AED", notifications: { disbursed: false }, createdAt: Timestamp.now() });
    const g = (payerId: string, extra: object) => db().collection("donations").add({ payerId, status: "paid", amount: 1000, purpose: "ration", visibility: "private", allocatedAmount: 0, disbursedAmount: 0, createdAt: Timestamp.now(), publicReference: "KS1J-DON-2026-DS", caseId: "secret-case", beneficiaryName: "MUST NOT APPEAR", ...extra });
    await g("ds-donor1", { amount: 5000, allocatedAmount: 5000, disbursedAmount: 2000, visibility: "public", displayCurrency: "USD", displayAmount: 60 });
    await g("ds-donor1", { amount: 2500, visibility: "anonymous" });
    await g("ds-donor1", { status: "pending", amount: 9999 }); // not verified: not in the total
    await g("ds-donor1", { status: "refunded", amount: 700 });
    await g("ds-donor2", { amount: 300 });
  });

  it("only admins can open the donor list or a donor; a trustee and a member are refused", async () => {
    for (const who of [trustee, member]) {
      await expect(who("listDonors", {})).rejects.toThrow(/Admins only/);
      await expect(who("getDonor", { donorId: "ds-donor1" })).rejects.toThrow(/Admins only/);
    }
  });

  it("lists donors with totals from verified gifts only, and no email or phone", async () => {
    const { donors } = await admin("listDonors", {});
    const one = donors.find((d: { id: string }) => d.id === "ds-donor1");
    expect(one).toMatchObject({ name: "Asha Profile", country: "UAE", preferredCurrency: "AED", hasProfile: true, donationCount: 2, totalDonated: 7500 });
    const two = donors.find((d: { id: string }) => d.id === "ds-donor2");
    expect(two).toMatchObject({ name: "No Profile Donor", hasProfile: false, donationCount: 1, totalDonated: 300 }); // known from the member account
    expect(donors.findIndex((d: { id: string }) => d.id === "ds-donor1")).toBeLessThan(donors.findIndex((d: { id: string }) => d.id === "ds-donor2")); // biggest first
    const flat = JSON.stringify(donors);
    expect(flat).not.toMatch(/asha@example|98111|MUST NOT APPEAR|secret-case/);
  });

  it("opens one donor in full: private details, totals and donations, with no beneficiary information", async () => {
    const r = await admin("getDonor", { donorId: "ds-donor1" });
    expect(r.profile).toMatchObject({ fullName: "Asha Profile", displayName: "A. Public", email: "asha@example.com", phone: "+91 98111 22233", notifications: { disbursed: false } });
    expect(r.totals).toEqual({ paidCount: 2, paidTotal: 7500, allocated: 5000, disbursed: 2000 });
    expect(r.donations).toHaveLength(4);
    expect(r.donations.map((d: { visibility: string | null }) => d.visibility).filter(Boolean).sort()).toEqual(["anonymous", "private", "private", "public"]);
    expect(JSON.stringify(r)).not.toMatch(/MUST NOT APPEAR|secret-case|caseId/);
    const noProfile = await admin("getDonor", { donorId: "ds-donor2" });
    expect(noProfile.profile).toBeNull();
    expect(noProfile.member.fullName).toBe("No Profile Donor");
    await expect(admin("getDonor", { donorId: "nobody-here" })).rejects.toThrow(/No such donor/);
    await expect(admin("getDonor", {})).rejects.toThrow(/donor is required/);
  });

  it("records who opened the list and who opened which donor", async () => {
    const logs = (await db().collection("auditLogs").where("actor", "==", "ds-admin").get()).docs.map((d) => d.data());
    expect(logs.some((l) => l.action === "DONOR_LIST_VIEWED")).toBe(true);
    const viewed = logs.filter((l) => l.action === "DONOR_PROFILE_VIEWED").map((l) => l.entityId);
    expect(viewed).toEqual(expect.arrayContaining(["ds-donor1", "ds-donor2"]));
    // refused attempts leave no "viewed" entry for the trustee or the member
    expect((await db().collection("auditLogs").where("action", "==", "DONOR_PROFILE_VIEWED").where("actor", "in", ["ds-trustee", "ds-member"]).get()).size).toBe(0);
  });
});

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, deleteDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "ks1j-8a2e3",
    firestore: { rules: readFileSync("../../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(() => env.cleanup());

const asUser = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const m = (id: string, role: string, extra = {}) => setDoc(doc(db, "members", id), { fullName: id, role, sadaatVerified: false, ...extra });
    await m("alice", "member");
    await m("bob", "member");
    await m("ver1", "verifier");
    await m("tru1", "trustee");
    await m("tru2", "trustee");
    await m("adm", "admin");
    await setDoc(doc(db, "communityProfiles", "alice"), { listed: true });
    await setDoc(doc(db, "communityProfiles", "bob"), { listed: true });
    await setDoc(doc(db, "cases", "c1"), { applicantId: "alice", status: "submitted", beneficiarySadaatVerified: false });
    await setDoc(doc(db, "cases", "cSyed"), { applicantId: "alice", status: "approved", beneficiarySadaatVerified: true });
    await setDoc(doc(db, "cases", "cVer"), { applicantId: "alice", status: "verified", verifiedBy: "ver1" });
    await setDoc(doc(db, "institutions", "iOk"), { name: "ok", ijazahVerified: true });
    await setDoc(doc(db, "institutions", "iNo"), { name: "no", ijazahVerified: false });
  });
});

describe("members", () => {
  it("cannot self-promote or self-verify Sadaat", async () => {
    await assertFails(updateDoc(doc(asUser("alice"), "members", "alice"), { role: "admin" }));
    await assertFails(updateDoc(doc(asUser("alice"), "members", "alice"), { sadaatVerified: true }));
  });
  it("can sign up as plain member only", async () => {
    await assertSucceeds(setDoc(doc(asUser("zed"), "members", "zed"), { fullName: "Z", role: "member", sadaatVerified: false }));
    await assertFails(setDoc(doc(asUser("yan"), "members", "yan"), { fullName: "Y", role: "admin", sadaatVerified: false }));
  });
  it("admin can change roles", async () => {
    await assertSucceeds(updateDoc(doc(asUser("adm"), "members", "bob"), { role: "verifier" }));
  });
});

describe("rule 1: two different admins", () => {
  it("verifier verifies a submitted case", async () => {
    await assertSucceeds(updateDoc(doc(asUser("ver1"), "cases", "c1"), { status: "verified", verifiedBy: "ver1" }));
  });
  it("trustee approves a verified case", async () => {
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "cases", "cVer"), { status: "approved", approvedBy: "tru1" }));
  });
  it("cannot approve a case you verified yourself", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "cases", "cSelf"), { applicantId: "alice", status: "verified", verifiedBy: "tru1" });
    });
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "cSelf"), { status: "approved", approvedBy: "tru1" }));
  });
  it("cannot skip verification", async () => {
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "c1"), { status: "approved", approvedBy: "tru1" }));
  });
  it("applicant cannot set verifiedBy/approvedBy or approve", async () => {
    await assertFails(updateDoc(doc(asUser("alice"), "cases", "c1"), { status: "approved" }));
  });
  it("verifier cannot approve", async () => {
    await assertFails(updateDoc(doc(asUser("ver1"), "cases", "cVer"), { status: "approved", approvedBy: "ver1" }));
  });
});

describe("Sadaat flag is staff-only", () => {
  it("applicant cannot self-declare a Sadaat beneficiary to unlock Sehme Sadaat", async () => {
    await assertFails(setDoc(doc(asUser("alice"), "cases", "x"), { applicantId: "alice", status: "submitted", beneficiarySadaatVerified: true }));
    await assertSucceeds(setDoc(doc(asUser("alice"), "cases", "y"), { applicantId: "alice", status: "draft" }));
    await assertFails(updateDoc(doc(asUser("alice"), "cases", "y"), { beneficiarySadaatVerified: true }));
  });
});

describe("privacy", () => {
  it("other members cannot read a case; applicant and staff can", async () => {
    await assertFails(getDoc(doc(asUser("bob"), "cases", "c1")));
    await assertSucceeds(getDoc(doc(asUser("alice"), "cases", "c1")));
    await assertSucceeds(getDoc(doc(asUser("ver1"), "cases", "c1")));
  });
  it("public case cards are world readable but client cannot write PII into them", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "publicCases", "p1"), { category: "welfare", description: "d", amountNeeded: 1, amountRaised: 0 });
    });
    await assertSucceeds(getDoc(doc(anon(), "publicCases", "p1")));
    await assertFails(setDoc(doc(asUser("alice"), "publicCases", "p2"), { category: "x" }));
    await assertFails(setDoc(doc(asUser("adm"), "publicCases", "p3"), { category: "x", description: "d", amountNeeded: 1, amountRaised: 0, phone: "+91 12345 67890" }));
    await assertSucceeds(setDoc(doc(asUser("adm"), "publicCases", "p4"), { category: "x", description: "d", amountNeeded: 1, amountRaised: 0 }));
  });
});

describe("rule 2: fund separation", () => {
  const pending = (extra: object) => ({ status: "pending", amount: 500, payerId: null, ...extra });
  it("general: any case", async () => {
    await assertSucceeds(addDoc(collection(anon(), "donations"), pending({ fund: "general", caseId: "c1" })));
  });
  it("sehme sadaat: only verified Sadaat beneficiary", async () => {
    await assertSucceeds(addDoc(collection(anon(), "donations"), pending({ fund: "sehme_sadaat", caseId: "cSyed" })));
    await assertFails(addDoc(collection(anon(), "donations"), pending({ fund: "sehme_sadaat", caseId: "c1" })));
  });
  it("sehme imam: only ijazah-verified institutions, never cases", async () => {
    await assertSucceeds(addDoc(collection(anon(), "donations"), pending({ fund: "sehme_imam", institutionId: "iOk" })));
    await assertFails(addDoc(collection(anon(), "donations"), pending({ fund: "sehme_imam", institutionId: "iNo" })));
    await assertFails(addDoc(collection(anon(), "donations"), pending({ fund: "sehme_imam", caseId: "c1" })));
  });
});

describe("rule 3 & 4: money and ledgers", () => {
  it("client cannot create a paid donation or flip to paid", async () => {
    await assertFails(addDoc(collection(anon(), "donations"), { fund: "general", caseId: "c1", amount: 5, status: "paid", payerId: null }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "donations", "d1"), { fund: "general", caseId: "c1", amount: 5, status: "pending", payerId: "alice" });
    });
    await assertFails(updateDoc(doc(asUser("alice"), "donations", "d1"), { status: "paid" }));
    await assertFails(updateDoc(doc(asUser("adm"), "donations", "d1"), { status: "paid" }));
  });
  it("ledger is append-only and not client-writable", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "ledger", "l1"), { amount: 5 });
    });
    await assertFails(setDoc(doc(asUser("adm"), "ledger", "l2"), { amount: 1 }));
    await assertFails(updateDoc(doc(asUser("adm"), "ledger", "l1"), { amount: 2 }));
    await assertFails(deleteDoc(doc(asUser("adm"), "ledger", "l1")));
    await assertSucceeds(getDoc(doc(asUser("adm"), "ledger", "l1")));
    await assertFails(getDoc(doc(asUser("alice"), "ledger", "l1")));
  });
});

describe("rule 8: loans", () => {
  it("no interest or late fee fields can be stored", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice"), "loans", "L1"), { borrowerId: "alice", principal: 100000, status: "applied" }));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "L2"), { borrowerId: "alice", principal: 100000, status: "applied", interest: 5 }));
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "L1"), { lateFee: 100 }));
  });
  it("cannot disburse before both sides agree", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "loans", "LA"), { borrowerId: "alice", principal: 1, status: "emi_pending_agreement", familyAccepted: false, trusteeAccepted: true });
      await setDoc(doc(db, "loans", "LB"), { borrowerId: "alice", principal: 1, status: "agreed", familyAccepted: true, trusteeAccepted: true });
    });
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "LA"), { status: "disbursed" }));
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "loans", "LB"), { status: "disbursed" }));
  });
  it("family can accept the EMI", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "loans", "LA"), { borrowerId: "alice", principal: 1, status: "emi_pending_agreement", familyAccepted: false });
    });
    await assertSucceeds(updateDoc(doc(asUser("alice"), "loans", "LA"), { familyAccepted: true }));
    await assertFails(updateDoc(doc(asUser("bob"), "loans", "LA"), { familyAccepted: true }));
  });
});

describe("community", () => {
  it("members without a profile are gated out", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "communityPosts", "p"), { authorId: "alice", body: "hi" });
    });
    await assertSucceeds(getDoc(doc(asUser("alice"), "communityPosts", "p")));
    await assertFails(getDoc(doc(asUser("noprofile"), "communityPosts", "p")));
  });
  it("only staff can moderate posts", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "communityPosts", "p"), { authorId: "alice", body: "hi" });
    });
    await assertFails(updateDoc(doc(asUser("bob"), "communityPosts", "p"), { removed: true }));
    await assertSucceeds(updateDoc(doc(asUser("adm"), "communityPosts", "p"), { removed: true }));
  });
  it("messaging is consent-gated", async () => {
    const req = { fromId: "alice", toId: "bob", kind: "message", status: "pending", note: "hello" };
    await assertSucceeds(setDoc(doc(asUser("alice"), "communityConnections", "k1"), req));
    await assertFails(setDoc(doc(asUser("alice"), "communityConnections", "k2"), { ...req, note: "" }));
    // no message before acceptance
    await assertFails(addDoc(collection(asUser("alice"), "communityConnections", "k1", "messages"), { senderId: "alice", text: "x" }));
    // requester cannot accept their own request
    await assertFails(updateDoc(doc(asUser("alice"), "communityConnections", "k1"), { status: "accepted" }));
    await assertSucceeds(updateDoc(doc(asUser("bob"), "communityConnections", "k1"), { status: "accepted" }));
    await assertSucceeds(addDoc(collection(asUser("alice"), "communityConnections", "k1", "messages"), { senderId: "alice", text: "x" }));
    // outsiders see nothing
    await assertFails(getDoc(doc(asUser("noprofile"), "communityConnections", "k1")));
    await assertFails(addDoc(collection(asUser("noprofile"), "communityConnections", "k1", "messages"), { senderId: "noprofile", text: "y" }));
  });
  it("private group requires pending status; roster hidden from outsiders; owner cannot leave", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "communityGroups", "g"), { ownerId: "alice", private: true });
      await setDoc(doc(db, "communityGroups", "g", "members", "alice"), { role: "owner", status: "member" });
    });
    await assertFails(setDoc(doc(asUser("bob"), "communityGroups", "g", "members", "bob"), { role: "member", status: "member" }));
    await assertSucceeds(setDoc(doc(asUser("bob"), "communityGroups", "g", "members", "bob"), { role: "member", status: "pending" }));
    await assertSucceeds(updateDoc(doc(asUser("alice"), "communityGroups", "g", "members", "bob"), { status: "member" }));
    await assertFails(deleteDoc(doc(asUser("alice"), "communityGroups", "g", "members", "alice")));
    await assertFails(getDoc(doc(asUser("noprofile"), "communityGroups", "g", "members", "alice")));
  });
  it("group creator can seed their own owner row, others cannot claim owner", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "communityGroups", "g2"), { ownerId: "alice", private: false });
    });
    await assertSucceeds(setDoc(doc(asUser("alice"), "communityGroups", "g2", "members", "alice"), { role: "owner", status: "member" }));
    await assertFails(setDoc(doc(asUser("bob"), "communityGroups", "g2", "members", "bob"), { role: "owner", status: "member" }));
  });
  it("reports: members file them, only staff read them", async () => {
    await assertSucceeds(addDoc(collection(asUser("alice"), "communityReports"), { reporterId: "alice", status: "open", targetType: "post", targetId: "p" }));
    await assertFails(addDoc(collection(asUser("alice"), "communityReports"), { reporterId: "bob", status: "open" }));
  });
});

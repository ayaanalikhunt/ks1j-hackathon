import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, updateDoc, addDoc, collection, deleteDoc } from "firebase/firestore";
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
    await m("own", "owner");
    await m("sup", "super_admin");
    await m("vol", "volunteer");
    await setDoc(doc(db, "communityProfiles", "alice"), { listed: true });
    await setDoc(doc(db, "communityProfiles", "bob"), { listed: true });
    await setDoc(doc(db, "cases", "c1"), { applicantId: "alice", status: "submitted", beneficiarySadaatVerified: false });
    await setDoc(doc(db, "cases", "cSyed"), { applicantId: "alice", status: "approved", beneficiarySadaatVerified: true });
    await setDoc(doc(db, "cases", "cPub"), { applicantId: "alice", status: "published", beneficiarySadaatVerified: false });
    await setDoc(doc(db, "cases", "cPubSyed"), { applicantId: "alice", status: "published", beneficiarySadaatVerified: true });
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
  it("admins verify Sadaat status but cannot change roles", async () => {
    await assertSucceeds(updateDoc(doc(asUser("adm"), "members", "bob"), { sadaatVerified: true }));
    await assertFails(updateDoc(doc(asUser("adm"), "members", "bob"), { role: "verifier" }));
  });
  it("super_admin assigns roles below super_admin only", async () => {
    await assertSucceeds(updateDoc(doc(asUser("sup"), "members", "bob"), { role: "admin" }));
    await assertFails(updateDoc(doc(asUser("sup"), "members", "bob"), { role: "super_admin" }));
    await assertFails(updateDoc(doc(asUser("sup"), "members", "own"), { role: "member" }));
    await assertFails(updateDoc(doc(asUser("sup"), "members", "adm"), { role: "owner" }));
  });
  it("only the owner can create super_admins or touch the owner", async () => {
    await assertSucceeds(updateDoc(doc(asUser("own"), "members", "bob"), { role: "super_admin" }));
    await assertSucceeds(updateDoc(doc(asUser("own"), "members", "sup"), { role: "admin" }));
  });
  it("volunteers are not staff: no case, member or ledger access", async () => {
    await assertFails(getDoc(doc(asUser("vol"), "cases", "c1")));
    await assertFails(getDoc(doc(asUser("vol"), "members", "alice")));
    await assertFails(updateDoc(doc(asUser("vol"), "members", "alice"), { role: "admin" }));
    await assertFails(updateDoc(doc(asUser("vol"), "cases", "c1"), { status: "verified", verifiedBy: "vol" }));
  });
  it("volunteers can post announcements and moderate community content", async () => {
    await assertSucceeds(addDoc(collection(asUser("vol"), "announcements"), { title: "Hi", body: "x" }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "communityPosts", "pp"), { authorId: "alice", body: "hi" });
    });
    await assertSucceeds(updateDoc(doc(asUser("vol"), "communityPosts", "pp"), { removed: true }));
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

describe("case workflow", () => {
  const decline = (by: string, reason = "insufficient_proof", note = "No supporting documents") => ({ status: "declined", declinedBy: by, declineReason: reason, declineNote: note });
  it("admin and super admin can verify, but never approve their own verification", async () => {
    await assertSucceeds(updateDoc(doc(asUser("adm"), "cases", "c1"), { status: "verified", verifiedBy: "adm" }));
    await assertFails(updateDoc(doc(asUser("adm"), "cases", "c1"), { status: "approved", approvedBy: "adm" }));
    await assertSucceeds(updateDoc(doc(asUser("sup"), "cases", "c1"), { status: "approved", approvedBy: "sup" }));
  });
  it("any staff can cancel a case with a valid reason and note", async () => {
    await assertSucceeds(updateDoc(doc(asUser("adm"), "cases", "c1"), decline("adm")));
    await assertSucceeds(updateDoc(doc(asUser("ver1"), "cases", "cVer"), decline("ver1", "missing_sources")));
  });
  it("a cancel needs a reason from the list and a real note", async () => {
    await assertFails(updateDoc(doc(asUser("adm"), "cases", "c1"), decline("adm", "because")));
    await assertFails(updateDoc(doc(asUser("adm"), "cases", "c1"), decline("adm", "other", "no")));
    await assertFails(updateDoc(doc(asUser("adm"), "cases", "c1"), { status: "declined", declinedBy: "adm" }));
  });
  it("cancel cannot be used to change other fields, impersonate, or reopen a paid case", async () => {
    await assertFails(updateDoc(doc(asUser("adm"), "cases", "c1"), { ...decline("adm"), amountRequested: 1 }));
    await assertFails(updateDoc(doc(asUser("adm"), "cases", "c1"), decline("ver1")));
    await assertFails(updateDoc(doc(asUser("alice"), "cases", "c1"), decline("alice")));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "cases", "cPaid"), { applicantId: "alice", status: "disbursed" });
    });
    await assertFails(updateDoc(doc(asUser("adm"), "cases", "cPaid"), decline("adm")));
  });
  it("payout cannot be written by any client, only by the payout function", async () => {
    await assertFails(updateDoc(doc(asUser("adm"), "cases", "cSyed"), { status: "disbursed", disbursedBy: "adm" }));
    await assertFails(updateDoc(doc(asUser("own"), "cases", "cSyed"), { status: "funded" }));
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "cSyed"), { status: "disbursed", disbursedBy: "tru1" }));
  });
  it("publish is for a trustee or admin, on an approved case, by themselves", async () => {
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "cases", "cSyed"), { status: "published", publishedBy: "tru1", publishedAt: new Date() }));
    await assertFails(updateDoc(doc(asUser("ver1"), "cases", "cSyed"), { status: "published", publishedBy: "ver1" }));
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "cVer"), { status: "published", publishedBy: "tru1" }));
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "cSyed"), { status: "published", publishedBy: "tru2" }));
  });
  it("closing is admin level and only after payout", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "cases", "cPaid"), { applicantId: "alice", status: "disbursed" });
    });
    await assertSucceeds(updateDoc(doc(asUser("adm"), "cases", "cPaid"), { status: "closed", closedBy: "adm" }));
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "cPaid"), { status: "closed", closedBy: "tru1" }));
    await assertFails(updateDoc(doc(asUser("adm"), "cases", "cSyed"), { status: "closed", closedBy: "adm" }));
  });
  it("staff can set Sadaat status, applicants cannot", async () => {
    await assertSucceeds(updateDoc(doc(asUser("ver1"), "cases", "c1"), { beneficiarySadaatVerified: true }));
    await assertFails(updateDoc(doc(asUser("alice"), "cases", "c1"), { beneficiarySadaatVerified: true }));
  });
});

describe("applicant intake and proof documents", () => {
  const img = (n = 100) => "data:image/jpeg;base64," + "A".repeat(n);
  const draft = { applicantId: "alice", status: "draft", description: "Need help" };
  it("applicant can create a draft, attach proof, then submit it", async () => {
    const a = asUser("alice");
    await assertSucceeds(setDoc(doc(a, "cases", "n1"), draft));
    await assertSucceeds(addDoc(collection(a, "cases", "n1", "documents"), { kind: "aadhaar", name: "aadhaar.jpg", dataUrl: img() }));
    await assertSucceeds(addDoc(collection(a, "cases", "n1", "documents"), { kind: "address_proof", name: "bill.jpg", dataUrl: img() }));
    await assertSucceeds(updateDoc(doc(a, "cases", "n1"), { status: "submitted", familyHistory: "Four members" }));
  });
  it("applicant cannot sneak staff fields in while submitting", async () => {
    const a = asUser("alice");
    await assertSucceeds(setDoc(doc(a, "cases", "n2"), draft));
    await assertFails(updateDoc(doc(a, "cases", "n2"), { status: "submitted", verifiedBy: "ver1" }));
    await assertFails(updateDoc(doc(a, "cases", "n2"), { status: "verified" }));
    await assertFails(updateDoc(doc(a, "cases", "n2"), { status: "submitted", applicantId: "bob" }));
  });
  it("documents must be small images with a known kind", async () => {
    const a = asUser("alice");
    await assertSucceeds(setDoc(doc(a, "cases", "n3"), draft));
    await assertFails(addDoc(collection(a, "cases", "n3", "documents"), { kind: "aadhaar", name: "x", dataUrl: img(950000) }));
    await assertFails(addDoc(collection(a, "cases", "n3", "documents"), { kind: "passport", name: "x", dataUrl: img() }));
    await assertFails(addDoc(collection(a, "cases", "n3", "documents"), { kind: "aadhaar", name: "x", dataUrl: "javascript:alert(1)" }));
    await assertFails(addDoc(collection(a, "cases", "n3", "documents"), { kind: "aadhaar", name: "x", dataUrl: img(), extra: 1 }));
  });
  it("only the applicant adds proof, and only while the case is open", async () => {
    await assertFails(addDoc(collection(asUser("bob"), "cases", "c1", "documents"), { kind: "aadhaar", name: "x", dataUrl: img() }));
    // Once a case is published or paid out, the applicant can no longer change its file.
    await assertFails(addDoc(collection(asUser("alice"), "cases", "cPub", "documents"), { kind: "aadhaar", name: "x", dataUrl: img() }));
    // Staff add documents through their own rule, which must name them (see the office-documents test).
    await assertFails(addDoc(collection(asUser("ver1"), "cases", "c1", "documents"), { kind: "aadhaar", name: "x", dataUrl: img() }));
  });
  it("proof is readable by staff and the applicant only, and never changeable", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "cases", "c1", "documents", "d1"), { kind: "aadhaar", name: "x", dataUrl: img() });
    });
    await assertSucceeds(getDoc(doc(asUser("ver1"), "cases", "c1", "documents", "d1")));
    await assertSucceeds(getDoc(doc(asUser("alice"), "cases", "c1", "documents", "d1")));
    await assertFails(getDoc(doc(asUser("bob"), "cases", "c1", "documents", "d1")));
    await assertFails(getDoc(doc(asUser("vol"), "cases", "c1", "documents", "d1")));
    await assertFails(updateDoc(doc(asUser("alice"), "cases", "c1", "documents", "d1"), { kind: "other" }));
    await assertFails(deleteDoc(doc(asUser("adm"), "cases", "c1", "documents", "d1")));
  });
});

describe("case history, numbering and staff documents", () => {
  const ev = (by: string, kind: string, extra = {}) => ({ caseId: "c1", applicantId: "alice", caseNumber: 1, caseTitle: "Fees", kind, actorId: by, at: new Date(), ...extra });
  it("staff log events as themselves; applicants only log their own submission or documents", async () => {
    await assertSucceeds(addDoc(collection(asUser("ver1"), "caseEvents"), ev("ver1", "verified")));
    await assertSucceeds(addDoc(collection(asUser("alice"), "caseEvents"), ev("alice", "submitted")));
    await assertFails(addDoc(collection(asUser("alice"), "caseEvents"), ev("alice", "approved")));
    await assertFails(addDoc(collection(asUser("ver1"), "caseEvents"), ev("tru1", "verified")));
    await assertFails(addDoc(collection(asUser("vol"), "caseEvents"), ev("vol", "approved")));
    await assertFails(addDoc(collection(asUser("ver1"), "caseEvents"), ev("ver1", "verified", { secret: 1 })));
  });
  it("events are readable by the applicant and staff, and never edited", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "caseEvents", "e1"), ev("ver1", "verified"));
    });
    await assertSucceeds(getDoc(doc(asUser("alice"), "caseEvents", "e1")));
    await assertSucceeds(getDoc(doc(asUser("adm"), "caseEvents", "e1")));
    await assertFails(getDoc(doc(asUser("bob"), "caseEvents", "e1")));
    await assertFails(getDoc(doc(asUser("vol"), "caseEvents", "e1")));
    await assertFails(updateDoc(doc(asUser("adm"), "caseEvents", "e1"), { note: "x" }));
    await assertFails(deleteDoc(doc(asUser("adm"), "caseEvents", "e1")));
  });
  it("case counter only goes up by one", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice"), "counters", "cases"), { n: 1 }));
    await assertSucceeds(updateDoc(doc(asUser("bob"), "counters", "cases"), { n: 2 }));
    await assertFails(updateDoc(doc(asUser("alice"), "counters", "cases"), { n: 10 }));
    await assertFails(updateDoc(doc(asUser("alice"), "counters", "cases"), { n: 1 }));
  });
  it("staff add office documents with their own name; others cannot", async () => {
    const pic = { kind: "income_proof", name: "slip.jpg", dataUrl: "data:image/jpeg;base64,AAAA", addedBy: "ver1" };
    await assertSucceeds(addDoc(collection(asUser("ver1"), "cases", "c1", "documents"), pic));
    await assertFails(addDoc(collection(asUser("ver1"), "cases", "c1", "documents"), { ...pic, addedBy: "tru1" }));
    await assertFails(addDoc(collection(asUser("vol"), "cases", "c1", "documents"), { ...pic, addedBy: "vol" }));
    await assertFails(addDoc(collection(asUser("ver1"), "cases", "cPub", "documents"), pic));
  });
  it("trustees can publish a PII-free card", async () => {
    const card = { caseId: "c1", category: "welfare", type: "medical", number: 1, title: "Fees", sadaat: false, description: "d", amountNeeded: 10, amountRaised: 0 };
    await assertSucceeds(setDoc(doc(asUser("tru1"), "publicCases", "pub-c1"), card));
    await assertFails(setDoc(doc(asUser("ver1"), "publicCases", "pub-c2"), card));
    await assertFails(setDoc(doc(asUser("tru1"), "publicCases", "pub-c3"), { ...card, phone: "+91 12345 67890" }));
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
    await assertSucceeds(addDoc(collection(anon(), "donations"), pending({ fund: "general", caseId: "cPub" })));
  });
  it("sehme sadaat: only verified Sadaat beneficiary", async () => {
    await assertSucceeds(addDoc(collection(anon(), "donations"), pending({ fund: "sehme_sadaat", caseId: "cPubSyed" })));
    await assertFails(addDoc(collection(anon(), "donations"), pending({ fund: "sehme_sadaat", caseId: "cPub" })));
  });
  it("donors can only give to a published case", async () => {
    await assertFails(addDoc(collection(anon(), "donations"), pending({ fund: "general", caseId: "c1" })));
    await assertFails(addDoc(collection(anon(), "donations"), pending({ fund: "general", caseId: "cSyed" })));
    await assertFails(addDoc(collection(anon(), "donations"), pending({ fund: "general", caseId: "cVer" })));
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

describe("education loans: application and background check", () => {
  const ref = { name: "Ref One", phone: "+91 12345 67890", relation: "Teacher" };
  const loan = (extra = {}) => ({
    borrowerId: "alice",
    borrowerName: "Alice",
    studentName: "Zain",
    course: "B.Com",
    institution: "City College",
    courseEnd: "2027-10-01",
    principal: 60000,
    purpose: "Fees",
    orphan: false,
    status: "applied",
    ...extra,
  });
  const orphan = (extra = {}) =>
    loan({ orphan: true, parentStatus: "both_deceased", guardianName: "Uncle", guardianRelation: "Uncle", refs: [ref, { ...ref, name: "Ref Two" }], ...extra });
  const check = (by: string, extra = {}) => ({ by, at: new Date(), ...extra });
  const visit = (by: string, recommend = true) => check(by, { recommend, report: "Visited the home. The family lives as described.", date: "2026-10-03" });

  it("an application cannot carry an interest rate, a fee or any unlisted field", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice"), "loans", "L1"), loan()));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "L2"), loan({ interest: 5 })));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "L3"), loan({ lateFee: 100 })));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "L4"), loan({ status: "agreed" })));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "L5"), loan({ borrowerId: "bob" })));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "L6"), loan({ principal: -5 })));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "L7"), loan({ courseEnd: "next year" })));
  });
  it("an orphan application needs the guardian details and two references", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice"), "loans", "O1"), orphan()));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "O2"), orphan({ refs: [ref] })));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "O3"), orphan({ guardianName: "" })));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "O4"), loan({ orphan: true })));
  });
  it("a plan cannot be proposed until every basic check exists", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice"), "loans", "L1"), loan()));
    const plan = { status: "emi_pending_agreement", trusteeEmi: 1250, reviewedBy: "tru1", reviewedAt: new Date() };
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "L1"), plan));
    for (const k of ["identity", "address", "income"]) await assertSucceeds(setDoc(doc(asUser("ver1"), "loans", "L1", "checks", k), check("ver1")));
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "L1"), plan)); // institution_fee still missing
    await assertSucceeds(setDoc(doc(asUser("ver1"), "loans", "L1", "checks", "institution_fee"), check("ver1")));
    await assertFails(updateDoc(doc(asUser("alice"), "loans", "L1"), plan)); // the family cannot approve itself
    await assertFails(updateDoc(doc(asUser("ver1"), "loans", "L1"), { ...plan, reviewedBy: "ver1" })); // a verifier cannot propose a plan
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "L1"), { ...plan, trusteeEmi: 1000 })); // 1000 x 48 < 60000
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "loans", "L1"), plan));
  });
  it("an orphan loan also needs a home visit by someone other than the approver, and it must recommend the loan", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice"), "loans", "O1"), orphan()));
    for (const k of ["identity", "address", "income", "institution_fee", "orphan_status", "guardian", "references", "no_other_loans"]) {
      await assertSucceeds(setDoc(doc(asUser("ver1"), "loans", "O1", "checks", k), check("ver1")));
    }
    const plan = { status: "emi_pending_agreement", trusteeEmi: 1250, reviewedBy: "tru1", reviewedAt: new Date() };
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "O1"), plan)); // no home visit yet
    await assertFails(setDoc(doc(asUser("ver1"), "loans", "O1", "checks", "home_visit"), check("ver1", { recommend: true, report: "short" }))); // report too short
    await assertSucceeds(setDoc(doc(asUser("tru1"), "loans", "O1", "checks", "home_visit"), visit("tru1")));
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "O1"), plan)); // the approver cannot be the one who did the visit
    await assertSucceeds(updateDoc(doc(asUser("tru2"), "loans", "O1"), { ...plan, reviewedBy: "tru2" }));
  });
  it("a visit that does not recommend the loan blocks the plan", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice"), "loans", "O2"), orphan()));
    for (const k of ["identity", "address", "income", "institution_fee", "orphan_status", "guardian", "references", "no_other_loans"]) {
      await assertSucceeds(setDoc(doc(asUser("ver1"), "loans", "O2", "checks", k), check("ver1")));
    }
    await assertSucceeds(setDoc(doc(asUser("ver1"), "loans", "O2", "checks", "home_visit"), visit("ver1", false)));
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "O2"), { status: "emi_pending_agreement", trusteeEmi: 1250, reviewedBy: "tru1" }));
  });
  it("checks are signed, written once, staff-only, and never edited", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice"), "loans", "L1"), loan()));
    await assertFails(setDoc(doc(asUser("alice"), "loans", "L1", "checks", "identity"), check("alice"))); // the family cannot tick its own boxes
    await assertFails(setDoc(doc(asUser("vol"), "loans", "L1", "checks", "identity"), check("vol")));
    await assertFails(setDoc(doc(asUser("ver1"), "loans", "L1", "checks", "identity"), check("tru1"))); // signed by someone else
    await assertFails(setDoc(doc(asUser("ver1"), "loans", "L1", "checks", "made_up"), check("ver1")));
    await assertSucceeds(setDoc(doc(asUser("ver1"), "loans", "L1", "checks", "identity"), check("ver1")));
    await assertFails(setDoc(doc(asUser("tru1"), "loans", "L1", "checks", "identity"), check("tru1"))); // cannot overwrite
    await assertFails(deleteDoc(doc(asUser("adm"), "loans", "L1", "checks", "identity")));
    await assertFails(getDoc(doc(asUser("alice"), "loans", "L1", "checks", "identity")));
  });
  it("loan documents: the family and staff add them while it is being checked; nobody else can see them", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice"), "loans", "L1"), loan()));
    const d = { kind: "admission_letter", name: "letter.jpg", dataUrl: "data:image/jpeg;base64,AAAA" };
    await assertSucceeds(addDoc(collection(asUser("alice"), "loans", "L1", "documents"), d));
    await assertSucceeds(addDoc(collection(asUser("ver1"), "loans", "L1", "documents"), { ...d, kind: "income_proof", addedBy: "ver1" }));
    await assertFails(addDoc(collection(asUser("bob"), "loans", "L1", "documents"), d));
    await assertFails(addDoc(collection(asUser("alice"), "loans", "L1", "documents"), { ...d, kind: "passport" }));
    await assertFails(addDoc(collection(asUser("ver1"), "loans", "L1", "documents"), { ...d, addedBy: "tru1" }));
    await assertFails(getDocs(collection(asUser("bob"), "loans", "L1", "documents")));
    await assertSucceeds(getDocs(collection(asUser("ver1"), "loans", "L1", "documents")));
  });
});

describe("education loans: agreeing the monthly amount", () => {
  const agreed = async (extra = {}) => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "loans", "P1"), {
        borrowerId: "alice", principal: 60000, courseEnd: "2027-10-01", orphan: false, status: "emi_pending_agreement", trusteeEmi: 2000, ...extra,
      });
    });
  };
  it("the family proposes an amount that repays within 48 months; only the borrower can", async () => {
    await agreed();
    await assertFails(updateDoc(doc(asUser("alice"), "loans", "P1"), { familyEmi: 1000 })); // would take more than 48 months
    await assertFails(updateDoc(doc(asUser("bob"), "loans", "P1"), { familyEmi: 2000 }));
    await assertFails(updateDoc(doc(asUser("alice"), "loans", "P1"), { familyEmi: 2000, status: "agreed" })); // cannot agree itself
    await assertSucceeds(updateDoc(doc(asUser("alice"), "loans", "P1"), { familyEmi: 2000 }));
  });
  it("the plan is agreed only when the family and the trustee name the same amount", async () => {
    await agreed({ familyEmi: 1500, trusteeEmi: 2000 });
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "P1"), { status: "agreed", emi: 1500, agreedAt: new Date() })); // 1500 vs 2000
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "loans", "P1"), { trusteeEmi: 1500 }));
    await assertFails(updateDoc(doc(asUser("alice"), "loans", "P1"), { status: "agreed", emi: 1500 }));
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "P1"), { status: "agreed", emi: 1800, agreedAt: new Date() })); // emi must be the agreed amount
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "loans", "P1"), { status: "agreed", emi: 1500, agreedAt: new Date() }));
  });
  it("nobody can mark a loan paid out or change its balance from a client", async () => {
    await agreed({ familyEmi: 2000, emi: 2000, status: "agreed" });
    await assertFails(updateDoc(doc(asUser("adm"), "loans", "P1"), { status: "disbursed" }));
    await assertFails(updateDoc(doc(asUser("own"), "loans", "P1"), { repaid: 60000 }));
    await assertFails(updateDoc(doc(asUser("alice"), "loans", "P1"), { repaid: 60000, status: "closed" }));
  });
  it("a plan can be declined with a reason, but not by the family or a volunteer", async () => {
    await agreed();
    const no = { status: "declined", declinedBy: "tru1", declineNote: "Cannot confirm the fees" };
    await assertFails(updateDoc(doc(asUser("alice"), "loans", "P1"), { ...no, declinedBy: "alice" }));
    await assertFails(updateDoc(doc(asUser("tru1"), "loans", "P1"), { ...no, declineNote: "no" }));
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "loans", "P1"), no));
  });
});

describe("education loans: repayment and hardship", () => {
  const live = async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "loans", "R1"), { borrowerId: "alice", principal: 60000, emi: 2000, status: "disbursed", nextDue: "2028-04-01", repaid: 0 });
      await setDoc(doc(ctx.firestore(), "loans", "R0"), { borrowerId: "alice", principal: 60000, emi: 2000, status: "agreed" });
    });
  };
  it("a repayment is created pending by the borrower, on a paid-out loan only", async () => {
    await live();
    const pay = { loanId: "R1", borrowerId: "alice", amount: 2000, status: "pending" };
    await assertSucceeds(addDoc(collection(asUser("alice"), "repayments"), pay));
    await assertFails(addDoc(collection(asUser("alice"), "repayments"), { ...pay, status: "paid" }));
    await assertFails(addDoc(collection(asUser("alice"), "repayments"), { ...pay, loanId: "R0" })); // not paid out yet
    await assertFails(addDoc(collection(asUser("bob"), "repayments"), { ...pay, borrowerId: "bob" })); // someone else's loan
    await assertFails(addDoc(collection(asUser("alice"), "repayments"), { ...pay, lateFee: 50 }));
  });
  it("a hardship request needs a real reason and sensible terms, and a trustee decides it through a function, not a client write", async () => {
    await live();
    const ask = { loanId: "R1", borrowerId: "alice", type: "pause", months: 2, reason: "My job ended in September.", status: "pending" };
    await assertSucceeds(addDoc(collection(asUser("alice"), "hardships"), ask));
    await assertFails(addDoc(collection(asUser("alice"), "hardships"), { ...ask, months: 12 }));
    await assertFails(addDoc(collection(asUser("alice"), "hardships"), { ...ask, reason: "short" }));
    await assertFails(addDoc(collection(asUser("alice"), "hardships"), { ...ask, status: "approved" }));
    await assertFails(addDoc(collection(asUser("bob"), "hardships"), { ...ask, borrowerId: "bob" }));
    await assertSucceeds(addDoc(collection(asUser("alice"), "hardships"), { loanId: "R1", borrowerId: "alice", type: "lower", newEmi: 1000, reason: "Income dropped for a few months.", status: "pending" }));
    const h = await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "hardships", "h1"), ask);
    });
    void h;
    await assertFails(updateDoc(doc(asUser("tru1"), "hardships", "h1"), { status: "approved", decidedBy: "tru1" }));
    await assertFails(updateDoc(doc(asUser("alice"), "hardships", "h1"), { status: "approved" }));
    await assertSucceeds(getDoc(doc(asUser("alice"), "hardships", "h1")));
    await assertSucceeds(getDoc(doc(asUser("tru1"), "hardships", "h1")));
    await assertFails(getDoc(doc(asUser("bob"), "hardships", "h1")));
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

describe("phase 3 safeguards", () => {
  it("members cannot verify their own membership or link themselves to a household; admins can", async () => {
    await assertFails(updateDoc(doc(asUser("alice"), "members", "alice"), { membershipVerified: true }));
    await assertFails(updateDoc(doc(asUser("alice"), "members", "alice"), { householdId: "h1" }));
    await assertFails(setDoc(doc(asUser("zed"), "members", "zed"), { fullName: "Z", role: "member", sadaatVerified: false, membershipVerified: true }));
    await assertSucceeds(updateDoc(doc(asUser("adm"), "members", "alice"), { membershipVerified: true }));
  });
  it("fraud-flag decisions are staff-only, signed, and cannot be deleted", async () => {
    const flag = { caseId: "c1", otherId: "cVer", kind: "same_applicant", status: "clear", by: "ver1", at: new Date() };
    await assertSucceeds(setDoc(doc(asUser("ver1"), "fraudFlags", "c1__cVer__same_applicant"), flag));
    await assertFails(setDoc(doc(asUser("ver1"), "fraudFlags", "x"), { ...flag, by: "tru1" }));
    await assertFails(setDoc(doc(asUser("ver1"), "fraudFlags", "y"), { ...flag, status: "open" }));
    await assertFails(setDoc(doc(asUser("alice"), "fraudFlags", "z"), { ...flag, by: "alice" }));
    await assertFails(setDoc(doc(asUser("vol"), "fraudFlags", "w"), { ...flag, by: "vol" }));
    await assertFails(getDoc(doc(asUser("alice"), "fraudFlags", "c1__cVer__same_applicant")));
    await assertSucceeds(getDoc(doc(asUser("tru1"), "fraudFlags", "c1__cVer__same_applicant")));
    await assertFails(deleteDoc(doc(asUser("adm"), "fraudFlags", "c1__cVer__same_applicant")));
  });
  it("unverified institutions are hidden from the public and members, and cannot be self-verified", async () => {
    await assertFails(getDoc(doc(anon(), "institutions", "iNo")));
    await assertFails(getDoc(doc(asUser("alice"), "institutions", "iNo")));
    await assertSucceeds(getDoc(doc(anon(), "institutions", "iOk")));
    await assertSucceeds(getDoc(doc(asUser("tru1"), "institutions", "iNo")));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "institutions", "iNew"), { name: "New", ijazahVerified: false, addedBy: "tru1" });
    });
    await assertFails(updateDoc(doc(asUser("tru1"), "institutions", "iNew"), { ijazahVerified: true, verifiedBy: "tru1" }));
    await assertSucceeds(updateDoc(doc(asUser("tru2"), "institutions", "iNew"), { ijazahVerified: true, verifiedBy: "tru2" }));
    await assertFails(updateDoc(doc(asUser("adm"), "institutions", "iNo"), { ijazahVerified: true })); // admins cannot flip it quietly either
    await assertSucceeds(updateDoc(doc(asUser("adm"), "institutions", "iOk"), { receiving: false })); // pausing is a normal edit
  });
});

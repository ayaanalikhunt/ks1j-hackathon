// Case upgrades: public ids, the ID-proof "None" flow, alternative verification, emergency exception, priority, restricted-fund eligibility.
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import * as shared from "../../shared/src/cases";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "ks1j-8a2e3",
    firestore: { rules: readFileSync("../../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(() => env.cleanup());
const asUser = (uid: string) => env.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const m = (id: string, role: string) => setDoc(doc(db, "members", id), { fullName: id, role, sadaatVerified: false });
    await m("alice", "member");
    await m("ver1", "verifier");
    await m("tru1", "trustee");
    await m("tru2", "trustee");
    await m("adm", "admin");
    await m("vol", "volunteer");
    // a case with no ID, just verified by ver1, waiting for approval
    await setDoc(doc(db, "cases", "noId"), { applicantId: "alice", status: "verified", verifiedBy: "ver1", idProofType: "none", noIdReason: "document_lost", verificationStatus: "pending_review" });
    await setDoc(doc(db, "cases", "withId"), { applicantId: "alice", status: "verified", verifiedBy: "ver1", idProofType: "aadhaar" });
    await setDoc(doc(db, "cases", "submittedNoId"), { applicantId: "alice", status: "submitted", idProofType: "none", noIdReason: "minor" });
    await setDoc(doc(db, "cases", "pub"), { applicantId: "alice", status: "published" });
  });
});

const base = { applicantId: "alice", status: "submitted", title: "T", number: 5 };

describe("shared helpers", () => {
  it("builds the public id and falls back for older cases", () => {
    const d = new Date("2026-10-04T00:00:00Z");
    if (shared.publicCaseId(184, d) !== "CASE-2026-000184") throw new Error("bad id");
    if (shared.casePublicId({ number: 7 }) === "") throw new Error("no fallback");
    if (shared.casePublicId({ publicCaseId: "CASE-2026-000001", number: 9 }) !== "CASE-2026-000001") throw new Error("stored id ignored");
  });
  it("None means no identity upload and no address-proof demand; other choices follow the selection", () => {
    if (shared.requiredDocs("ration", "none").length !== 1) throw new Error("none should leave only income proof");
    if (!shared.requiredDocs("ration", "passport").includes("passport")) throw new Error("passport not required");
    if (!shared.requiredDocs("ration").includes("aadhaar")) throw new Error("default stays Aadhaar");
    if (shared.identityCleared({ idProofType: "none" })) throw new Error("none must not be cleared by itself");
    if (!shared.identityCleared({ idProofType: "none", verificationMethod: "home_visit" })) throw new Error("home visit clears it");
    if (shared.identityCleared({ idProofType: "none", verificationMethod: "none_available" })) throw new Error("none_available is not a verification");
  });
});

describe("applying with no ID proof", () => {
  it("None is allowed with a reason, and refused without one or with an unknown type", async () => {
    await assertSucceeds(addDoc(collection(asUser("alice"), "cases"), { ...base, idProofType: "none", noIdReason: "document_lost", verificationStatus: "pending_review" }));
    await assertFails(addDoc(collection(asUser("alice"), "cases"), { ...base, idProofType: "none" }));
    await assertFails(addDoc(collection(asUser("alice"), "cases"), { ...base, idProofType: "none", noIdReason: "because" }));
    await assertFails(addDoc(collection(asUser("alice"), "cases"), { ...base, idProofType: "library_card" }));
    await assertSucceeds(addDoc(collection(asUser("alice"), "cases"), { ...base, idProofType: "passport" }));
  });
  it("an applicant cannot pre-clear their own case", async () => {
    for (const extra of [{ verificationStatus: "verified" }, { priority: "urgent" }, { verificationMethod: "home_visit" }, { emergencyException: { reason: "trust me", approvedBy: "alice" } }, { zakatEligible: true }]) {
      await assertFails(addDoc(collection(asUser("alice"), "cases"), { ...base, idProofType: "none", noIdReason: "minor", ...extra }));
    }
  });
  it("the public id must be well formed", async () => {
    await assertSucceeds(addDoc(collection(asUser("alice"), "cases"), { ...base, publicCaseId: "CASE-2026-000184" }));
    await assertFails(addDoc(collection(asUser("alice"), "cases"), { ...base, publicCaseId: "Ayaan Khan" }));
    await assertFails(addDoc(collection(asUser("alice"), "cases"), { ...base, publicCaseId: "CASE-26-184" }));
  });
  it("a proof photo can be an ID type other than Aadhaar", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "cases", "draft"), { applicantId: "alice", status: "draft" }));
    const photo = { kind: "passport", name: "p.jpg", dataUrl: "data:image/jpeg;base64,AAAA", uploadedAt: serverTimestamp() };
    await assertSucceeds(addDoc(collection(asUser("alice"), "cases", "draft", "documents"), photo));
    await assertFails(addDoc(collection(asUser("alice"), "cases", "draft", "documents"), { ...photo, kind: "selfie" }));
  });
});

describe("a case with no ID is verified another way, not turned away", () => {
  it("staff can verify it, but it cannot be approved until the identity is cleared", async () => {
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "noId"), { status: "approved", approvedBy: "tru1" }));
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "cases", "withId"), { status: "approved", approvedBy: "tru1" })); // ordinary path unchanged
  });
  it("an alternative verification method clears it; 'none available' does not", async () => {
    const alt = (method: string) => ({ verificationMethod: method, verificationNotes: "Visited the family", verificationBy: "ver1", verificationAt: serverTimestamp(), verificationStatus: "verified" });
    await assertSucceeds(updateDoc(doc(asUser("ver1"), "cases", "noId"), alt("none_available")));
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "noId"), { status: "approved", approvedBy: "tru1" }));
    await assertSucceeds(updateDoc(doc(asUser("ver1"), "cases", "noId"), alt("home_visit")));
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "cases", "noId"), { status: "approved", approvedBy: "tru1" }));
  });
  it("only staff can record it, as themselves, with a listed method, and not on a case that has ID", async () => {
    const alt = { verificationMethod: "home_visit", verificationNotes: "x", verificationBy: "vol", verificationAt: serverTimestamp(), verificationStatus: "verified" };
    await assertFails(updateDoc(doc(asUser("vol"), "cases", "noId"), alt));
    await assertFails(updateDoc(doc(asUser("alice"), "cases", "noId"), alt));
    await assertFails(updateDoc(doc(asUser("ver1"), "cases", "noId"), { ...alt, verificationBy: "tru1" }));
    await assertFails(updateDoc(doc(asUser("ver1"), "cases", "noId"), { ...alt, verificationBy: "ver1", verificationMethod: "gut_feeling" }));
    await assertFails(updateDoc(doc(asUser("ver1"), "cases", "withId"), { ...alt, verificationBy: "ver1" }));
  });
  it("an emergency exception, approved by a trustee or admin with a reason, clears it and is recorded", async () => {
    const ex = (by: string, reason = "Child needs surgery tonight") => ({ emergencyException: { reason, approvedBy: by, at: serverTimestamp() }, priority: "urgent" });
    await assertFails(updateDoc(doc(asUser("ver1"), "cases", "noId"), ex("ver1"))); // a verifier cannot grant it
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "noId"), ex("tru2"))); // approver must be themselves
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "noId"), ex("tru1", "ok"))); // reason too short
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "cases", "noId"), ex("tru1")));
    await assertSucceeds(updateDoc(doc(asUser("tru2"), "cases", "noId"), { status: "approved", approvedBy: "tru2" }));
  });
  it("the two-person rule still holds under an emergency", async () => {
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "cases", "noId"), { emergencyException: { reason: "Urgent surgery", approvedBy: "tru1", at: serverTimestamp() }, priority: "urgent" }));
    await assertFails(updateDoc(doc(asUser("ver1"), "cases", "noId"), { status: "approved", approvedBy: "ver1" })); // verifier cannot approve
    await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), "cases", "noId"), { verifiedBy: "tru1" }));
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "noId"), { status: "approved", approvedBy: "tru1" })); // whoever verified cannot approve
  });
});

describe("priority, category and restricted-fund eligibility", () => {
  it("staff set priority and category; volunteers and applicants cannot; values are checked", async () => {
    await assertSucceeds(updateDoc(doc(asUser("ver1"), "cases", "submittedNoId"), { priority: "high", needCategory: "healthcare" }));
    await assertFails(updateDoc(doc(asUser("ver1"), "cases", "submittedNoId"), { priority: "whenever" }));
    await assertFails(updateDoc(doc(asUser("vol"), "cases", "submittedNoId"), { priority: "high" }));
    await assertFails(updateDoc(doc(asUser("alice"), "cases", "submittedNoId"), { priority: "urgent" }));
  });
  it("only a trustee or admin marks a case Zakat or Khums eligible", async () => {
    // refusals first: an update that changes nothing is a no-op and would pass for any staff member
    await assertFails(updateDoc(doc(asUser("ver1"), "cases", "pub"), { zakatEligible: true }));
    await assertFails(updateDoc(doc(asUser("alice"), "cases", "pub"), { zakatEligible: true }));
    await assertFails(updateDoc(doc(asUser("tru1"), "cases", "pub"), { zakatEligible: "yes" }));
    await assertSucceeds(updateDoc(doc(asUser("tru1"), "cases", "pub"), { zakatEligible: true }));
    await assertSucceeds(updateDoc(doc(asUser("adm"), "cases", "pub"), { khumsEligible: true }));
  });
  it("the committee can add a category; members can read the list but not change it", async () => {
    await assertSucceeds(addDoc(collection(asUser("adm"), "caseCategories"), { label: "Wheelchair", active: true, createdBy: "adm" }));
    await assertFails(addDoc(collection(asUser("alice"), "caseCategories"), { label: "Sneaky", active: true, createdBy: "alice" }));
    await assertFails(addDoc(collection(asUser("adm"), "caseCategories"), { label: "x", active: true, createdBy: "adm" }));
    const row = await assertSucceeds(addDoc(collection(asUser("adm"), "caseCategories"), { label: "Dialysis", active: true, createdBy: "adm" }));
    await assertSucceeds(getDoc(doc(asUser("alice"), "caseCategories", row.id)));
  });
});

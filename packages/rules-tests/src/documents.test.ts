// Private documents and proofs: who can open them, that every view by someone else is audited, and what an upload must be.
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { beforeAll, describe, expect, it } from "vitest";

const PROJECT = "ks1j-8a2e3";
const b64 = (bytes: number[], pad = 64) => Buffer.from([...bytes, ...new Array(pad).fill(1)]).toString("base64");
const JPEG = (n = 0) => `data:image/jpeg;base64,${b64([0xff, 0xd8, 0xff, 0xe0, n])}`;
const PNG = `data:image/png;base64,${b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])}`;
const PDF = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 test proof").toString("base64")}`;

describe("documents and proofs (emulator)", () => {
  const mk = async (uid: string, role: string) => {
    const app = initializeApp({ projectId: PROJECT, apiKey: "fake" }, `doc-${uid}`);
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
  let owner: Awaited<ReturnType<typeof mk>>;
  let stranger: Awaited<ReturnType<typeof mk>>;
  let verifier: Awaited<ReturnType<typeof mk>>;
  let volunteer: Awaited<ReturnType<typeof mk>>;
  let admin: Awaited<ReturnType<typeof mk>>;
  let trustee: Awaited<ReturnType<typeof mk>>;
  const db = () => adminDb();
  const auditOf = async (action: string, actor: string) => (await db().collection("auditLogs").where("action", "==", action).where("actor", "==", actor).get()).size;

  beforeAll(async () => {
    initAdmin({ projectId: PROJECT });
    owner = await mk("dc-owner", "member");
    stranger = await mk("dc-stranger", "member");
    verifier = await mk("dc-verifier", "verifier");
    volunteer = await mk("dc-vol", "volunteer");
    admin = await mk("dc-admin", "admin");
    trustee = await mk("dc-trustee", "trustee");
    await db().doc("cases/dc-case").set({ applicantId: "dc-owner", status: "submitted" });
    await db().doc("cases/dc-case/documents/d1").set({ kind: "aadhaar", name: "a.jpg", dataUrl: JPEG(), addedBy: null });
    await db().doc("loans/dc-loan").set({ borrowerId: "dc-owner", status: "applied" });
    await db().doc("loans/dc-loan/documents/l1").set({ kind: "income_proof", name: "i.jpg", dataUrl: JPEG(1) });
    await db().doc("institutions/dc-inst").set({ name: "Madrasa" });
    await db().doc("institutions/dc-inst/documents/i1").set({ kind: "ijazah", name: "ij.jpg", dataUrl: JPEG(2) });
  });

  it("the owner and committee staff can list and open documents; everyone else is refused", async () => {
    expect((await owner("listDocuments", { parent: "cases", id: "dc-case" })).documents).toHaveLength(1);
    expect((await verifier("listDocuments", { parent: "cases", id: "dc-case" })).documents[0]).not.toHaveProperty("dataUrl"); // the list carries no images
    expect((await owner("getDocument", { parent: "cases", id: "dc-case", docId: "d1" })).dataUrl).toMatch(/^data:image\/jpeg/);
    expect((await owner("getDocument", { parent: "loans", id: "dc-loan", docId: "l1" })).kind).toBe("income_proof");
    for (const who of [stranger, volunteer]) {
      await expect(who("listDocuments", { parent: "cases", id: "dc-case" })).rejects.toThrow(/cannot view/);
      await expect(who("getDocument", { parent: "cases", id: "dc-case", docId: "d1" })).rejects.toThrow(/cannot view/);
    }
    await expect(owner("getDocument", { parent: "institutions", id: "dc-inst", docId: "i1" })).rejects.toThrow(/cannot view/); // staff only
    await expect(verifier("getDocument", { parent: "elsewhere", id: "x", docId: "y" })).rejects.toThrow(/Unknown document set/);
    await expect(verifier("getDocument", { parent: "cases", id: "dc-case", docId: "nope" })).rejects.toThrow(/No such document/);
  });

  it("every view by someone other than the owner is audited; the owner's own view is not", async () => {
    const before = await auditOf("DOCUMENT_ACCESSED", "dc-verifier");
    await verifier("getDocument", { parent: "cases", id: "dc-case", docId: "d1" });
    await verifier("getDocument", { parent: "loans", id: "dc-loan", docId: "l1" });
    await admin("getDocument", { parent: "institutions", id: "dc-inst", docId: "i1" });
    expect(await auditOf("DOCUMENT_ACCESSED", "dc-verifier")).toBe(before + 2);
    expect(await auditOf("DOCUMENT_ACCESSED", "dc-admin")).toBe(1);
    const entry = (await db().collection("auditLogs").where("action", "==", "DOCUMENT_ACCESSED").where("actor", "==", "dc-admin").get()).docs[0].data();
    expect(entry).toMatchObject({ entityType: "institutionDocument", entityId: "dc-inst/i1", newValue: { kind: "ijazah" } });
    await owner("getDocument", { parent: "cases", id: "dc-case", docId: "d1" });
    expect(await auditOf("DOCUMENT_ACCESSED", "dc-owner")).toBe(0);
  });

  describe("proof of payout", () => {
    const payout = async (id: string, extra: object = {}) => db().doc(`disbursements/${id}`).set({ allocationId: "al", donationId: "d", donorId: "dn", caseId: "dc-case", amount: 1000, method: "upi", status: "completed", proofStatus: "none", processedBy: "dc-admin", ...extra });

    it("only an admin can upload, and only a real JPEG, PNG or PDF under 3 MB", async () => {
      await payout("p1");
      await expect(trustee("uploadProof", { disbursementId: "p1", name: "r.jpg", dataUrl: JPEG() })).rejects.toThrow(/Admins only/);
      await expect(admin("uploadProof", { disbursementId: "p1", name: "r.txt", dataUrl: "data:text/plain;base64,aGVsbG8=" })).rejects.toThrow(/JPEG or PNG/);
      await expect(admin("uploadProof", { disbursementId: "p1", name: "fake.jpg", dataUrl: `data:image/jpeg;base64,${Buffer.from("not an image at all").toString("base64")}` })).rejects.toThrow(/not what it says/);
      await expect(admin("uploadProof", { disbursementId: "p1", name: "big.pdf", dataUrl: `data:application/pdf;base64,${Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(3_100_000)]).toString("base64")}` })).rejects.toThrow(/under 3 MB/);
      await expect(admin("uploadProof", { disbursementId: "missing", name: "r.jpg", dataUrl: JPEG() })).rejects.toThrow(/cannot take a proof/);
      expect((await db().doc("disbursements/p1").get()).get("proofStatus")).toBe("none");
    });

    it("stores the file privately, marks it pending review, and opening it is audited and admin only", async () => {
      await admin("uploadProof", { disbursementId: "p1", name: "receipt.pdf", dataUrl: PDF });
      const d = (await db().doc("disbursements/p1").get()).data()!;
      expect(d).toMatchObject({ proofStatus: "pending", proofType: "application/pdf" });
      expect(d.proofKey).toMatch(/^[0-9a-f]{64}$/);
      const priv = (await db().doc("disbursements/p1/private/details").get()).data()!;
      expect(priv.proofPath).toMatch(/^proofs\/p1\/[0-9a-f]{64}\.pdf$/);
      expect(JSON.stringify(d)).not.toContain(priv.proofPath); // the donor-visible record never holds the path
      const got = await admin("getProof", { disbursementId: "p1" });
      expect(got).toMatchObject({ type: "application/pdf", name: "receipt.pdf" });
      expect(Buffer.from(got.dataUrl.split(",")[1], "base64").toString()).toBe("%PDF-1.4 test proof");
      expect(await auditOf("DOCUMENT_ACCESSED", "dc-admin")).toBeGreaterThanOrEqual(2);
      expect(await auditOf("DOCUMENT_UPLOADED", "dc-admin")).toBe(1);
      await expect(trustee("getProof", { disbursementId: "p1" })).rejects.toThrow(/Admins only/);
      await expect(admin("getProof", { disbursementId: "p2-none" })).rejects.toThrow(/No file/);
    });

    it("the same file cannot be the proof for two payouts, a proof can be replaced until verified, never after", async () => {
      await payout("p2");
      await expect(admin("uploadProof", { disbursementId: "p2", name: "again.pdf", dataUrl: PDF })).rejects.toThrow(/already the proof for another payout/);
      await admin("uploadProof", { disbursementId: "p2", name: "one.png", dataUrl: PNG });
      await admin("uploadProof", { disbursementId: "p2", name: "two.jpg", dataUrl: JPEG(7) }); // replaced while pending
      expect((await db().doc("disbursements/p2").get()).get("proofType")).toBe("image/jpeg");
      await db().doc("disbursements/p2").update({ proofStatus: "verified" });
      await expect(admin("uploadProof", { disbursementId: "p2", name: "late.jpg", dataUrl: JPEG(9) })).rejects.toThrow(/already verified/);
    });
  });
});

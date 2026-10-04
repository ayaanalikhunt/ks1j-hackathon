// The public case timeline: real events, no identities, nothing for cases that are not public.
import { initializeApp as initAdmin } from "firebase-admin/app";
import { Timestamp, getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { beforeAll, describe, expect, it } from "vitest";
import * as tl from "../../../functions/lib/timeline.js";

const PROJECT = "ks1j-8a2e3";
const ts = (iso: string) => ({ toDate: () => new Date(iso) });

describe("public case view (pure)", () => {
  const c = { applicantId: "SECRET-UID", applicantName: "Private Person", applicantPhone: "999", applicantAddress: "12 Hidden Lane", amountRequested: 10000, raised: 10000, status: "disbursed", needCategory: "healthcare" };
  const events = [
    { kind: "paid_out", actorId: "SECRET-ADMIN", note: "Paid City Hospital", at: ts("2026-10-05T10:00:00Z") },
    { kind: "submitted", actorId: "SECRET-UID", at: ts("2026-10-01T10:00:00Z") },
    { kind: "gift_received", actorId: "DONOR-UID", at: ts("2026-10-04T10:00:00Z") },
    { kind: "verified", actorId: "V1", note: "Aadhaar checked", at: ts("2026-10-02T10:00:00Z") },
    { kind: "verified", actorId: "V2", at: ts("2026-10-03T10:00:00Z") }, // repeated kind: first one wins
    { kind: "document_added", actorId: "SECRET-UID", note: "Medical report", at: ts("2026-10-01T11:00:00Z") },
  ];
  const out = tl.buildPublicCase(c, events, [{ status: "allocated", disbursedAmount: 10000 }], [{ status: "completed", proofStatus: "pending" }], "CASE-2026-000184");

  it("shows the real events in order, once each, with fixed wording", () => {
    expect(out.timeline.map((e: { kind: string }) => e.kind)).toEqual(["submitted", "verified", "paid_out"]);
    expect(out.timeline[1].at).toBe("2026-10-02T10:00:00.000Z");
    expect(out.timeline[2].label).toBe("Funds disbursed");
  });
  it("carries no name, address, phone, user id, note or donor", () => {
    const s = JSON.stringify(out);
    for (const secret of ["SECRET", "Private Person", "Hidden Lane", "999", "DONOR", "Aadhaar", "City Hospital", "Medical report"]) expect(s).not.toContain(secret);
  });
  it("reports progress from the records and never claims verified proof early", () => {
    expect(out).toMatchObject({ reference: "CASE-2026-000184", requested: 10000, raised: 10000, disbursed: 10000, fundingPercent: 100, disbursementPercent: 100 });
    expect(out.disbursementNote).toMatch(/pending committee verification/);
    const reviewed = tl.buildPublicCase(c, events, [], [{ status: "completed", proofStatus: "verified" }, { status: "completed", proofStatus: "verified" }], "X");
    expect(reviewed.disbursementNote).toMatch(/Proof reviewed/);
    const mixed = tl.buildPublicCase(c, events, [], [{ status: "completed", proofStatus: "verified" }, { status: "completed", proofStatus: "pending" }], "X");
    expect(mixed.disbursementNote).toMatch(/pending/);
    expect(tl.buildPublicCase(c, events, [], [], "X").disbursementNote).toBeNull();
  });
  it("reads a case reference, and rejects anything else", () => {
    expect(tl.numberFromRef("CASE-2026-000184")).toBe(184);
    expect(tl.numberFromRef("184")).toBeNull();
    expect(tl.numberFromRef("CASE-26-184")).toBeNull();
    expect(tl.numberFromRef(undefined)).toBeNull();
  });
});

describe("public case functions (emulator)", () => {
  const app = initializeApp({ projectId: PROJECT, apiKey: "fake" }, "public-anon");
  const fns = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = (name: string, data: unknown) => httpsCallable<unknown, any>(fns, name)(data).then((r) => r.data);

  beforeAll(async () => {
    initAdmin({ projectId: PROJECT });
    const db = adminDb();
    const base = { applicantId: "pc-secret-uid", applicantName: "Hidden Family", applicantAddress: "Hidden Street", amountRequested: 5000, raised: 5000, needCategory: "ration" };
    await db.doc("cases/pc-public").set({ ...base, number: 900184, status: "funded", publicCaseId: "CASE-2026-900184" });
    await db.doc("cases/pc-draft").set({ ...base, number: 900185, status: "submitted" });
    await db.doc("cases/pc-declined").set({ ...base, number: 900186, status: "declined" });
    const ev = (kind: string, iso: string) => db.collection("caseEvents").add({ caseId: "pc-public", applicantId: "pc-secret-uid", kind, actorId: "staff-secret", note: "private note", at: Timestamp.fromDate(new Date(iso)) });
    await ev("submitted", "2026-10-01T10:00:00Z");
    await ev("verified", "2026-10-02T10:00:00Z");
    await ev("approved", "2026-10-03T10:00:00Z");
    await ev("published", "2026-10-03T12:00:00Z");
    await ev("funded", "2026-10-04T10:00:00Z");
  });

  it("anyone, signed in or not, can read a public case timeline built from real events", async () => {
    const r = await call("getPublicCase", { ref: "CASE-2026-900184" });
    expect(r.timeline.map((e: { kind: string }) => e.kind)).toEqual(["submitted", "verified", "approved", "published", "funded"]);
    expect(r).toMatchObject({ requested: 5000, raised: 5000, fundingPercent: 100, status: "funded", reference: "CASE-2026-900184" });
    const s = JSON.stringify(r);
    for (const secret of ["pc-secret-uid", "Hidden", "staff-secret", "private note"]) expect(s).not.toContain(secret);
  });
  it("a case that is not public looks the same as one that does not exist", async () => {
    await expect(call("getPublicCase", { ref: "CASE-2026-900185" })).rejects.toThrow(/No public case/);
    await expect(call("getPublicCase", { ref: "CASE-2026-900186" })).rejects.toThrow(/No public case/);
    await expect(call("getPublicCase", { ref: "CASE-2026-999999" })).rejects.toThrow(/No public case/);
    await expect(call("getPublicCase", { ref: "pc-public" })).rejects.toThrow(/not a case reference/);
  });
  it("the list shows public cases only, with no identities", async () => {
    const { cases } = await call("listPublicCases", {});
    const refs = cases.map((c: { reference: string }) => c.reference);
    expect(refs).toContain("CASE-2026-900184");
    expect(refs).not.toContain("CASE-2026-900185");
    expect(JSON.stringify(cases)).not.toMatch(/Hidden|secret/);
  });
});

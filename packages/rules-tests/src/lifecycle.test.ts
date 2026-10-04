// End to end: a real case travels the whole lifecycle through the real rules and the real Cloud Functions,
// all on local emulators. Nothing here touches production.
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { beforeAll, describe, expect, it } from "vitest";

const PROJECT = "ks1j-8a2e3";
let n = 0;

function client(name: string) {
  const app: FirebaseApp = initializeApp({ projectId: PROJECT, apiKey: "fake" }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  return { app, auth, db, fns };
}

async function person(uid: string, role: string) {
  const c = client(`${uid}-${n++}`);
  await adminAuth().createUser({ uid, email: `${uid}@test.invalid` });
  await adminDb().doc(`members/${uid}`).set({ fullName: uid, role, sadaatVerified: false, phone: "+91 12345 67890" });
  const token = await adminAuth().createCustomToken(uid);
  await signInWithCustomToken(c.auth, token);
  return c;
}

const callable = (c: ReturnType<typeof client>, name: string) => httpsCallable(c.fns, name);

describe("case lifecycle, end to end", () => {
  let member: ReturnType<typeof client>;
  let verifier: ReturnType<typeof client>;
  let trustee: ReturnType<typeof client>;
  let finance: ReturnType<typeof client>;
  let volunteer: ReturnType<typeof client>;
  const donor = client("donor-anon"); // never signs in: a guest donor
  let caseId = "";
  let number = 0;

  beforeAll(async () => {
    initAdmin({ projectId: PROJECT });
    member = await person("e2e-member", "member");
    verifier = await person("e2e-verifier", "verifier");
    trustee = await person("e2e-trustee", "trustee");
    finance = await person("e2e-finance", "admin");
    volunteer = await person("e2e-volunteer", "volunteer");
  });

  it("member applies: gets a case number, attaches proof, submits, and the event is logged", async () => {
    number = await runTransaction(member.db, async (tx) => {
      const ref = doc(member.db, "counters", "cases");
      const snap = await tx.get(ref);
      const next = (snap.exists() ? (snap.data().n as number) : 0) + 1;
      tx.set(ref, { n: next });
      return next;
    });
    expect(number).toBe(1);
    const ref = await addDoc(collection(member.db, "cases"), {
      applicantId: "e2e-member",
      applicantName: "Test Member",
      number,
      title: "Class 10 fees",
      type: "education",
      category: "welfare",
      sadaatClaimed: true,
      requirement: "Fees for class 10",
      description: "Fees for class 10",
      amountRequested: 1000,
      raised: 0,
      status: "draft",
    });
    caseId = ref.id;
    const img = "data:image/jpeg;base64," + "A".repeat(200);
    for (const kind of ["aadhaar", "address_proof", "fee_receipt", "mark_sheet", "income_proof"]) {
      await addDoc(collection(ref, "documents"), { kind, name: `${kind}.jpg`, dataUrl: img });
    }
    await updateDoc(doc(member.db, "cases", caseId), { status: "submitted" });
    await addDoc(collection(member.db, "caseEvents"), { caseId, applicantId: "e2e-member", caseNumber: number, caseTitle: "Class 10 fees", kind: "submitted", actorId: "e2e-member" });
    expect((await getDoc(doc(member.db, "cases", caseId))).data()?.status).toBe("submitted");
  });

  it("a volunteer and another member cannot see or touch the case", async () => {
    await expect(getDoc(doc(volunteer.db, "cases", caseId))).rejects.toThrow();
    await expect(updateDoc(doc(volunteer.db, "cases", caseId), { status: "verified", verifiedBy: "e2e-volunteer" })).rejects.toThrow();
  });

  it("verifier verifies (Sadaat checked); the same person cannot also approve", async () => {
    await updateDoc(doc(verifier.db, "cases", caseId), { status: "verified", verifiedBy: "e2e-verifier", beneficiarySadaatVerified: true, sadaatCheckedBy: "e2e-verifier" });
    await expect(updateDoc(doc(verifier.db, "cases", caseId), { status: "approved", approvedBy: "e2e-verifier" })).rejects.toThrow();
  });

  it("a trustee approves, then publishes with a PII-free card", async () => {
    await updateDoc(doc(trustee.db, "cases", caseId), { status: "approved", approvedBy: "e2e-trustee" });
    await setDoc(doc(trustee.db, "publicCases", `pub-${caseId}`), {
      caseId, category: "welfare", type: "education", number, title: "Class 10 fees", sadaat: true,
      description: "A student needs help with fees", amountNeeded: 1000, amountRaised: 0,
    });
    await updateDoc(doc(trustee.db, "cases", caseId), { status: "published", publishedBy: "e2e-trustee" });
    const card = (await getDoc(doc(donor.db, "publicCases", `pub-${caseId}`))).data();
    expect(card?.title).toBe("Class 10 fees");
    expect(JSON.stringify(card)).not.toMatch(/Test Member|e2e-member|\+91/);
  });

  it("a guest donor can give to a published Sadaat case, but only as pending", async () => {
    await expect(addDoc(collection(donor.db, "donations"), { fund: "general", caseId, amount: 400, status: "paid", payerId: null })).rejects.toThrow();
    await addDoc(collection(donor.db, "donations"), { fund: "sehme_sadaat", caseId, amount: 400, status: "pending", payerId: null });
    await addDoc(collection(donor.db, "donations"), { fund: "general", caseId, amount: 600, status: "pending", payerId: null });
  });

  it("only an admin can confirm payments; a trustee cannot", async () => {
    const pending = await getDocs(query(collection(finance.db, "donations"), where("caseId", "==", caseId)));
    expect(pending.size).toBe(2);
    await expect(callable(trustee, "confirmPayment")({ kind: "donation", id: pending.docs[0].id })).rejects.toThrow(/Admins only|permission/i);
  });

  it("confirming gifts fills the case, drops it off the public list and writes ledger rows", async () => {
    const pending = await getDocs(query(collection(finance.db, "donations"), where("caseId", "==", caseId)));
    const [first, second] = pending.docs;
    await callable(finance, "confirmPayment")({ kind: "donation", id: first.id });
    let c = (await getDoc(doc(finance.db, "cases", caseId))).data();
    expect(c?.status).toBe("published"); // part funded
    expect(c?.raised).toBe(first.data().amount);
    await callable(finance, "confirmPayment")({ kind: "donation", id: second.id });
    // idempotent
    await callable(finance, "confirmPayment")({ kind: "donation", id: second.id });
    c = (await getDoc(doc(finance.db, "cases", caseId))).data();
    expect(c?.raised).toBe(1000);
    expect(c?.status).toBe("funded");
    expect((await getDoc(doc(donor.db, "publicCases", `pub-${caseId}`))).exists()).toBe(false);
    // donors can no longer give
    await expect(addDoc(collection(donor.db, "donations"), { fund: "general", caseId, amount: 50, status: "pending", payerId: null })).rejects.toThrow();
    const led = await adminDb().collection("ledger").where("caseId", "==", caseId).get();
    expect(led.size).toBe(2);
    expect(led.docs.every((d) => d.data().direction === "in")).toBe(true);
    const funds = led.docs.map((d) => d.data().fund).sort();
    expect(funds).toEqual(["general", "sehme_sadaat"]);
  });

  it("only an admin can pay out, once, and it writes the ledger out-row", async () => {
    await expect(callable(trustee, "payOutCase")({ caseId })).rejects.toThrow(/Admins only|permission/i);
    await callable(finance, "payOutCase")({ caseId });
    await expect(callable(finance, "payOutCase")({ caseId })).rejects.toThrow(/funded|precondition/i);
    const c = (await getDoc(doc(finance.db, "cases", caseId))).data();
    expect(c?.status).toBe("disbursed");
    const out = (await adminDb().doc(`ledger/payout-${caseId}`).get()).data();
    expect(out).toMatchObject({ direction: "out", fund: "sehme_sadaat", amount: 1000 });
  });

  it("an admin closes it, and the applicant sees every step in their updates", async () => {
    await expect(updateDoc(doc(finance.db, "cases", caseId), { status: "closed", closedBy: "e2e-finance" })).rejects.toThrow(); // only the function can
    await expect(callable(trustee, "closeCase")({ caseId })).rejects.toThrow(/Admins only/);
    await callable(finance, "closeCase")({ caseId });
    await expect(callable(finance, "closeCase")({ caseId })).rejects.toThrow(/paid-out/); // already closed
    const mine = await getDocs(query(collection(member.db, "caseEvents"), where("applicantId", "==", "e2e-member")));
    const kinds = mine.docs.map((d) => d.data().kind);
    expect(kinds).toEqual(expect.arrayContaining(["submitted", "gift_received", "funded", "paid_out", "closed"]));
  });

  it("applicants cannot read the ledger or change a closed case", async () => {
    await expect(getDocs(collection(member.db, "ledger"))).rejects.toThrow();
    await expect(updateDoc(doc(member.db, "cases", caseId), { status: "submitted" })).rejects.toThrow();
  });
});

describe("lawajam dues and institution handovers", () => {
  let finance: ReturnType<typeof client>;
  let father: ReturnType<typeof client>;
  let stranger: ReturnType<typeof client>;
  let trustee: ReturnType<typeof client>;
  const donor = client("donor-anon-2");
  const year = "2026-27";
  let instId = "";

  beforeAll(async () => {
    finance = await person("lw-finance", "admin");
    father = await person("lw-father", "member");
    stranger = await person("lw-stranger", "member");
    trustee = await person("lw-trustee", "trustee");
  });

  it("members cannot link themselves to a household; an admin can", async () => {
    await setDoc(doc(finance.db, "households", "h1"), { name: "Test household", area: "Andheri", createdBy: "lw-finance" });
    await expect(updateDoc(doc(father.db, "members", "lw-father"), { householdId: "h1" })).rejects.toThrow();
    await updateDoc(doc(finance.db, "members", "lw-father"), { householdId: "h1" });
    expect((await getDoc(doc(father.db, "households", "h1"))).data()?.area).toBe("Andheri");
    await expect(getDoc(doc(stranger.db, "households", "h1"))).rejects.toThrow();
  });

  it("an admin raises a due once per household per year", async () => {
    const rec = { householdId: "h1", householdName: "Test household", area: "Andheri", year, amount: 1200, status: "due", createdBy: "lw-finance" };
    await setDoc(doc(finance.db, "lawajamRecords", `h1_${year}`), rec);
    await expect(setDoc(doc(finance.db, "lawajamRecords", `h1_${year}`), rec)).rejects.toThrow(); // already exists, no overwrite
    await expect(setDoc(doc(finance.db, "lawajamRecords", "wrong-id"), rec)).rejects.toThrow();
    await expect(setDoc(doc(trustee.db, "lawajamRecords", "h1_2027-28"), { ...rec, year: "2027-28" })).rejects.toThrow();
  });

  it("only the household can see and pay its due, for exactly the due amount", async () => {
    expect((await getDoc(doc(father.db, "lawajamRecords", `h1_${year}`))).data()?.amount).toBe(1200);
    await expect(getDoc(doc(stranger.db, "lawajamRecords", `h1_${year}`))).rejects.toThrow();
    const pay = { recordId: `h1_${year}`, householdId: "h1", year, amount: 1200, payerId: "lw-father", status: "pending" };
    await expect(addDoc(collection(father.db, "lawajamPayments"), { ...pay, amount: 100 })).rejects.toThrow();
    await expect(addDoc(collection(father.db, "lawajamPayments"), { ...pay, status: "paid" })).rejects.toThrow();
    await expect(addDoc(collection(stranger.db, "lawajamPayments"), { ...pay, payerId: "lw-stranger" })).rejects.toThrow();
    await addDoc(collection(father.db, "lawajamPayments"), pay);
  });

  it("confirming the payment marks the household paid and writes the lawajam ledger row", async () => {
    const pays = await getDocs(query(collection(finance.db, "lawajamPayments"), where("householdId", "==", "h1")));
    await callable(finance, "confirmPayment")({ kind: "lawajam", id: pays.docs[0].id });
    const rec = (await getDoc(doc(father.db, "lawajamRecords", `h1_${year}`))).data();
    expect(rec?.status).toBe("paid");
    const led = await adminDb().doc(`ledger/lawajam-${pays.docs[0].id}`).get();
    expect(led.data()).toMatchObject({ fund: "lawajam", direction: "in", amount: 1200, householdId: "h1" });
    // Already paid: no second payment can be started.
    await expect(
      addDoc(collection(father.db, "lawajamPayments"), { recordId: `h1_${year}`, householdId: "h1", year, amount: 1200, payerId: "lw-father", status: "pending" }),
    ).rejects.toThrow();
  });

  it("sehme imam: gifts build up what is held for a verified institution", async () => {
    // Two-person rule: one person adds the institution, a DIFFERENT trustee verifies the ijazah.
    const ref = await addDoc(collection(finance.db, "institutions"), { name: "Test Hawza", city: "Mumbai", marja: "Test Marja", ijazahVerified: false, addedBy: "lw-finance" });
    instId = ref.id;
    await addDoc(collection(finance.db, "institutions", instId, "documents"), { kind: "ijazah", name: "ijazah.jpg", dataUrl: "data:image/jpeg;base64,AAAA", addedBy: "lw-finance" });
    await expect(updateDoc(doc(finance.db, "institutions", instId), { ijazahVerified: true, verifiedBy: "lw-finance" })).rejects.toThrow(); // cannot verify your own
    await expect(updateDoc(doc(father.db, "institutions", instId), { ijazahVerified: true, verifiedBy: "lw-father" })).rejects.toThrow();
    await expect(getDoc(doc(father.db, "institutions", instId))).rejects.toThrow(); // hidden from members until verified
    await expect(getDoc(doc(donor.db, "institutions", instId))).rejects.toThrow();
    await expect(addDoc(collection(donor.db, "donations"), { fund: "sehme_imam", institutionId: instId, amount: 100, status: "pending", payerId: null })).rejects.toThrow();
    await updateDoc(doc(trustee.db, "institutions", instId), { ijazahVerified: true, verifiedBy: "lw-trustee" });
    expect((await getDoc(doc(donor.db, "institutions", instId))).data()?.name).toBe("Test Hawza"); // public once verified
    await expect(getDoc(doc(donor.db, "institutions", instId, "documents", "x"))).rejects.toThrow(); // the ijazah image stays staff-only
    await expect(addDoc(collection(finance.db, "institutions"), { name: "Cheat", ijazahVerified: true, addedBy: "lw-finance" })).rejects.toThrow(); // cannot create pre-verified
    await expect(addDoc(collection(finance.db, "institutions"), { name: "Cheat", ijazahVerified: false, addedBy: "lw-finance", received: 99999 })).rejects.toThrow();
    await expect(updateDoc(doc(finance.db, "institutions", instId), { received: 99999 })).rejects.toThrow();
    const d = await addDoc(collection(donor.db, "donations"), { fund: "sehme_imam", institutionId: instId, amount: 1000, status: "pending", payerId: null });
    await callable(finance, "confirmPayment")({ kind: "donation", id: d.id });
    expect((await getDoc(doc(finance.db, "institutions", instId))).data()?.received).toBe(1000);
  });

  it("a handover cannot exceed what is held, and only an admin can record one", async () => {
    await expect(callable(trustee, "recordHandover")({ institutionId: instId, amount: 100, reference: "NEFT-1" })).rejects.toThrow(/Admins only|permission/i);
    await expect(callable(finance, "recordHandover")({ institutionId: instId, amount: 1500, reference: "NEFT-1" })).rejects.toThrow(/held/i);
    await expect(callable(finance, "recordHandover")({ institutionId: instId, amount: 600, reference: "x" })).rejects.toThrow(/required|invalid/i);
    await callable(finance, "recordHandover")({ institutionId: instId, amount: 600, reference: "NEFT-DEMO-001" });
    expect((await getDoc(doc(finance.db, "institutions", instId))).data()?.handedOver).toBe(600);
    await expect(callable(finance, "recordHandover")({ institutionId: instId, amount: 500, reference: "NEFT-DEMO-002" })).rejects.toThrow(/held/i); // only 400 left
    await callable(finance, "recordHandover")({ institutionId: instId, amount: 400, reference: "NEFT-DEMO-003" });
    const out = await adminDb().collection("ledger").where("institutionId", "==", instId).where("direction", "==", "out").get();
    expect(out.size).toBe(2);
    expect(out.docs.every((x) => x.data().fund === "sehme_imam")).toBe(true);
  });

  it("an institution without a verified ijazah can neither take gifts nor receive a handover", async () => {
    const ref = await addDoc(collection(finance.db, "institutions"), { name: "Unverified", ijazahVerified: false, addedBy: "lw-finance" });
    await expect(addDoc(collection(donor.db, "donations"), { fund: "sehme_imam", institutionId: ref.id, amount: 100, status: "pending", payerId: null })).rejects.toThrow();
    await expect(callable(finance, "recordHandover")({ institutionId: ref.id, amount: 1, reference: "NEFT-9" })).rejects.toThrow();
  });
});

describe("orphan education loan, end to end", () => {
  let borrower: ReturnType<typeof client>;
  let verifier: ReturnType<typeof client>;
  let visitor: ReturnType<typeof client>;
  let approver: ReturnType<typeof client>;
  let finance: ReturnType<typeof client>;
  const loanId = "orphan-loan-1";
  const ref = { name: "Teacher", phone: "+91 12345 67890", relation: "Teacher" };
  const stamp = (by: string, extra = {}) => ({ by, at: new Date(), ...extra });

  beforeAll(async () => {
    borrower = await person("ln-borrower", "member");
    verifier = await person("ln-verifier", "verifier");
    visitor = await person("ln-visitor", "trustee");
    approver = await person("ln-approver", "trustee");
    finance = await person("ln-finance", "admin");
  });

  it("the guardian applies with the orphan details, references and documents", async () => {
    await setDoc(doc(borrower.db, "loans", loanId), {
      borrowerId: "ln-borrower", borrowerName: "Guardian", studentName: "Zain", course: "B.Com", institution: "City College",
      courseEnd: "2027-10-01", principal: 60000, purpose: "Three years of fees", orphan: true, parentStatus: "both_deceased",
      guardianName: "Uncle Ali", guardianRelation: "Uncle", guardianPhone: "+91 12345 67890", refs: [ref, { ...ref, name: "Imam" }], status: "applied",
    });
    for (const kind of ["aadhaar", "address_proof", "income_proof", "admission_letter", "fee_structure", "mark_sheet", "death_certificate", "guardian_id"]) {
      await addDoc(collection(borrower.db, "loans", loanId, "documents"), { kind, name: `${kind}.jpg`, dataUrl: "data:image/jpeg;base64,AAAA" });
    }
    await expect(getDocs(collection(verifier.db, "loans", loanId, "documents"))).rejects.toThrow(); // direct reads are closed
    const listed = (await httpsCallable(verifier.fns, "listDocuments")({ parent: "loans", id: loanId })).data as { documents: unknown[] };
    expect(listed.documents.length).toBe(8);
  });

  it("no plan can be proposed on a partial background check, or without a home visit by someone else", async () => {
    const plan = { status: "emi_pending_agreement", trusteeEmi: 1250, reviewedBy: "ln-approver" };
    await expect(updateDoc(doc(approver.db, "loans", loanId), plan)).rejects.toThrow();
    for (const k of ["identity", "address", "income", "institution_fee", "orphan_status", "guardian", "references", "no_other_loans"]) {
      await setDoc(doc(verifier.db, "loans", loanId, "checks", k), stamp("ln-verifier"));
    }
    await expect(updateDoc(doc(approver.db, "loans", loanId), plan)).rejects.toThrow(); // still no home visit
    await setDoc(doc(visitor.db, "loans", loanId, "checks", "home_visit"), stamp("ln-visitor", { recommend: true, report: "Met the family at home and the school. All as described.", date: "2026-10-03" }));
    await expect(updateDoc(doc(visitor.db, "loans", loanId), { ...plan, reviewedBy: "ln-visitor" })).rejects.toThrow(); // the visitor cannot approve
  });

  it("a different trustee proposes the plan; the family and trustee agree on one amount", async () => {
    await updateDoc(doc(approver.db, "loans", loanId), { status: "emi_pending_agreement", trusteeEmi: 1250, reviewedBy: "ln-approver" });
    await expect(updateDoc(doc(borrower.db, "loans", loanId), { familyEmi: 1000 })).rejects.toThrow(); // under the 48-month minimum
    await updateDoc(doc(borrower.db, "loans", loanId), { familyEmi: 1250 });
    await updateDoc(doc(approver.db, "loans", loanId), { status: "agreed", emi: 1250 });
    expect((await getDoc(doc(borrower.db, "loans", loanId))).data()?.status).toBe("agreed");
  });

  it("only an admin can pay it out, once; the schedule starts six months after the course ends", async () => {
    await expect(callable(approver, "disburseLoan")({ loanId })).rejects.toThrow(/Admins only|permission/i);
    await callable(finance, "disburseLoan")({ loanId });
    await expect(callable(finance, "disburseLoan")({ loanId })).rejects.toThrow(/agreed|precondition/i);
    const l = (await getDoc(doc(borrower.db, "loans", loanId))).data();
    expect(l).toMatchObject({ status: "disbursed", nextDue: "2028-04-01", months: 48, repaid: 0, emi: 1250 });
    expect((await adminDb().doc(`ledger/loan-${loanId}`).get()).data()).toMatchObject({ direction: "out", fund: "general", amount: 60000 });
  });

  it("a confirmed instalment moves the due date on; the balance only goes down", async () => {
    const r = await addDoc(collection(borrower.db, "repayments"), { loanId, borrowerId: "ln-borrower", amount: 1250, status: "pending" });
    await expect(addDoc(collection(borrower.db, "repayments"), { loanId, borrowerId: "ln-borrower", amount: 1250, status: "pending", lateFee: 10 })).rejects.toThrow();
    await callable(finance, "confirmPayment")({ kind: "repayment", id: r.id });
    const l = (await getDoc(doc(borrower.db, "loans", loanId))).data();
    expect(l).toMatchObject({ status: "repaying", repaid: 1250, nextDue: "2028-05-01" });
    expect((await adminDb().doc(`ledger/repayment-${r.id}`).get()).data()).toMatchObject({ direction: "in", fund: "loan_repayment", amount: 1250 });
  });

  it("a hardship pause is decided by a trustee through the function, and pushes the next due date back", async () => {
    const h = await addDoc(collection(borrower.db, "hardships"), { loanId, borrowerId: "ln-borrower", type: "pause", months: 2, reason: "Our income stopped for a while.", status: "pending" });
    await expect(callable(borrower, "decideHardship")({ id: h.id, approve: true })).rejects.toThrow(/only|permission/i);
    await callable(approver, "decideHardship")({ id: h.id, approve: true, note: "Income proof seen." });
    await expect(callable(approver, "decideHardship")({ id: h.id, approve: false })).rejects.toThrow(/already|precondition/i);
    const l = (await getDoc(doc(borrower.db, "loans", loanId))).data();
    expect(l?.nextDue).toBe("2028-07-01");
    expect(l?.repaid).toBe(1250); // nothing was added to what is owed
    expect((await getDoc(doc(borrower.db, "hardships", h.id))).data()?.status).toBe("approved");
  });

  it("paying the rest closes the loan", async () => {
    const r = await addDoc(collection(borrower.db, "repayments"), { loanId, borrowerId: "ln-borrower", amount: 58750, status: "pending" });
    await callable(finance, "confirmPayment")({ kind: "repayment", id: r.id });
    const l = (await getDoc(doc(borrower.db, "loans", loanId))).data();
    expect(l?.status).toBe("closed");
    expect(l?.repaid).toBe(60000);
    await expect(addDoc(collection(borrower.db, "repayments"), { loanId, borrowerId: "ln-borrower", amount: 100, status: "pending" })).rejects.toThrow(); // nothing left to repay
  });
});

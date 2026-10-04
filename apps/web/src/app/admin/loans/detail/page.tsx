"use client";

import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  CHECK_LABELS,
  LOAN_DOC_KINDS,
  LOAN_DOC_LABELS,
  LOAN_STATUS_LABELS,
  PARENT_STATUS_LABELS,
  firstEmiDate,
  formatDate,
  formatRupees,
  isoToDmy,
  parseDmy,
  isAdminLike,
  isStaff,
  minEmi,
  requiredChecks,
  requiredLoanDocs,
  type CheckKey,
  type LoanDocKind,
  type ParentStatus,
} from "@ks1j/shared";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";
import { compressImage } from "@/lib/image";
import { useDocs } from "@/lib/documents";
import { useCollection } from "@/lib/useCollection";

interface Ref {
  name: string;
  phone: string;
  relation: string;
}
interface Loan {
  borrowerId: string;
  borrowerName?: string;
  studentName?: string;
  course?: string;
  institution?: string;
  courseEnd?: string;
  principal: number;
  purpose?: string;
  orphan?: boolean;
  parentStatus?: ParentStatus;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  guardianAddress?: string;
  guardianOccupation?: string;
  guardianIncome?: number;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorRelation?: string;
  refs?: Ref[];
  status: string;
  trusteeEmi?: number;
  familyEmi?: number;
  emi?: number;
  repaid?: number;
  nextDue?: string;
  declineNote?: string;
}
interface Check {
  by: string;
  at?: { toDate(): Date } | null;
  note?: string;
  recommend?: boolean;
  report?: string;
  date?: string;
}
interface LoanDoc {
  kind: LoanDocKind;
  dataUrl: string;
  addedBy?: string;
}

const disburse = httpsCallable(getFunctions(auth.app, "asia-south1"), "disburseLoan");
const GHOST = "!bg-card !text-fg border border-line";
const num = (s: string) => Math.max(0, Math.trunc(Number(s) || 0));

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-line py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="max-w-[65%] text-right font-medium [overflow-wrap:anywhere]">{v}</span>
    </div>
  );
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card>
    <h2 className="mb-2 font-display text-xl">{title}</h2>
    {children}
  </Card>
);

function Review() {
  const id = useSearchParams().get("id") ?? "";
  const { user, member } = useAuth();
  const uid = user?.uid ?? "";
  const role = member?.role;
  const [loan, setLoan] = useState<Loan | null | undefined>(undefined);
  const docs = useDocs<LoanDoc>("loans", id);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const members = useCollection<{ fullName: string }>("members");
  const [zoom, setZoom] = useState<LoanDoc | null>(null);
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addKind, setAddKind] = useState<LoanDocKind>("income_proof");
  const [visit, setVisit] = useState({ date: "", report: "", recommend: true });
  const [planEmi, setPlanEmi] = useState("");
  const [declineNote, setDeclineNote] = useState("");
  const [declining, setDeclining] = useState(false);

  const nameOf = (u?: string) => members.rows.find((m) => m.id === u)?.fullName ?? "A staff member";

  useEffect(() => {
    if (!id) return;
    const offs = [
      onSnapshot(doc(db, "loans", id), (s) => setLoan(s.exists() ? (s.data() as Loan) : null), () => setLoan(null)),
      onSnapshot(collection(db, "loans", id, "checks"), (s) => setChecks(Object.fromEntries(s.docs.map((d) => [d.id, d.data() as Check]))), () => {}),
    ];
    return () => offs.forEach((o) => o());
  }, [id]);

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ error: false, text: done });
    } catch (e) {
      setMsg({ error: true, text: "Not allowed: " + (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (loan === undefined) return <p>Loading…</p>;
  if (loan === null) return <Banner>Loan not found, or you do not have access.</Banner>;
  if (!member || !isStaff(member.role)) return <Banner kind="error">Only committee staff can review loans.</Banner>;

  const orphan = loan.orphan === true;
  const ref = doc(db, "loans", id);
  const required = requiredChecks(orphan);
  const doneKeys = new Set(Object.keys(checks));
  const missingChecks = required.filter((k) => !doneKeys.has(k));
  const have = new Set(docs.rows.map((d) => d.kind));
  const missingDocs = requiredLoanDocs(orphan).filter((k) => !have.has(k));
  const min = minEmi(loan.principal);
  const trusteeOrAdmin = role === "trustee" || isAdminLike(role);
  const applying = loan.status === "applied";
  const hv = checks.home_visit;
  const visitBlocks = orphan && hv ? hv.by === uid || hv.recommend !== true : false;
  const canPropose = applying && trusteeOrAdmin && missingChecks.length === 0 && !visitBlocks;
  const proposeEmi = planEmi ? num(planEmi) : min;

  const tick = (k: CheckKey, extra: Record<string, unknown> = {}) =>
    act(() => setDoc(doc(db, "loans", id, "checks", k), { by: uid, at: serverTimestamp(), ...extra }), `${CHECK_LABELS[k]}: recorded under your name.`);
  const addOfficeDoc = (file: File | undefined) => {
    if (!file) return;
    return act(async () => {
      const dataUrl = await compressImage(file);
      await addDoc(collection(db, "loans", id, "documents"), { kind: addKind, name: file.name, dataUrl, uploadedAt: serverTimestamp(), addedBy: uid });
      docs.reload();
    }, `${LOAN_DOC_LABELS[addKind]} added to the file.`);
  };
  const propose = () =>
    act(() => updateDoc(ref, { status: "emi_pending_agreement", trusteeEmi: proposeEmi, reviewedBy: uid, reviewedAt: serverTimestamp() }), "Plan proposed. The family can now accept it or suggest their own amount.");
  const suggest = () => act(() => updateDoc(ref, { trusteeEmi: proposeEmi }), "Suggested. The plan is agreed when the family and you name the same amount.");
  const agree = () => act(() => updateDoc(ref, { status: "agreed", emi: loan.familyEmi, agreedAt: serverTimestamp() }), "Agreed. Finance can now hand over the money.");
  const decline = () =>
    act(async () => {
      await updateDoc(ref, { status: "declined", declinedBy: uid, declineNote: declineNote.trim(), declinedAt: serverTimestamp() });
      setDeclining(false);
    }, "Declined. The family can see your note.");
  const payout = () => act(() => disburse({ loanId: id }), "Money handed over. The ledger entry is recorded and the schedule has started.");

  const matching = loan.familyEmi && loan.familyEmi === loan.trusteeEmi;

  return (
    <>
      <Link href="/admin/loans" className="mb-3 inline-block text-sm underline">← All loans</Link>
      <PageHeader
        eyebrow={`Education loan${orphan ? " · Orphan" : ""}`}
        title={`${loan.studentName ?? "Student"}, ${formatRupees(loan.principal)}`}
        intro={LOAN_STATUS_LABELS[loan.status] ?? loan.status}
      />
      {msg && <div className="mb-3"><Banner kind={msg.error ? "error" : "info"}>{msg.text}</Banner></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Section title="The application">
            <Row k="Student" v={loan.studentName} />
            <Row k="Course" v={loan.course} />
            <Row k="School or college" v={loan.institution} />
            <Row k="Course ends" v={isoToDmy(loan.courseEnd)} />
            <Row k="First instalment (six months later)" v={loan.courseEnd ? isoToDmy(firstEmiDate(loan.courseEnd)) : ""} />
            <Row k="Loan amount" v={formatRupees(loan.principal)} />
            <Row k="Smallest monthly amount" v={formatRupees(min)} />
            <p className="mt-2 whitespace-pre-wrap text-muted">{loan.purpose}</p>
          </Section>

          <Section title="Payer and guarantor (private)">
            <Row k="Payer" v={loan.borrowerName} />
            <Row k="Guarantor" v={loan.guarantorName} />
            <Row k="Guarantor phone" v={loan.guarantorPhone} />
            <Row k="Guarantor relation" v={loan.guarantorRelation} />
          </Section>

          {orphan && (
            <Section title="Orphan background">
              <Row k="Parents" v={loan.parentStatus ? PARENT_STATUS_LABELS[loan.parentStatus] : "Not given"} />
              <Row k="Guardian" v={loan.guardianName} />
              <Row k="Relation to the student" v={loan.guardianRelation} />
              <Row k="Guardian phone" v={loan.guardianPhone} />
              <Row k="Guardian address" v={<span className="whitespace-pre-wrap">{loan.guardianAddress}</span>} />
              <Row k="Occupation" v={loan.guardianOccupation || "Not given"} />
              <Row k="Household income a month" v={loan.guardianIncome != null ? formatRupees(loan.guardianIncome) : "Not given"} />
              <h3 className="mt-3 font-semibold">References to call</h3>
              {(loan.refs ?? []).map((r, i) => (
                <p key={i} className="text-sm">
                  <span className="font-semibold">{r.name}</span> · {r.relation} · {r.phone}
                </p>
              ))}
            </Section>
          )}

          <Section title="Documents">
            {missingDocs.length > 0 && <div className="mb-3"><Banner kind="error">Not yet provided: {missingDocs.map((k) => LOAN_DOC_LABELS[k].toLowerCase()).join(", ")}.</Banner></div>}
            {docs.rows.length === 0 ? (
              <p className="text-muted">No documents were attached.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {docs.rows.map((d) => (
                  <button key={d.id} onClick={() => setZoom(d)} className="text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.dataUrl} alt={LOAN_DOC_LABELS[d.kind] ?? d.kind} className="h-36 w-full rounded-lg border border-line bg-bg object-contain" />
                    <span className="mt-1 block text-sm font-medium">{LOAN_DOC_LABELS[d.kind] ?? d.kind}</span>
                    {d.addedBy && <span className="block text-xs text-muted">Added at the office by {nameOf(d.addedBy)}</span>}
                  </button>
                ))}
              </div>
            )}
            {applying && (
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                <h3 className="font-semibold">Add a document brought to the office</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="min-h-11 rounded-xl border border-line bg-bg px-3" value={addKind} onChange={(e) => setAddKind(e.target.value as LoanDocKind)}>
                    {LOAN_DOC_KINDS.map((k) => (
                      <option key={k} value={k}>{LOAN_DOC_LABELS[k]}</option>
                    ))}
                  </select>
                  <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold">
                    Choose photo
                    <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { addOfficeDoc(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Background check">
            <p className="mb-3 text-sm text-muted">
              {orphan
                ? "An orphan loan needs every check, including a home visit by someone other than the trustee who approves the plan."
                : "Each check is recorded under the name of the person who did it, and cannot be changed."}
            </p>
            <ul className="space-y-3">
              {required.map((k) => {
                const c = checks[k];
                return (
                  <li key={k} className="rounded-xl border border-line p-3">
                    <p className="font-medium">{c ? "✓ " : ""}{CHECK_LABELS[k]}</p>
                    {c ? (
                      <p className="text-sm text-muted">
                        {nameOf(c.by)} · {c.at ? formatDate(c.at.toDate()) : "just now"}
                        {k === "home_visit" && c.report ? <span className="block whitespace-pre-wrap text-fg">{c.report}{c.recommend === false ? " (Does not recommend the loan.)" : ""}</span> : null}
                      </p>
                    ) : applying && k !== "home_visit" ? (
                      <Button className={`${GHOST} mt-2 !min-h-9 !px-3`} disabled={busy} onClick={() => tick(k)}>I did this check</Button>
                    ) : null}
                    {!c && applying && k === "home_visit" && (
                      <div className="mt-2 space-y-2">
                        <Field label="Date of the visit (DD/MM/YYYY)" value={visit.date} onChange={(e) => setVisit((v) => ({ ...v, date: e.target.value }))} />
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium">Written report (at least 20 characters)</span>
                          <textarea className="min-h-24 w-full rounded-xl border border-line bg-bg p-3" value={visit.report} onChange={(e) => setVisit((v) => ({ ...v, report: e.target.value }))} />
                        </label>
                        <label className="flex min-h-11 items-center gap-2">
                          <input type="checkbox" checked={visit.recommend} onChange={(e) => setVisit((v) => ({ ...v, recommend: e.target.checked }))} />
                          I recommend this loan
                        </label>
                        <Button disabled={busy || visit.report.trim().length < 20 || !parseDmy(visit.date)} onClick={() => tick("home_visit", { date: parseDmy(visit.date), report: visit.report.trim(), recommend: visit.recommend })}>
                          Record the home visit
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {visitBlocks && hv && (
              <div className="mt-3"><Banner kind="error">{hv.by === uid ? "You did the home visit, so a different trustee must approve this loan." : "The home visit did not recommend this loan."}</Banner></div>
            )}
          </Section>

          <Card>
            <h2 className="mb-3 font-display text-xl">Decision</h2>
            {applying && (
              <div className="space-y-3">
                <Field label={`Monthly amount to propose (₹). Smallest allowed: ${formatRupees(min)}`} inputMode="numeric" placeholder={String(min)} value={planEmi} onChange={(e) => setPlanEmi(e.target.value)} />
                <div className="flex flex-wrap gap-3">
                  <Button disabled={busy || !canPropose || proposeEmi < min} onClick={propose}>Accept the application and propose this plan</Button>
                  {trusteeOrAdmin && <Button className={GHOST} disabled={busy} onClick={() => setDeclining((v) => !v)}>Decline</Button>}
                </div>
                {!trusteeOrAdmin && <p className="text-sm text-muted">A trustee or admin decides once the checks are done.</p>}
                {trusteeOrAdmin && missingChecks.length > 0 && <p className="text-sm text-muted">Still to do: {missingChecks.map((k) => CHECK_LABELS[k].toLowerCase()).join("; ")}.</p>}
              </div>
            )}

            {loan.status === "emi_pending_agreement" && (
              <div className="space-y-3">
                <Row k="Proposed by the trustee" v={formatRupees(loan.trusteeEmi ?? 0)} />
                <Row k="Proposed by the family" v={loan.familyEmi ? formatRupees(loan.familyEmi) : "Not yet"} />
                {trusteeOrAdmin && (
                  <>
                    <Field label="Suggest a different amount (₹ a month)" inputMode="numeric" placeholder={String(loan.trusteeEmi ?? min)} value={planEmi} onChange={(e) => setPlanEmi(e.target.value)} />
                    <div className="flex flex-wrap gap-3">
                      <Button className={GHOST} disabled={busy || proposeEmi < min} onClick={suggest}>Suggest this amount</Button>
                      <Button disabled={busy || !matching} onClick={agree}>Agree the plan at {formatRupees(loan.familyEmi ?? 0)}</Button>
                      <Button className={GHOST} disabled={busy} onClick={() => setDeclining((v) => !v)}>Decline</Button>
                    </div>
                    {!matching && <p className="text-sm text-muted">The plan is agreed when the family and the trustee name the same amount.</p>}
                  </>
                )}
              </div>
            )}

            {loan.status === "agreed" && (
              <div className="space-y-3">
                <Row k="Agreed monthly amount" v={formatRupees(loan.emi ?? 0)} />
                {isAdminLike(role) ? (
                  <Button disabled={busy} onClick={payout}>Hand over {formatRupees(loan.principal)}</Button>
                ) : (
                  <p className="text-sm text-muted">Waiting for an admin to hand over the money.</p>
                )}
              </div>
            )}

            {["disbursed", "repaying", "closed"].includes(loan.status) && (
              <div>
                <Row k="Monthly amount" v={formatRupees(loan.emi ?? 0)} />
                <Row k="Repaid so far" v={formatRupees(loan.repaid ?? 0)} />
                <Row k="Left to repay" v={formatRupees(loan.principal - (loan.repaid ?? 0))} />
                <Row k="Next instalment" v={loan.nextDue ? isoToDmy(loan.nextDue) : "None"} />
              </div>
            )}

            {loan.status === "declined" && <Banner kind="error">Declined: {loan.declineNote}</Banner>}

            {declining && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Why? (the family will see this)</span>
                  <textarea className="min-h-20 w-full rounded-xl border border-line bg-bg p-3" value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} />
                </label>
                <Button disabled={busy || declineNote.trim().length < 5} onClick={decline}>Confirm: decline</Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4" onClick={() => setZoom(null)} role="dialog">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.dataUrl} alt={LOAN_DOC_LABELS[zoom.kind]} className="max-h-[85vh] max-w-full rounded-lg bg-white object-contain" />
          <button className="rounded-lg bg-white px-4 py-2 font-semibold text-black" onClick={() => setZoom(null)}>Close</button>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Review />
    </Suspense>
  );
}

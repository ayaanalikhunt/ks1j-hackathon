"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useState } from "react";
import {
  FOLLOWUP_LABELS,
  LOAN_STATUS_LABELS,
  followUp,
  formatRupees,
  isoToDmy,
  todayIso,
  toCsv,
} from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, Card, PageHeader } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { downloadText } from "@/lib/download";
import { useCollection } from "@/lib/useCollection";

interface Loan {
  borrowerName?: string;
  studentName?: string;
  course?: string;
  orphan?: boolean;
  principal: number;
  status: string;
  emi?: number;
  repaid?: number;
  nextDue?: string;
  trusteeEmi?: number;
  familyEmi?: number;
  guarantorName?: string;
  guarantorPhone?: string;
}
interface FollowUpTask {
  loanRef?: string | null;
  dueDate: string;
  daysLate: number;
  emi: number;
  left: number;
  guarantorName?: string | null;
  guarantorPhone?: string | null;
  status: string;
}
interface Hardship {
  loanId: string;
  type: "pause" | "lower";
  months?: number;
  newEmi?: number;
  reason: string;
  proofDataUrl?: string;
  status: string;
}

const decide = httpsCallable(getFunctions(auth.app, "asia-south1"), "decideHardship");
const finishFollowUp = httpsCallable(getFunctions(auth.app, "asia-south1"), "completeLoanFollowUp");
const runReminders = httpsCallable<unknown, { reminders: number; tasks: number; checked: number }>(getFunctions(auth.app, "asia-south1"), "runLoanReminders");
const today = () => todayIso();
const nice = (d?: string) => isoToDmy(d);

export default function AdminLoans() {
  const loans = useCollection<Loan>("loans");
  const hardships = useCollection<Hardship>("hardships");
  const followUps = useCollection<FollowUpTask>("loanFollowUps");
  const openTasks = followUps.rows.filter((t) => t.status === "open").sort((a, b) => b.daysLate - a.daysLate);
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const live = loans.rows.filter((l) => l.status === "disbursed" || l.status === "repaying");
  const everLent = loans.rows.filter((l) => ["disbursed", "repaying", "closed"].includes(l.status));
  const lent = everLent.reduce((s, l) => s + l.principal, 0);
  const toRepay = live.reduce((s, l) => s + (l.principal - (l.repaid ?? 0)), 0);
  const review = loans.rows.filter((l) => l.status === "applied");
  const agree = loans.rows.filter((l) => l.status === "emi_pending_agreement");
  const agreed = loans.rows.filter((l) => l.status === "agreed");
  const pendingHardships = hardships.rows.filter((h) => h.status === "pending");
  const hardshipLoanIds = new Set(pendingHardships.map((h) => h.loanId));
  const loanOf = (id: string) => loans.rows.find((l) => l.id === id);

  const stage = (l: Loan & { id: string }) => followUp({ nextDue: l.nextDue, hardshipPending: hardshipLoanIds.has(l.id) }, today());
  const followRows = [...live].sort((a, b) => (a.nextDue ?? "").localeCompare(b.nextDue ?? ""));

  async function rule(id: string, approve: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      await decide({ id, approve });
      setMsg({ error: false, text: approve ? "Approved. The schedule has been updated." : "Declined." });
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function doneTask(id: string) {
    const note = window.prompt("What happened? (for example: called the family, they will pay on the 30th)");
    if (!note) return;
    setBusy(true);
    setMsg(null);
    try {
      await finishFollowUp({ id, note });
      setMsg({ error: false, text: "Recorded." });
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function sendNow() {
    setBusy(true);
    setMsg(null);
    try {
      const r = (await runReminders({})).data;
      setMsg({ error: false, text: `Checked ${r.checked} loans. ${r.reminders} reminders sent, ${r.tasks} people to reach out to.` });
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const exportFollowUp = () =>
    downloadText(
      "ks1j-loan-follow-up.csv",
      toCsv(
        ["Student", "Payer", "Next due", "EMI (INR)", "Left (INR)", "Stage", "Guarantor", "Guarantor phone"],
        followRows.map((l) => [l.studentName, l.borrowerName, l.nextDue, l.emi, l.principal - (l.repaid ?? 0), FOLLOWUP_LABELS[stage(l)], l.guarantorName, l.guarantorPhone]),
      ),
    );

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Education loans" intro="LOAN: money provided with an agreed repayment plan, never to be mixed up with a donation. Qard-e-Hasana: no interest, no late fees. No payout until the plan is agreed." />
      {msg && <div className="mb-3"><Banner kind={msg.error ? "error" : "info"}>{msg.text}</Banner></div>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><p className="text-sm text-muted">Lent in total</p><p className="num text-2xl">{formatRupees(lent)}</p></Card>
        <Card><p className="text-sm text-muted">Still to be repaid</p><p className="num text-2xl">{formatRupees(toRepay)}</p></Card>
        <Card><p className="text-sm text-muted">Applications to check</p><p className="num text-2xl">{review.length}</p></Card>
        <Card><p className="text-sm text-muted">Plans to agree</p><p className="num text-2xl">{agree.length + agreed.length}</p></Card>
      </div>

      <h2 className="mb-1 font-display text-2xl">Applications and plans</h2>
      <p className="mb-3 text-muted">Open one to see the background check, the documents and the plan.</p>
      <div className="mb-8">
        <Table<Loan>
          rows={[...review, ...agree, ...agreed]}
          error={loans.error}
          empty="Nothing is waiting."
          cols={[
            { head: "Student", cell: (r) => (<span><span className="font-semibold">{r.studentName ?? "Student"}</span>{r.orphan && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs">Orphan</span>}<span className="block text-sm text-muted">{r.course}</span></span>) },
            { head: "Payer", cell: (r) => r.borrowerName ?? "" },
            { head: "Amount", cell: (r) => formatRupees(r.principal) },
            { head: "Status", cell: (r) => LOAN_STATUS_LABELS[r.status] ?? r.status },
            { head: "", cell: (r) => (<Link className="font-semibold text-brand underline" href={`/admin/loans/detail?id=${r.id}`}>Open</Link>) },
          ]}
        />
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl">Follow-up list</h2>
        <Button className="!min-h-10 !px-4" onClick={exportFollowUp} disabled={followRows.length === 0}>Download for Excel</Button>
      </div>
      <p className="mb-3 text-muted">
        Reminders are sent to the borrower in the app every morning at 9 (India time): three days before, on the day, and then on days 1, 7 and 14 late. From 15 days late a person is asked to reach out. They pause while a hardship request waits for a decision. Never a penalty.{" "}
        <button className="underline" disabled={busy} onClick={sendNow}>Run the reminders now</button>
      </p>
      {openTasks.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 font-semibold">People to reach out to</h3>
          <Table<FollowUpTask>
            rows={openTasks}
            empty="Nobody."
            cols={[
              { head: "Loan", cell: (r) => r.loanRef ?? "" },
              { head: "Due", cell: (r) => nice(r.dueDate) },
              { head: "Days late", cell: (r) => r.daysLate },
              { head: "Instalment", cell: (r) => formatRupees(r.emi) },
              { head: "Left", cell: (r) => formatRupees(r.left) },
              { head: "Guarantor", cell: (r) => (<span>{r.guarantorName}<span className="block text-xs text-muted">{r.guarantorPhone}</span></span>) },
              { head: "", cell: (r) => <Button className="!min-h-9 !px-3" disabled={busy} onClick={() => doneTask(r.id)}>I reached out</Button> },
            ]}
          />
        </div>
      )}
      <div className="mb-8">
        <Table<Loan>
          rows={followRows}
          error={loans.error}
          empty="No loans are being repaid yet."
          cols={[
            { head: "Student", cell: (r) => r.studentName ?? "" },
            { head: "Payer", cell: (r) => r.borrowerName ?? "" },
            { head: "Next due", cell: (r) => nice(r.nextDue) },
            { head: "EMI", cell: (r) => formatRupees(r.emi ?? 0) },
            { head: "Left", cell: (r) => formatRupees(r.principal - (r.repaid ?? 0)) },
            { head: "Stage", cell: (r) => FOLLOWUP_LABELS[stage(r)] },
            { head: "Guarantor", cell: (r) => (<span>{r.guarantorName}<span className="block text-xs text-muted">{r.guarantorPhone}</span></span>) },
            { head: "", cell: (r) => (r.status === "agreed" ? null : <Link className="underline" href={`/admin/loans/detail?id=${r.id}`}>Open</Link>) },
          ]}
        />
      </div>

      <h2 className="mb-1 font-display text-2xl">Hardship requests</h2>
      <p className="mb-3 text-muted">Reminders stop while a request is pending. Check the income proof before deciding.</p>
      <div className="space-y-3">
        {pendingHardships.length === 0 && <Banner>No requests.</Banner>}
        {pendingHardships.map((h) => {
          const l = loanOf(h.loanId);
          return (
            <Card key={h.id} className="space-y-2">
              <h3 className="text-lg">
                {l?.borrowerName ?? "Family"}: {h.type === "pause" ? `pause for ${h.months} month${(h.months ?? 0) > 1 ? "s" : ""}` : `pay ${formatRupees(h.newEmi ?? 0)} a month instead`}
              </h3>
              <p className="text-muted">{h.reason}</p>
              {h.proofDataUrl && (
                <button className="underline" onClick={() => setZoom(h.proofDataUrl!)}>View income proof</button>
              )}
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => rule(h.id, true)}>Approve</Button>
                <Button className="!bg-card !text-fg border border-line" disabled={busy} onClick={() => rule(h.id, false)}>Decline</Button>
              </div>
            </Card>
          );
        })}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4" onClick={() => setZoom(null)} role="dialog">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Income proof" className="max-h-[85vh] max-w-full rounded-lg bg-white object-contain" />
          <button className="rounded-lg bg-white px-4 py-2 font-semibold text-black" onClick={() => setZoom(null)}>Close</button>
        </div>
      )}
    </>
  );
}

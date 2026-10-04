"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useState } from "react";
import { Banner, Button, Card } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Flag {
  id: string;
  kind: string;
  severity: "high" | "medium";
  summary: string;
  caseId?: string;
  otherCaseId?: string;
  caseRef?: string | null;
  otherCaseRef?: string | null;
  memberId?: string;
  donationId?: string;
  otherDonationId?: string;
  disbursementId?: string;
  otherDisbursementId?: string;
  decision: { status: "clear" | "confirmed"; note: string | null; by: string } | null;
}

const KIND_LABELS: Record<string, string> = {
  duplicate_beneficiary: "Possible duplicate beneficiary",
  similar_request: "Near-identical request",
  duplicate_donation: "Possible double donation",
  reused_payment_id: "One payment on several donations",
  duplicate_disbursement: "Possible duplicate payout",
  reused_reference: "Reused transfer reference",
  reused_proof: "Reused proof document",
  conflict_of_interest: "Conflict of interest",
};

const fns = getFunctions(auth.app, "asia-south1");
const runChecks = httpsCallable<unknown, { flags: Flag[]; checkedAt: string }>(fns, "runFraudChecks");
const decide = httpsCallable(fns, "decideFraudFlag");

function Row({ f, name, onDone }: { f: Flag; name: (id?: string) => string; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go(status: "clear" | "confirmed") {
    setBusy(true);
    setErr(null);
    try {
      await decide({ id: f.id, kind: f.kind, status, note });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {KIND_LABELS[f.kind] ?? f.kind}
        <span className={`rounded-full border px-2 py-0.5 text-xs ${f.severity === "high" ? "border-red-400 text-red-600" : "border-line text-muted"}`}>{f.severity}</span>
      </p>
      <p className="text-sm">{f.summary}</p>
      <p className="text-sm">
        {f.caseId && <Link className="mr-3 underline" href={`/admin/cases/detail?id=${f.caseId}`}>{f.caseRef ?? "Case"}</Link>}
        {f.otherCaseId && <Link className="mr-3 underline" href={`/admin/cases/detail?id=${f.otherCaseId}`}>{f.otherCaseRef ?? "Other case"}</Link>}
        {f.memberId && <span className="text-muted">Member: {name(f.memberId)}</span>}
      </p>
      {f.decision ? (
        <p className="text-sm text-muted">
          Reviewed by {name(f.decision.by)}: {f.decision.status === "clear" ? "not a problem" : "confirmed"}. {f.decision.note}
        </p>
      ) : (
        <div className="space-y-2">
          <textarea className="min-h-16 w-full rounded-xl border border-line bg-bg p-3" placeholder="How did you check it?" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button className="!min-h-10 !bg-card !px-4 !text-[var(--fg)] border border-line" disabled={busy || note.trim().length < 5} onClick={() => go("clear")}>Not a problem: clear</Button>
            <Button className="!min-h-10 !px-4" disabled={busy || note.trim().length < 5} onClick={() => go("confirmed")}>Confirm</Button>
          </div>
          {err && <Banner kind="error">{err}</Banner>}
        </div>
      )}
    </Card>
  );
}

/** Checks the committee runs on demand: duplicates of every kind, reused receipts, and conflicts of interest. */
export function FurtherChecks() {
  const members = useCollection<{ fullName: string }>("members");
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [at, setAt] = useState("");
  const [showReviewed, setShowReviewed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = (id?: string) => members.rows.find((m) => m.id === id)?.fullName ?? "A committee member";

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const r = (await runChecks({})).data;
      setFlags(r.flags);
      setAt(r.checkedAt);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const shown = (flags ?? []).filter((f) => showReviewed || !f.decision).sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Further checks</h2>
      <p className="mb-3 mt-1 max-w-2xl text-muted">
        Duplicate beneficiaries and requests, possible double donations and payouts, reused receipts and proofs, and committee members acting on their own or their household&apos;s case. A finding is a question, not a verdict. Nothing is blocked or changed by running it.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={go} disabled={busy}>{busy ? "Checking…" : "Run checks"}</Button>
        {flags && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} /> Show reviewed too</label>}
        {at && <span className="text-sm text-muted">Checked just now ({flags?.length ?? 0} findings in total)</span>}
      </div>
      {err && <Banner kind="error">{err}</Banner>}
      {flags && shown.length === 0 && <Banner>Nothing needs checking.</Banner>}
      <div className="space-y-3">
        {shown.map((f) => (
          <Row key={f.id} f={f} name={name} onDone={go} />
        ))}
      </div>
    </section>
  );
}

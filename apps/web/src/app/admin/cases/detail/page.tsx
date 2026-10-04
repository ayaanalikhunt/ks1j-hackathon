"use client";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  CASE_STATUS_LABELS,
  CATEGORY_LABELS,
  DECLINE_LABELS,
  DECLINE_REASONS,
  MIN_DECLINE_NOTE,
  canApprove,
  formatRupees,
  isAdminLike,
  isStaff,
  type DeclineReason,
} from "@ks1j/shared";
import { Banner, Button, Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Case {
  applicantId: string;
  applicantName?: string;
  category: string;
  description?: string;
  amountRequested?: number;
  status: string;
  beneficiarySadaatVerified?: boolean;
  verifiedBy?: string;
  approvedBy?: string;
  declinedBy?: string;
  declineReason?: DeclineReason;
  declineNote?: string;
  disbursedBy?: string;
}

const GHOST = "!bg-card !text-fg border border-line";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function Review() {
  const id = useSearchParams().get("id") ?? "";
  const { user, member } = useAuth();
  const uid = user?.uid ?? "";
  const role = member?.role;
  const [c, setC] = useState<Case | null | undefined>(undefined);
  const [cardExists, setCardExists] = useState(false);
  // null until the reviewer edits it; the default is derived from the case, never stored from an effect.
  const [editedText, setEditedText] = useState<string | null>(null);
  const [reason, setReason] = useState<DeclineReason>("insufficient_proof");
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const members = useCollection<{ fullName: string }>("members");
  const docs = useCollection<{ name?: string; kind?: string }>(id ? `cases/${id}/documents` : "cases/none/documents");
  const [gifts, setGifts] = useState<{ amount: number; status: string }[]>([]);

  const nameOf = (u?: string) => (u ? (members.rows.find((m) => m.id === u)?.fullName ?? "A staff member") : "");

  useEffect(() => {
    if (!id) return;
    const offs = [
      onSnapshot(doc(db, "cases", id), (s) => setC(s.exists() ? (s.data() as Case) : null), () => setC(null)),
      onSnapshot(doc(db, "publicCases", `pub-${id}`), (s) => setCardExists(s.exists()), () => {}),
      onSnapshot(
        query(collection(db, "donations"), where("caseId", "==", id)),
        (s) => setGifts(s.docs.map((d) => d.data() as { amount: number; status: string })),
        () => {},
      ),
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

  const ref = doc(db, "cases", id);
  const accept = () => act(() => updateDoc(ref, { status: "verified", verifiedBy: uid, verifiedAt: serverTimestamp() }), "Accepted. It now waits for approval by a different person.");
  const approve = () => act(() => updateDoc(ref, { status: "approved", approvedBy: uid, approvedAt: serverTimestamp() }), "Approved. It is ready for payout.");
  const payout = () => act(() => updateDoc(ref, { status: "disbursed", disbursedBy: uid, disbursedAt: serverTimestamp() }), "Marked as paid out.");
  const toggleSadaat = () => act(() => updateDoc(ref, { beneficiarySadaatVerified: !c?.beneficiarySadaatVerified }), "Sadaat status updated.");
  const cancel = () =>
    act(async () => {
      await updateDoc(ref, { status: "declined", declinedBy: uid, declinedAt: serverTimestamp(), declineReason: reason, declineNote: note.trim() });
      // A cancelled case must not stay on the public list.
      if (isAdminLike(role) && cardExists) await deleteDoc(doc(db, "publicCases", `pub-${id}`));
      setConfirmCancel(false);
    }, "Case cancelled and the reason recorded.");
  const publish = () =>
    act(
      () => setDoc(doc(db, "publicCases", `pub-${id}`), { caseId: id, category: c!.category, description: publicText.trim(), amountNeeded: c!.amountRequested ?? 0, amountRaised: 0 }),
      "Published. The public card contains no names or contact details.",
    );

  if (c === undefined) return <p>Loading…</p>;
  if (c === null) return <Banner>Case not found, or you do not have access.</Banner>;
  if (!member || !isStaff(member.role)) return <Banner kind="error">Only committee staff can review cases.</Banner>;

  const publicText = editedText ?? `${CATEGORY_LABELS[c.category] ?? c.category}: ${c.description ?? ""}`.slice(0, 280);
  const open = ["submitted", "verified", "approved"].includes(c.status);
  const iVerified = c.verifiedBy === uid;
  const canVerify = (role === "verifier" || isAdminLike(role)) && c.status === "submitted";
  const canApproveNow = (role === "trustee" || isAdminLike(role)) && c.status === "verified";
  const paid = gifts.filter((g) => g.status === "paid").reduce((s, g) => s + g.amount, 0);
  const pending = gifts.filter((g) => g.status === "pending").reduce((s, g) => s + g.amount, 0);

  return (
    <>
      <Link href="/admin/cases" className="mb-3 inline-block text-sm underline">← All cases</Link>
      <PageHeader eyebrow={`Case · ${CATEGORY_LABELS[c.category] ?? c.category}`} title={CASE_STATUS_LABELS[c.status] ?? c.status} />
      {msg && <div className="mb-3"><Banner kind={msg.error ? "error" : "info"}>{msg.text}</Banner></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 font-display text-xl font-bold">The need</h2>
            <p className="whitespace-pre-wrap">{c.description || "No description given."}</p>
            <div className="mt-3">
              <Row k="Amount requested" v={formatRupees(c.amountRequested ?? 0)} />
              <Row k="Sadaat beneficiary" v={c.beneficiarySadaatVerified ? "Verified" : "Not verified"} />
            </div>
          </Card>
          <Card>
            <h2 className="mb-2 font-display text-xl font-bold">Applicant (private)</h2>
            <Row k="Name" v={c.applicantName && c.applicantName !== "(private)" ? c.applicantName : nameOf(c.applicantId) || "Unknown"} />
            <Row k="Member ID" v={<code className="text-xs">{c.applicantId}</code>} />
            <p className="mt-2 text-sm text-muted">Never shown publicly. Only staff and the applicant can see this.</p>
          </Card>
          <Card>
            <h2 className="mb-2 font-display text-xl font-bold">Proof and sources</h2>
            {docs.rows.length === 0 ? (
              <Banner kind="error">No proof documents are attached. If the need cannot be confirmed, cancel the case below.</Banner>
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {docs.rows.map((d) => (
                  <li key={d.id}>{d.name ?? d.kind ?? d.id}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 font-display text-xl font-bold">Review trail</h2>
            <Row k="Verified by" v={c.verifiedBy ? nameOf(c.verifiedBy) : "Not yet"} />
            <Row k="Approved by" v={c.approvedBy ? nameOf(c.approvedBy) : "Not yet"} />
            {c.disbursedBy && <Row k="Paid out by" v={nameOf(c.disbursedBy)} />}
            {c.status === "declined" && (
              <>
                <Row k="Cancelled by" v={nameOf(c.declinedBy)} />
                <Row k="Reason" v={c.declineReason ? DECLINE_LABELS[c.declineReason] : ""} />
                <Row k="Note" v={c.declineNote} />
              </>
            )}
            <p className="mt-2 text-sm text-muted">The person who verifies a case can never be the one who approves it.</p>
          </Card>

          <Card>
            <h2 className="mb-2 font-display text-xl font-bold">Money for this case</h2>
            <Row k="Received" v={formatRupees(paid)} />
            <Row k="Pledged, not yet confirmed" v={formatRupees(pending)} />
            <Row k="On the public list" v={cardExists ? "Yes" : "No"} />
          </Card>

          {open && (
            <Card>
              <h2 className="mb-3 font-display text-xl font-bold">What would you like to do?</h2>
              <div className="flex flex-wrap gap-2">
                {canVerify && <Button disabled={busy} onClick={accept}>Accept and move forward</Button>}
                {canApproveNow && (
                  <Button disabled={busy || !canApprove(c.verifiedBy, uid)} onClick={approve}>
                    Approve and move forward
                  </Button>
                )}
                {c.status === "approved" && isAdminLike(role) && (
                  <Button disabled={busy} onClick={payout}>Mark money handed over</Button>
                )}
                <Button className={GHOST} disabled={busy} onClick={toggleSadaat}>
                  {c.beneficiarySadaatVerified ? "Remove Sadaat status" : "Confirm Sadaat beneficiary"}
                </Button>
              </div>
              {canApproveNow && iVerified && <p className="mt-2 text-sm text-muted">You verified this case, so a different person must approve it.</p>}
              {c.status === "submitted" && !canVerify && <p className="mt-2 text-sm text-muted">Waiting for a verifier or an admin to accept it.</p>}
              {c.status === "verified" && !canApproveNow && <p className="mt-2 text-sm text-muted">Waiting for a trustee or an admin to approve it.</p>}

              {c.status === "approved" && isAdminLike(role) && (
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  <h3 className="font-semibold">{cardExists ? "Public card" : "Show to donors"}</h3>
                  <textarea
                    className="min-h-20 w-full rounded-xl border border-line bg-bg p-3"
                    maxLength={280}
                    value={publicText}
                    onChange={(e) => setEditedText(e.target.value)}
                  />
                  <p className="text-sm text-muted">Remove any names, places or phone numbers before publishing.</p>
                  <Button className={GHOST} disabled={busy || !publicText.trim()} onClick={publish}>
                    {cardExists ? "Update public card" : "Publish public card"}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {open && (
            <Card>
              <h2 className="mb-2 font-display text-xl font-bold">Cancel this case</h2>
              <p className="mb-3 text-sm text-muted">Use this when information, sources or proof are missing. The reason is recorded and the applicant keeps the history.</p>
              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium">Reason</span>
                <select className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" value={reason} onChange={(e) => setReason(e.target.value as DeclineReason)}>
                  {DECLINE_REASONS.map((r) => (
                    <option key={r} value={r}>{DECLINE_LABELS[r]}</option>
                  ))}
                </select>
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium">What is missing? (required)</span>
                <textarea className="min-h-20 w-full rounded-xl border border-line bg-bg p-3" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              {!confirmCancel ? (
                <Button className={GHOST} disabled={busy || note.trim().length < MIN_DECLINE_NOTE} onClick={() => setConfirmCancel(true)}>
                  Cancel case
                </Button>
              ) : (
                <div className="space-y-2">
                  <Banner kind="error">This removes the case from the queue and from the public list. Continue?</Banner>
                  <div className="flex gap-2">
                    <Button disabled={busy} onClick={cancel}>Yes, cancel it</Button>
                    <Button className={GHOST} onClick={() => setConfirmCancel(false)}>Keep it</Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
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

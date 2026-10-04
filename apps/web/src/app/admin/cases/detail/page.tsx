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
  DOC_LABELS,
  MIN_DECLINE_NOTE,
  REQUIRED_DOCS,
  canApprove,
  formatRupees,
  isAdminLike,
  isStaff,
  type DeclineReason,
  type DocKind,
} from "@ks1j/shared";
import { Banner, Button, Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Case {
  applicantId: string;
  applicantName?: string;
  applicantPhone?: string;
  applicantAddress?: string;
  applicantCity?: string;
  category: string;
  requirement?: string;
  description?: string;
  amountRequested?: number;
  familyMembers?: number;
  earningMembers?: number;
  monthlyIncome?: number;
  familyHistory?: string;
  idLast4?: string;
  status: string;
  beneficiarySadaatVerified?: boolean;
  verifiedBy?: string;
  approvedBy?: string;
  declinedBy?: string;
  declineReason?: DeclineReason;
  declineNote?: string;
  disbursedBy?: string;
}

interface ProofDoc {
  kind: DocKind;
  name?: string;
  dataUrl: string;
}

const GHOST = "!bg-card !text-fg border border-line";

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
    <h2 className="mb-2 font-display text-xl font-bold">{title}</h2>
    {children}
  </Card>
);

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
  const [denying, setDenying] = useState(false);
  const [zoom, setZoom] = useState<ProofDoc | null>(null);
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const members = useCollection<{ fullName: string }>("members");
  const docs = useCollection<ProofDoc>(id ? `cases/${id}/documents` : "cases/none/documents");
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
  const verify = () => act(() => updateDoc(ref, { status: "verified", verifiedBy: uid, verifiedAt: serverTimestamp() }), "Given. It is verified and now waits for approval by a different person.");
  const approve = () => act(() => updateDoc(ref, { status: "approved", approvedBy: uid, approvedAt: serverTimestamp() }), "Given. It is approved and ready for payout.");
  const payout = () => act(() => updateDoc(ref, { status: "disbursed", disbursedBy: uid, disbursedAt: serverTimestamp() }), "Money handed over. The case is closed.");
  const toggleSadaat = () => act(() => updateDoc(ref, { beneficiarySadaatVerified: !c?.beneficiarySadaatVerified }), "Sadaat status updated.");
  const deny = () =>
    act(async () => {
      await updateDoc(ref, { status: "declined", declinedBy: uid, declinedAt: serverTimestamp(), declineReason: reason, declineNote: note.trim() });
      // A denied case must not stay on the public list.
      if (isAdminLike(role) && cardExists) await deleteDoc(doc(db, "publicCases", `pub-${id}`));
      setDenying(false);
    }, "Case denied. The reason is recorded and the applicant can see it.");
  const publish = () =>
    act(
      () => setDoc(doc(db, "publicCases", `pub-${id}`), { caseId: id, category: c!.category, description: publicText.trim(), amountNeeded: c!.amountRequested ?? 0, amountRaised: 0 }),
      "Published. The public card contains no names or contact details.",
    );

  if (c === undefined) return <p>Loading…</p>;
  if (c === null) return <Banner>Case not found, or you do not have access.</Banner>;
  if (!member || !isStaff(member.role)) return <Banner kind="error">Only committee staff can review cases.</Banner>;

  const need = c.requirement ?? c.description ?? "";
  const publicText = editedText ?? `${CATEGORY_LABELS[c.category] ?? c.category}: ${need}`.slice(0, 280);
  const open = ["submitted", "verified", "approved"].includes(c.status);
  const iVerified = c.verifiedBy === uid;
  const canVerify = (role === "verifier" || isAdminLike(role)) && c.status === "submitted";
  const canApproveNow = (role === "trustee" || isAdminLike(role)) && c.status === "verified";
  const canPayout = c.status === "approved" && isAdminLike(role);
  const paid = gifts.filter((g) => g.status === "paid").reduce((s, g) => s + g.amount, 0);
  const pending = gifts.filter((g) => g.status === "pending").reduce((s, g) => s + g.amount, 0);
  const have = new Set(docs.rows.map((d) => d.kind));
  const missing = REQUIRED_DOCS.filter((k) => !have.has(k));
  const perHead = c.familyMembers && c.monthlyIncome != null ? Math.round(c.monthlyIncome / c.familyMembers) : null;

  const next = canVerify ? "Verify it and send it to approval" : canApproveNow ? "Approve it for payout" : canPayout ? "Hand over the money" : null;
  const giveNow = canVerify ? verify : canApproveNow ? approve : canPayout ? payout : null;

  return (
    <>
      <Link href="/admin/cases" className="mb-3 inline-block text-sm underline">← All cases</Link>
      <PageHeader eyebrow={`Case · ${CATEGORY_LABELS[c.category] ?? c.category}`} title={CASE_STATUS_LABELS[c.status] ?? c.status} />
      {msg && <div className="mb-3"><Banner kind={msg.error ? "error" : "info"}>{msg.text}</Banner></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Section title="The requirement">
            <p className="whitespace-pre-wrap">{need || "Nothing was written."}</p>
            <div className="mt-3">
              <Row k="Amount requested" v={formatRupees(c.amountRequested ?? 0)} />
              <Row k="Sadaat beneficiary" v={c.beneficiarySadaatVerified ? "Verified" : "Not verified"} />
            </div>
          </Section>

          <Section title="About the applicant (private)">
            <Row k="Name" v={c.applicantName && c.applicantName !== "(private)" ? c.applicantName : nameOf(c.applicantId) || "Not given"} />
            <Row k="Phone" v={c.applicantPhone || "Not given"} />
            <Row k="Address" v={<span className="whitespace-pre-wrap">{c.applicantAddress || "Not given"}</span>} />
            <Row k="City" v={c.applicantCity || "Not given"} />
            <Row k="Aadhaar (last 4)" v={c.idLast4 || "Not given"} />
            <Row k="Member ID" v={<code className="text-xs">{c.applicantId}</code>} />
            <p className="mt-2 text-sm text-muted">Never shown publicly. Only staff and the applicant can see this.</p>
          </Section>

          <Section title="Family">
            <Row k="People in the household" v={c.familyMembers ?? "Not given"} />
            <Row k="People who earn" v={c.earningMembers ?? "Not given"} />
            <Row k="Monthly household income" v={c.monthlyIncome != null ? formatRupees(c.monthlyIncome) : "Not given"} />
            {perHead != null && <Row k="Income per person" v={formatRupees(perHead)} />}
            <h3 className="mt-3 font-semibold">Family background</h3>
            <p className="whitespace-pre-wrap text-muted">{c.familyHistory || "Nothing was written."}</p>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Verification documents">
            {missing.length > 0 && (
              <div className="mb-3">
                <Banner kind="error">Missing: {missing.map((k) => DOC_LABELS[k]).join(", ")}. If the person cannot be confirmed, deny the case.</Banner>
              </div>
            )}
            {docs.rows.length === 0 ? (
              <p className="text-muted">No documents were attached.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {docs.rows.map((d) => (
                  <button key={d.id} onClick={() => setZoom(d)} className="text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.dataUrl} alt={DOC_LABELS[d.kind] ?? d.kind} className="h-36 w-full rounded-lg border border-line bg-bg object-contain" />
                    <span className="mt-1 block text-sm font-medium">{DOC_LABELS[d.kind] ?? d.kind}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-sm text-muted">Tap a document to enlarge it. Compare the name and address with what the applicant wrote.</p>
          </Section>

          {open && (
            <Card>
              <h2 className="mb-3 font-display text-xl font-bold">Your decision</h2>
              <div className="flex flex-wrap gap-3">
                <Button disabled={busy || !giveNow || (canApproveNow && !canApprove(c.verifiedBy, uid))} onClick={() => giveNow?.()}>
                  Give this case
                </Button>
                <Button className={GHOST} disabled={busy} onClick={() => setDenying((v) => !v)}>
                  Deny this case
                </Button>
              </div>
              {next ? (
                <p className="mt-2 text-sm text-muted">Giving it will: {next.toLowerCase()}.</p>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  {c.status === "submitted" ? "Waiting for a verifier or an admin." : c.status === "verified" ? "Waiting for a trustee or an admin." : "Waiting for an admin."}
                </p>
              )}
              {canApproveNow && iVerified && <p className="mt-1 text-sm text-muted">You verified this case, so a different person must approve it.</p>}
              <div className="mt-3">
                <Button className={GHOST} disabled={busy} onClick={toggleSadaat}>
                  {c.beneficiarySadaatVerified ? "Remove Sadaat status" : "Confirm Sadaat beneficiary"}
                </Button>
              </div>

              {denying && (
                <div className="mt-4 space-y-3 border-t border-line pt-4">
                  <h3 className="font-semibold">Why are you denying it?</h3>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Reason</span>
                    <select className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" value={reason} onChange={(e) => setReason(e.target.value as DeclineReason)}>
                      {DECLINE_REASONS.map((r) => (
                        <option key={r} value={r}>{DECLINE_LABELS[r]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">What is missing or wrong? (the applicant will see this)</span>
                    <textarea className="min-h-20 w-full rounded-xl border border-line bg-bg p-3" value={note} onChange={(e) => setNote(e.target.value)} />
                  </label>
                  <Banner kind="error">This removes the case from the queue and from the public list.</Banner>
                  <Button disabled={busy || note.trim().length < MIN_DECLINE_NOTE} onClick={deny}>
                    Confirm: deny this case
                  </Button>
                </div>
              )}

              {c.status === "approved" && isAdminLike(role) && (
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  <h3 className="font-semibold">{cardExists ? "Public card" : "Show to donors"}</h3>
                  <textarea className="min-h-20 w-full rounded-xl border border-line bg-bg p-3" maxLength={280} value={publicText} onChange={(e) => setEditedText(e.target.value)} />
                  <p className="text-sm text-muted">Remove any names, places or phone numbers before publishing.</p>
                  <Button className={GHOST} disabled={busy || !publicText.trim()} onClick={publish}>
                    {cardExists ? "Update public card" : "Publish public card"}
                  </Button>
                </div>
              )}
            </Card>
          )}

          <Section title="Review trail">
            <Row k="Verified by" v={c.verifiedBy ? nameOf(c.verifiedBy) : "Not yet"} />
            <Row k="Approved by" v={c.approvedBy ? nameOf(c.approvedBy) : "Not yet"} />
            {c.disbursedBy && <Row k="Money handed over by" v={nameOf(c.disbursedBy)} />}
            {c.status === "declined" && (
              <>
                <Row k="Denied by" v={nameOf(c.declinedBy)} />
                <Row k="Reason" v={c.declineReason ? DECLINE_LABELS[c.declineReason] : ""} />
                <Row k="Note" v={c.declineNote} />
              </>
            )}
            <p className="mt-2 text-sm text-muted">The person who verifies a case can never be the one who approves it.</p>
          </Section>

          <Section title="Money for this case">
            <Row k="Received" v={formatRupees(paid)} />
            <Row k="Pledged, not yet confirmed" v={formatRupees(pending)} />
            <Row k="On the public list" v={cardExists ? "Yes" : "No"} />
          </Section>
        </div>
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4" onClick={() => setZoom(null)} role="dialog" aria-label={DOC_LABELS[zoom.kind]}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.dataUrl} alt={DOC_LABELS[zoom.kind] ?? zoom.kind} className="max-h-[85vh] max-w-full rounded-lg bg-white object-contain" />
          <button className="rounded-lg bg-white px-4 py-2 font-semibold text-black" onClick={() => setZoom(null)}>
            Close
          </button>
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

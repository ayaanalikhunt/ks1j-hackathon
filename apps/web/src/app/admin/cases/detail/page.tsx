"use client";

import {
  addDoc,
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
import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  CATEGORY_LABELS,
  DECLINE_LABELS,
  DECLINE_REASONS,
  DOC_KINDS,
  DOC_LABELS,
  FLAG_LABELS,
  MIN_DECLINE_NOTE,
  STAFF_EVENT_TEXT,
  canApprove,
  formatDateTime,
  formatRupees,
  isAdminLike,
  isStaff,
  requiredDocs,
  type CaseType,
  type DeclineReason,
  type DocKind,
  type EventKind,
} from "@ks1j/shared";
import {
  ID_PROOF_LABELS,
  NEED_CATEGORIES,
  NO_ID_REASON_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  VERIFICATION_LABELS,
  VERIFICATION_METHODS,
  casePublicId,
  identityCleared,
  type IdProofType,
  type NoIdReason,
  type Priority,
  type VerificationMethod,
} from "@ks1j/shared";
import { Banner, Button, Card, PageHeader } from "@/components/ui";
import { Tracker } from "@/components/Tracker";
import { useAuth } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";
import { decideFlag, useFlags } from "@/lib/flags";
import { compressImage } from "@/lib/image";
import { useCollection } from "@/lib/useCollection";

interface Case {
  applicantId: string;
  applicantName?: string;
  applicantPhone?: string;
  applicantAddress?: string;
  applicantCity?: string;
  number?: number;
  title?: string;
  type?: CaseType;
  category: string;
  requirement?: string;
  description?: string;
  amountRequested?: number;
  raised?: number;
  sadaatClaimed?: boolean;
  familyMembers?: number;
  earningMembers?: number;
  monthlyIncome?: number;
  familyHistory?: string;
  idLast4?: string;
  status: string;
  beneficiarySadaatVerified?: boolean;
  verifiedBy?: string;
  approvedBy?: string;
  publishedBy?: string;
  declinedBy?: string;
  declineReason?: DeclineReason;
  declineNote?: string;
  disbursedBy?: string;
  publicCaseId?: string;
  idProofType?: IdProofType;
  noIdReason?: NoIdReason;
  verificationMethod?: VerificationMethod;
  verificationNotes?: string;
  verificationStatus?: string;
  emergencyClaimed?: boolean;
  emergencyException?: { reason: string; approvedBy: string; at?: { toDate(): Date } | null };
  priority?: Priority;
  needCategory?: string;
  zakatEligible?: boolean;
  khumsEligible?: boolean;
}

interface ProofDoc {
  kind: DocKind;
  name?: string;
  dataUrl: string;
  addedBy?: string;
}

interface CaseEventRow {
  kind: EventKind;
  actorId: string;
  note?: string | null;
  at?: { toDate(): Date } | null;
}

const GHOST = "!bg-card !text-fg border border-line";
const payOutCase = httpsCallable(getFunctions(auth.app, "asia-south1"), "payOutCase");

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
  const [c, setC] = useState<Case | null | undefined>(undefined);
  const [cardExists, setCardExists] = useState(false);
  // null until the reviewer edits it; the default is derived from the case, never stored from an effect.
  const [editedText, setEditedText] = useState<string | null>(null);
  const [reason, setReason] = useState<DeclineReason>("insufficient_proof");
  const [note, setNote] = useState("");
  const [denying, setDenying] = useState(false);
  const [sadaatChecked, setSadaatChecked] = useState(false);
  const [addKind, setAddKind] = useState<DocKind>("income_proof");
  const [zoom, setZoom] = useState<ProofDoc | null>(null);
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [altMethod, setAltMethod] = useState<VerificationMethod>("home_visit");
  const [altNotes, setAltNotes] = useState("");
  const [exReason, setExReason] = useState("");

  const members = useCollection<{ fullName: string }>("members");
  const customCats = useCollection<{ label: string }>("caseCategories");
  const docs = useCollection<ProofDoc>(id ? `cases/${id}/documents` : "cases/none/documents");
  const flagState = useFlags();
  const [events, setEvents] = useState<(CaseEventRow & { id: string })[]>([]);
  const [gifts, setGifts] = useState<{ amount: number; status: string }[]>([]);

  const nameOf = (u?: string) => (u === "system" ? "The system" : u ? (members.rows.find((m) => m.id === u)?.fullName ?? "A staff member") : "");

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
      onSnapshot(
        query(collection(db, "caseEvents"), where("caseId", "==", id)),
        (s) =>
          setEvents(
            s.docs
              .map((d) => ({ id: d.id, ...(d.data() as CaseEventRow) }))
              .sort((a, b) => (a.at?.toDate().getTime() ?? Infinity) - (b.at?.toDate().getTime() ?? Infinity)),
          ),
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
  const need = c?.requirement ?? c?.description ?? "";
  const log = (kind: EventKind, text?: string) =>
    addDoc(collection(db, "caseEvents"), {
      caseId: id,
      applicantId: c!.applicantId,
      caseNumber: c!.number ?? null,
      caseTitle: c!.title ?? need.slice(0, 60),
      kind,
      actorId: uid,
      ...(text ? { note: text } : {}),
      at: serverTimestamp(),
    });

  const verify = () =>
    act(async () => {
      await updateDoc(ref, {
        status: "verified",
        verifiedBy: uid,
        verifiedAt: serverTimestamp(),
        // Ticked: the Aadhaar was checked and the family is Sadaat. Unticked: it continues as a non-Sadaat case.
        beneficiarySadaatVerified: sadaatChecked,
        sadaatCheckedBy: uid,
      });
      await log("verified");
    }, "Given. It is verified and now waits for approval by a different person.");
  const approve = () =>
    act(async () => {
      await updateDoc(ref, { status: "approved", approvedBy: uid, approvedAt: serverTimestamp() });
      await log("approved");
    }, "Given. It is approved and can now be published to donors.");
  const publicText = editedText ?? `${CASE_TYPE_LABELS[c?.type as CaseType] ?? CATEGORY_LABELS[c?.category ?? ""] ?? ""}: ${need}`.slice(0, 280);
  const publish = () =>
    act(async () => {
      await setDoc(doc(db, "publicCases", `pub-${id}`), {
        caseId: id,
        category: c!.category,
        type: c!.type ?? "",
        number: c!.number ?? 0,
        title: c!.title ?? "",
        sadaat: c!.beneficiarySadaatVerified === true,
        description: publicText.trim(),
        amountNeeded: c!.amountRequested ?? 0,
        amountRaised: c!.raised ?? 0,
        publicCaseId: casePublicId(c!),
        needCategory: c!.needCategory ?? "other",
        priority: c!.priority ?? "normal",
        emergency: !!c!.emergencyException,
      });
      await updateDoc(ref, { status: "published", publishedBy: uid, publishedAt: serverTimestamp() });
      await log("published");
    }, "Published. Donors can see it now. The public card has no names or contact details.");
  const saveAlt = () =>
    act(async () => {
      await updateDoc(ref, {
        verificationMethod: altMethod,
        verificationNotes: altNotes.trim(),
        verificationBy: uid,
        verificationAt: serverTimestamp(),
        verificationStatus: altMethod === "none_available" ? "pending_review" : "verified",
      });
      await log("verification_recorded", `Alternative verification: ${VERIFICATION_LABELS[altMethod]}`);
    }, "Alternative verification recorded.");
  const grantEmergency = () =>
    act(async () => {
      await updateDoc(ref, { emergencyException: { reason: exReason.trim(), approvedBy: uid, at: serverTimestamp() }, priority: "urgent" });
      await log("emergency_exception", `Emergency exception: ${exReason.trim()}`);
      setExReason("");
    }, "Emergency exception recorded. The two-person approval and every payout control still apply.");
  const setTriage = (patch: { priority?: Priority; needCategory?: string }) => act(() => updateDoc(ref, patch), "Saved.");
  const setEligible = (field: "zakatEligible" | "khumsEligible", v: boolean) => act(() => updateDoc(ref, { [field]: v }), "Saved.");
  const payout = () => act(() => payOutCase({ caseId: id }), "Money handed over. The ledger entry is recorded.");
  const close = () =>
    act(async () => {
      await updateDoc(ref, { status: "closed", closedBy: uid, closedAt: serverTimestamp() });
      await log("closed");
    }, "Case closed.");
  const deny = () =>
    act(async () => {
      await updateDoc(ref, { status: "declined", declinedBy: uid, declinedAt: serverTimestamp(), declineReason: reason, declineNote: note.trim() });
      await log("declined", `${DECLINE_LABELS[reason]}: ${note.trim()}`);
      if (cardExists && (isAdminLike(role) || role === "trustee")) await deleteDoc(doc(db, "publicCases", `pub-${id}`));
      setDenying(false);
    }, "Case denied. The reason is recorded and the applicant can see it.");
  const addOfficeDoc = (file: File | undefined) => {
    if (!file) return;
    return act(async () => {
      const dataUrl = await compressImage(file);
      await addDoc(collection(db, "cases", id, "documents"), { kind: addKind, name: file.name, dataUrl, uploadedAt: serverTimestamp(), addedBy: uid });
      await log("document_added", DOC_LABELS[addKind]);
    }, `${DOC_LABELS[addKind]} added to the file.`);
  };

  if (c === undefined) return <p>Loading…</p>;
  if (c === null) return <Banner>Case not found, or you do not have access.</Banner>;
  if (!member || !isStaff(member.role)) return <Banner kind="error">Only committee staff can review cases.</Banner>;

  const open = ["submitted", "verified", "approved"].includes(c.status);
  const iVerified = c.verifiedBy === uid;
  const adminLike = isAdminLike(role);
  const can = {
    verify: (role === "verifier" || adminLike) && c.status === "submitted",
    approve: (role === "trustee" || adminLike) && c.status === "verified",
    publish: (role === "trustee" || adminLike) && c.status === "approved",
    payout: adminLike && c.status === "funded",
    close: adminLike && c.status === "disbursed",
  };
  const give = can.verify ? verify : can.approve ? approve : can.publish ? publish : can.payout ? payout : can.close ? close : null;
  const giveLabel = can.verify ? "Give this case: verify it" : can.approve ? "Give this case: approve it" : can.publish ? "Give this case: publish it to donors" : can.payout ? "Give this case: hand over the money" : can.close ? "Close this case" : "Give this case";
  const waiting =
    c.status === "submitted" ? "Waiting for a verifier or an admin."
    : c.status === "verified" ? "Waiting for a trustee or an admin, who must be someone other than the verifier."
    : c.status === "approved" ? "Waiting for a trustee or an admin to publish it."
    : c.status === "published" ? "Live for donors. It becomes fully funded when the gifts are confirmed."
    : c.status === "funded" ? "Fully funded. Waiting for an admin to hand over the money."
    : c.status === "disbursed" ? "Paid out. An admin can close it."
    : "";
  const paid = gifts.filter((g) => g.status === "paid").reduce((s, g) => s + g.amount, 0);
  const pending = gifts.filter((g) => g.status === "pending").reduce((s, g) => s + g.amount, 0);
  const have = new Set(docs.rows.map((d) => d.kind));
  const expected = requiredDocs(c.type, c.idProofType);
  const missing = expected.filter((k) => !have.has(k));
  const perHead = c.familyMembers && c.monthlyIncome != null ? Math.round(c.monthlyIncome / c.familyMembers) : null;
  const heading = `${c.number ? `#${c.number} ` : ""}${c.title || CASE_TYPE_LABELS[c.type as CaseType] || CATEGORY_LABELS[c.category] || "Case"}`;
  const myFlags = flagState.flags.filter((f) => f.caseId === id || f.otherId === id);
  const idBlocked = can.approve && !identityCleared(c);
  const approveBlocked = can.approve && (!canApprove(c.verifiedBy, uid) || idBlocked);
  const trusteeLike = role === "trustee" || adminLike;

  return (
    <>
      <Link href="/admin/cases" className="mb-3 inline-block text-sm underline">← All cases</Link>
      <PageHeader eyebrow={`Case · ${CATEGORY_LABELS[c.category] ?? c.category}${c.sadaatClaimed ? " · Sadaat" : ""}`} title={heading} />
      <div className="mb-4"><Tracker status={c.status} /></div>
      {msg && <div className="mb-3"><Banner kind={msg.error ? "error" : "info"}>{msg.text}</Banner></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Section title="The requirement">
            <p className="whitespace-pre-wrap">{need || "Nothing was written."}</p>
            <div className="mt-3">
              <Row k="Type" v={CASE_TYPE_LABELS[c.type as CaseType] ?? "Not given"} />
              <Row k="Amount requested" v={formatRupees(c.amountRequested ?? 0)} />
              <Row k="Raised so far" v={formatRupees(c.raised ?? 0)} />
              <Row k="Sadaat (Syed)" v={c.beneficiarySadaatVerified ? "Aadhaar checked, verified" : c.sadaatClaimed ? "Claimed, not yet checked" : "No"} />
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

          <Section title="Identity and verification">
            <Row k="Case ID" v={<code>{casePublicId(c)}</code>} />
            <Row k="Priority" v={PRIORITY_LABELS[c.priority ?? "normal"]} />
            <Row k="ID proof" v={ID_PROOF_LABELS[c.idProofType ?? "aadhaar"]} />
            {c.idProofType === "none" && <Row k="Reason for no ID" v={c.noIdReason ? NO_ID_REASON_LABELS[c.noIdReason] : "Not given"} />}
            <Row k="Verification" v={c.verificationMethod ? `${VERIFICATION_LABELS[c.verificationMethod]} (${c.verificationStatus ?? "pending_review"})` : c.idProofType === "none" ? "Pending review" : "By documents"} />
            {c.verificationNotes && <Row k="Notes" v={c.verificationNotes} />}
            {c.emergencyClaimed && <Row k="Applicant says" v="This is an emergency" />}
            {c.emergencyException && (
              <Row k="Emergency exception" v={`${c.emergencyException.reason} · approved by ${nameOf(c.emergencyException.approvedBy)}${c.emergencyException.at ? " · " + formatDateTime(c.emergencyException.at.toDate()) : ""}`} />
            )}
            {c.idProofType === "none" && !identityCleared(c) && (
              <div className="mt-2"><Banner>No ID was given. That is not a reason to refuse help: verify the situation another way below. It cannot be approved until you do.</Banner></div>
            )}
            {open && c.idProofType === "none" && (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <h3 className="font-semibold">Alternative verification</h3>
                <select className="min-h-11 w-full rounded-xl border border-line bg-bg px-3" value={altMethod} onChange={(e) => setAltMethod(e.target.value as VerificationMethod)}>
                  {VERIFICATION_METHODS.map((m) => <option key={m} value={m}>{VERIFICATION_LABELS[m]}</option>)}
                </select>
                <textarea className="min-h-20 w-full rounded-xl border border-line bg-bg p-3" placeholder="What was checked, and by whom?" value={altNotes} onChange={(e) => setAltNotes(e.target.value)} />
                <Button disabled={busy || altNotes.trim().length < 5} onClick={saveAlt}>Record verification</Button>
              </div>
            )}
            {open && trusteeLike && !c.emergencyException && (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <h3 className="font-semibold">Emergency exception</h3>
                <p className="text-sm text-muted">Speeds the review of an urgent case. It does not remove two-person approval or any payout control.</p>
                <textarea className="min-h-16 w-full rounded-xl border border-line bg-bg p-3" placeholder="Why is this an emergency?" value={exReason} onChange={(e) => setExReason(e.target.value)} />
                <Button className={GHOST} disabled={busy || exReason.trim().length < 5} onClick={grantEmergency}>Grant emergency exception</Button>
              </div>
            )}
          </Section>

          <Section title="Priority, category and restricted funds">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Priority</span>
                <select className="min-h-11 w-full rounded-xl border border-line bg-bg px-3" value={c.priority ?? "normal"} disabled={busy || !(open || c.status === "published")} onChange={(e) => setTriage({ priority: e.target.value as Priority })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Need category</span>
                <select className="min-h-11 w-full rounded-xl border border-line bg-bg px-3" value={c.needCategory ?? "other"} disabled={busy || !(open || c.status === "published")} onChange={(e) => setTriage({ needCategory: e.target.value })}>
                  {[...Object.entries(NEED_CATEGORIES), ...customCats.rows.map((r) => [`custom_${r.id}`, r.label] as [string, string])].map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
            {trusteeLike && (open || c.status === "published") && (
              <div className="mt-3 space-y-1 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!c.zakatEligible} disabled={busy} onChange={(e) => setEligible("zakatEligible", e.target.checked)} /> Eligible to receive Zakat</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!c.khumsEligible} disabled={busy} onChange={(e) => setEligible("khumsEligible", e.target.checked)} /> Eligible to receive Khums</label>
                <p className="text-muted">Zakat and Khums donations are only ever allocated to cases marked eligible here.</p>
              </div>
            )}
          </Section>

          <Section title="Family">
            <Row k="People in the household" v={c.familyMembers ?? "Not given"} />
            <Row k="People who earn" v={c.earningMembers ?? "Not given"} />
            <Row k="Monthly household income" v={c.monthlyIncome != null ? formatRupees(c.monthlyIncome) : "Not given"} />
            {perHead != null && <Row k="Income per person" v={formatRupees(perHead)} />}
            <h3 className="mt-3 font-semibold">Family background</h3>
            <p className="whitespace-pre-wrap text-muted">{c.familyHistory || "Nothing was written."}</p>
          </Section>

          <Section title="History">
            {events.length === 0 ? (
              <p className="text-muted">Nothing yet.</p>
            ) : (
              <ol className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="border-l-2 border-brand pl-3 text-sm">
                    <span className="font-semibold">{STAFF_EVENT_TEXT[e.kind] ?? e.kind}</span>
                    <span className="text-muted"> · {nameOf(e.actorId)} · {e.at ? formatDateTime(e.at.toDate()) : "just now"}</span>
                    {e.note && <p className="text-muted">{e.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Documents">
            {missing.length > 0 && (
              <div className="mb-3">
                <Banner kind="error">Not yet provided: {missing.map((k) => DOC_LABELS[k].toLowerCase()).join(", ")}.</Banner>
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
                    {d.addedBy && <span className="block text-xs text-muted">Added at the office by {nameOf(d.addedBy)}</span>}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-sm text-muted">Tap a document to enlarge it. Compare the name and address with what the applicant wrote.</p>
            {open && (
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                <h3 className="font-semibold">Add a document brought to the office</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="min-h-11 rounded-xl border border-line bg-bg px-3" value={addKind} onChange={(e) => setAddKind(e.target.value as DocKind)}>
                    {DOC_KINDS.map((k) => (
                      <option key={k} value={k}>{DOC_LABELS[k]}</option>
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

          <Section title="Fraud flags">
            <p className="mb-2 text-sm text-muted">Flags are hints. A verifier decides.</p>
            {myFlags.length === 0 ? (
              <p className="text-muted">No flags on this case.</p>
            ) : (
              <div className="space-y-3">
                {myFlags.map((f) => {
                  const d = flagState.decided.get(f.id);
                  const other = flagState.cases.find((x) => x.id === (f.caseId === id ? f.otherId : f.caseId));
                  return (
                    <div key={f.id} className="rounded-xl border border-line p-3 text-sm">
                      <p className="font-semibold">{FLAG_LABELS[f.kind]}</p>
                      <p>
                        Matches <Link className="underline" href={`/admin/cases/detail?id=${other?.id ?? ""}`}>{other?.number ? `#${other.number} ` : ""}{other?.title ?? "another case"}</Link>
                      </p>
                      {d ? (
                        <p className="text-muted">{d.status === "clear" ? "Reviewed: not a problem." : "Reviewed: confirmed duplicate."}</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button className={`${GHOST} !min-h-9 !px-3`} onClick={() => decideFlag(f, "clear", uid).catch((e) => setMsg({ error: true, text: e.message }))}>Not a problem: clear</Button>
                          <Button className="!min-h-9 !px-3" onClick={() => decideFlag(f, "confirmed", uid).catch((e) => setMsg({ error: true, text: e.message }))}>Confirm duplicate</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {(open || c.status === "published" || c.status === "funded" || c.status === "disbursed") && (
            <Card>
              <h2 className="mb-3 font-display text-xl">Your decision</h2>

              {can.verify && (
                <label className="mb-3 flex items-start gap-2 rounded-xl border border-line p-3 text-sm">
                  <input type="checkbox" className="mt-1" checked={sadaatChecked} onChange={(e) => setSadaatChecked(e.target.checked)} />
                  <span>
                    I have checked the Aadhaar card: this family is Sadaat (Syed).
                    {c.sadaatClaimed && !sadaatChecked && <span className="block text-muted">Left unticked, the case continues as non-Sadaat.</span>}
                  </span>
                </label>
              )}

              <div className="flex flex-wrap gap-3">
                <Button disabled={busy || !give || approveBlocked} onClick={() => give?.()}>
                  {giveLabel}
                </Button>
                {open && (
                  <Button className={GHOST} disabled={busy} onClick={() => setDenying((v) => !v)}>
                    Deny this case
                  </Button>
                )}
              </div>
              {waiting && <p className="mt-2 text-sm text-muted">{waiting}</p>}
              {idBlocked && <p className="mt-1 text-sm text-muted">This case has no ID proof. Record another way of verifying it, or an emergency exception, before approving.</p>}
              {approveBlocked && iVerified && <p className="mt-1 text-sm text-muted">You verified this case, so a different person must approve it.</p>}
              {missing.length > 0 && c.status === "submitted" && <p className="mt-1 text-sm text-muted">Some documents are missing. Check them before you verify.</p>}

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
                  <Banner kind="error">This removes the case from the queue. It cannot be undone.</Banner>
                  <Button disabled={busy || note.trim().length < MIN_DECLINE_NOTE} onClick={deny}>
                    Confirm: deny this case
                  </Button>
                </div>
              )}

              {(c.status === "approved" || c.status === "published") && (can.publish || cardExists) && (
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  <h3 className="font-semibold">What donors will read</h3>
                  <textarea className="min-h-20 w-full rounded-xl border border-line bg-bg p-3" maxLength={280} value={publicText} onChange={(e) => setEditedText(e.target.value)} disabled={c.status === "published"} />
                  <p className="text-sm text-muted">Remove any names, places or phone numbers before publishing. Donors never see the applicant.</p>
                </div>
              )}
            </Card>
          )}

          <Section title="Sign-offs">
            <Row k="Verified by" v={c.verifiedBy ? nameOf(c.verifiedBy) : "Not yet"} />
            <Row k="Approved by" v={c.approvedBy ? nameOf(c.approvedBy) : "Not yet"} />
            <Row k="Published by" v={c.publishedBy ? nameOf(c.publishedBy) : "Not yet"} />
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
            <Row k="Confirmed gifts" v={formatRupees(paid)} />
            <Row k="Pledged, not yet confirmed" v={formatRupees(pending)} />
            <Row k="Status" v={CASE_STATUS_LABELS[c.status] ?? c.status} />
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

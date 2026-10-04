"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CASE_STATUS_LABELS, CASE_TYPE_LABELS, NEED_CATEGORIES, PRIORITY_LABELS, formatDate, formatRupees, type CaseType, type Priority } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Card, PageHeader } from "@/components/ui";
import { auth } from "@/lib/firebase";

interface PublicCase {
  reference: string;
  needCategory: string | null;
  type: string | null;
  priority: Priority;
  emergency: boolean;
  status: string;
  requested: number;
  approved: number;
  raised: number;
  disbursed: number;
  fundingPercent: number;
  disbursementPercent: number;
  disbursementNote: string | null;
  timeline: { kind: string; label: string; at: string }[];
}

const getCase = httpsCallable<{ ref: string }, PublicCase>(getFunctions(auth.app, "asia-south1"), "getPublicCase");

function Bar({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <p className="flex justify-between text-sm"><span className="text-muted">{label}</span><span className="num font-semibold">{value}</span></p>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Timeline() {
  const ref = useSearchParams().get("ref") ?? "";
  const [c, setC] = useState<PublicCase | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getCase({ ref })
      .then((r) => live && setC(r.data))
      .catch(() => live && setC(null));
    return () => {
      live = false;
    };
  }, [ref]);

  if (c === undefined) return <p className="text-muted">Loading…</p>;
  if (c === null) return <Banner>No public case with that reference.</Banner>;
  const category = (c.needCategory && NEED_CATEGORIES[c.needCategory]) || CASE_TYPE_LABELS[c.type as CaseType] || "Assistance";
  return (
    <>
      <Link href="/transparency" className="mb-3 inline-block text-sm font-semibold underline">← Transparency</Link>
      <PageHeader eyebrow={c.reference} title={`${category} assistance`} intro={`Status: ${CASE_STATUS_LABELS[c.status] ?? c.status}`} />
      <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full border border-line px-3 py-1">Donation: money given without repayment</span>
        {c.emergency && <span className="rounded-full border border-red-400 px-3 py-1 text-red-600">Emergency</span>}
        {c.priority !== "normal" && <span className="rounded-full border border-line px-3 py-1">Priority: {PRIORITY_LABELS[c.priority]}</span>}
      </div>

      <Card className="mb-4 space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <p><span className="block text-muted">Requested</span><span className="num font-semibold">{formatRupees(c.requested)}</span></p>
          <p><span className="block text-muted">Approved</span><span className="num font-semibold">{formatRupees(c.approved)}</span></p>
          <p><span className="block text-muted">Raised</span><span className="num font-semibold">{formatRupees(c.raised)}</span></p>
          <p><span className="block text-muted">Disbursed</span><span className="num font-semibold">{formatRupees(c.disbursed)}</span></p>
        </div>
        <Bar label="Funding" value={`${c.fundingPercent}%`} pct={c.fundingPercent} />
        <Bar label="Disbursement" value={`${c.disbursementPercent}%`} pct={c.disbursementPercent} />
        {c.disbursementNote && <p className="text-sm text-muted">{c.disbursementNote}</p>}
      </Card>

      <Card>
        <h2 className="font-display text-xl">Timeline</h2>
        <ol className="mt-3 space-y-4">
          {c.timeline.map((e) => (
            <li key={e.kind} className="flex gap-3">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-brand" />
              <div>
                <p className="num text-sm text-muted">{formatDate(new Date(e.at))}</p>
                <p className="font-semibold">{e.label}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted">
          Every step above is taken from the committee&apos;s own records. The family&apos;s name, address, documents and medical or personal details are never published.
        </p>
      </Card>
    </>
  );
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Timeline />
        </Suspense>
      </main>
    </>
  );
}

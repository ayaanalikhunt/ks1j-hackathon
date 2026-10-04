"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FINANCIAL_TYPES, formatDate, formatRupees } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Card, PageHeader } from "@/components/ui";
import { auth } from "@/lib/firebase";

interface PublicLoan {
  reference: string;
  purpose: string;
  statusLabel: string;
  approved: number;
  disbursed: number;
  repaid: number;
  outstanding: number;
  repaidPercent: number;
  timeline: { label: string; at: string }[];
}

const getLoan = httpsCallable<{ ref: string }, PublicLoan>(getFunctions(auth.app, "asia-south1"), "getPublicLoan");

function Loan() {
  const ref = useSearchParams().get("ref") ?? "";
  const [l, setL] = useState<PublicLoan | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getLoan({ ref })
      .then((r) => live && setL(r.data))
      .catch(() => live && setL(null));
    return () => {
      live = false;
    };
  }, [ref]);

  if (l === undefined) return <p className="text-muted">Loading…</p>;
  if (l === null) return <Banner>No public loan with that reference.</Banner>;
  return (
    <>
      <Link href="/transparency" className="mb-3 inline-block text-sm font-semibold underline">← Transparency</Link>
      <PageHeader eyebrow={l.reference} title={`${l.purpose} loan`} intro={`Status: ${l.statusLabel}`} />
      <div className="mb-3">
        <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold">{FINANCIAL_TYPES.loan.label}: {FINANCIAL_TYPES.loan.note}</span>
      </div>
      <Card className="mb-4 space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <p><span className="block text-muted">Approved</span><span className="num font-semibold">{formatRupees(l.approved)}</span></p>
          <p><span className="block text-muted">Disbursed</span><span className="num font-semibold">{formatRupees(l.disbursed)}</span></p>
          <p><span className="block text-muted">Repaid</span><span className="num font-semibold">{formatRupees(l.repaid)}</span></p>
          <p><span className="block text-muted">Still to repay</span><span className="num font-semibold">{formatRupees(l.outstanding)}</span></p>
        </div>
        <div>
          <p className="flex justify-between text-sm"><span className="text-muted">Repaid</span><span className="num font-semibold">{l.repaidPercent}%</span></p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${l.repaidPercent}%` }} /></div>
        </div>
      </Card>
      <Card>
        <h2 className="font-display text-xl">Timeline</h2>
        <ol className="mt-3 space-y-4">
          {l.timeline.map((e) => (
            <li key={e.label} className="flex gap-3">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-brand" />
              <div>
                <p className="num text-sm text-muted">{formatDate(new Date(e.at))}</p>
                <p className="font-semibold">{e.label}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted">
          This is a loan to be repaid, not a gift. It carries no interest and no late fee. The borrower, the student and their school are never named.
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
          <Loan />
        </Suspense>
      </main>
    </>
  );
}

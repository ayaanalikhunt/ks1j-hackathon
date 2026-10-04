"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CASE_STATUS_LABELS, CASE_TYPE_LABELS, NEED_CATEGORIES, formatRupees, type CaseType } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Card, PageHeader } from "@/components/ui";
import { auth, db } from "@/lib/firebase";

interface RecentCase {
  reference: string;
  needCategory: string | null;
  type: string | null;
  emergency: boolean;
  status: string;
  requested: number;
  raised: number;
  disbursed: number;
}
const listCases = httpsCallable<unknown, { cases: RecentCase[] }>(getFunctions(auth.app, "asia-south1"), "listPublicCases");

interface Totals {
  totalDonated: number;
  totalAllocated: number;
  totalDisbursed: number;
  donationCount: number;
  casesAssisted: number;
  casesCompleted: number;
  casesFunding: number;
  casesUnderReview: number;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="num text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </Card>
  );
}

export default function Transparency() {
  const [t, setT] = useState<Totals | null | undefined>(undefined);
  useEffect(() => onSnapshot(doc(db, "publicStats", "transparency"), (d) => setT((d.data() as Totals) ?? null), () => setT(null)), []);
  const [recent, setRecent] = useState<RecentCase[] | null>(null);
  useEffect(() => {
    listCases({}).then((r) => setRecent(r.data.cases)).catch(() => setRecent([]));
  }, []);
  const unallocated = t ? t.totalDonated - t.totalAllocated : 0;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <PageHeader
          eyebrow="Open books"
          title="Donation transparency"
          intro="Every figure here is added up from verified payments, committee allocations and recorded payouts. No donor or family is named."
        />
        {t === undefined && <p className="text-muted">Loading…</p>}
        {t === null && <Banner>No verified donations have been recorded yet.</Banner>}
        {t && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Total verified donations" value={formatRupees(t.totalDonated)} />
              <Stat label="Allocated to cases" value={formatRupees(t.totalAllocated)} />
              <Stat label="Paid out" value={formatRupees(t.totalDisbursed)} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Waiting to be allocated" value={formatRupees(unallocated)} />
              <Stat label="Families and individuals assisted" value={t.casesAssisted} />
              <Stat label="Cases completed" value={t.casesCompleted} />
              <Stat label="Cases open for funding" value={t.casesFunding} />
            </div>
            <p className="mt-6 text-sm text-muted">
              {t.casesUnderReview} cases are being reviewed. {t.donationCount} verified donations so far. Donors choose whether their name is shown; beneficiary details are never published.
            </p>
          </>
        )}
        <h2 className="mb-3 mt-10 font-display text-2xl">Recent cases</h2>
        {recent === null && <p className="text-muted">Loading…</p>}
        {recent && recent.length === 0 && <Banner>No verified cases are currently available.</Banner>}
        <div className="grid gap-3 sm:grid-cols-2">
          {(recent ?? []).map((c) => (
            <Link key={c.reference} href={`/cases/timeline?ref=${c.reference}`}>
              <Card className="h-full">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{c.reference}{c.emergency ? " · Emergency" : ""}</p>
                <h3 className="mt-1 text-lg">{(c.needCategory && NEED_CATEGORIES[c.needCategory]) || CASE_TYPE_LABELS[c.type as CaseType] || "Assistance"}</h3>
                <p className="num mt-1">{formatRupees(c.raised)} <span className="font-normal text-muted">of {formatRupees(c.requested)} raised</span></p>
                <p className="text-sm text-muted">{formatRupees(c.disbursed)} paid out · {CASE_STATUS_LABELS[c.status] ?? c.status}</p>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

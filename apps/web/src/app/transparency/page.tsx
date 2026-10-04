"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { formatRupees } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase";

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
      </main>
    </>
  );
}

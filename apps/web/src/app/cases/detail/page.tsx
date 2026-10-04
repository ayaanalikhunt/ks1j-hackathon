"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  CASE_TYPE_LABELS,
  CATEGORY_LABELS,
  FINANCIAL_TYPES,
  NEED_CATEGORIES,
  PRIORITY_LABELS,
  casePublicId,
  formatRupees,
  type CaseType,
  type Priority,
} from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase";

interface PublicCase {
  caseId: string;
  publicCaseId?: string;
  category: string;
  needCategory?: string;
  priority?: Priority;
  emergency?: boolean;
  type?: CaseType;
  number?: number;
  title?: string;
  sadaat?: boolean;
  description: string;
  amountNeeded: number;
  amountRaised: number;
}

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const [c, setC] = useState<PublicCase | null | undefined>(undefined);
  useEffect(
    () => (id ? onSnapshot(doc(db, "publicCases", id), (d) => setC(d.exists() ? (d.data() as PublicCase) : null)) : undefined),
    [id],
  );

  if (c === undefined) return <p>Loading…</p>;
  if (c === null) return <Banner>Case not found.</Banner>;
  const pct = Math.min(100, c.amountNeeded ? (c.amountRaised / c.amountNeeded) * 100 : 0);
  return (
    <>
      <Link href="/cases" className="mb-3 inline-block text-sm font-semibold underline">
        ← All cases
      </Link>
      <PageHeader
        eyebrow={`${casePublicId(c)} · ${NEED_CATEGORIES[c.needCategory ?? ""] ?? CASE_TYPE_LABELS[c.type as CaseType] ?? CATEGORY_LABELS[c.category] ?? c.category}${c.sadaat ? " · Sadaat" : ""}`}
        title={`${c.number ? `#${c.number} ` : ""}${c.title || "Help for a family"}`}
        intro={c.description}
      />
      <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full border border-line px-3 py-1">{FINANCIAL_TYPES.donation.label}: {FINANCIAL_TYPES.donation.note}</span>
        {c.emergency && <span className="rounded-full border border-red-400 px-3 py-1 text-red-600">Emergency</span>}
        {c.priority && c.priority !== "normal" && <span className="rounded-full border border-line px-3 py-1">Priority: {PRIORITY_LABELS[c.priority]}</span>}
      </div>
      <Card className="mb-4 space-y-3">
        <div className="h-3 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={c.amountNeeded} aria-valuenow={c.amountRaised}>
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="tabular-nums">
          <strong>{formatRupees(c.amountRaised)}</strong> raised of {formatRupees(c.amountNeeded)} ({Math.round(pct)}%)
        </p>
        <p className="text-muted">
          Verified and approved by two different Jamaat committee members. The Jamaat pays the hospital, school or family directly and keeps proof.
        </p>
        <p className="text-muted">
          To protect the family&apos;s dignity, their name and contact details are hidden. The Jamaat knows who they are and has checked the need.
        </p>
      </Card>
      <LinkButton href={`/donate?caseId=${c.caseId}`}>Give to this case</LinkButton>
    </>
  );
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Suspense fallback={<p>Loading…</p>}>
          <Detail />
        </Suspense>
      </main>
    </>
  );
}

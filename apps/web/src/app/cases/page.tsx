"use client";

import Link from "next/link";
import { useState } from "react";
import { CASE_TYPE_LABELS, CATEGORY_LABELS, formatRupees, type CaseType } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Card, PageHeader } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";

interface PublicCase {
  category: string;
  type?: CaseType;
  number?: number;
  title?: string;
  sadaat?: boolean;
  description: string;
  amountNeeded: number;
  amountRaised: number;
}

const FILTERS = [
  ["all", "All cases"],
  ["sadaat", "Sadaat cases"],
  ["other", "Non-Sadaat cases"],
] as const;

export default function Cases() {
  const { rows, loading, error } = useCollection<PublicCase>("publicCases");
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const shown = rows.filter((c) => filter === "all" || (filter === "sadaat" ? c.sadaat : !c.sadaat));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <PageHeader eyebrow="Community" title="Open cases" intro="Verified needs, approved by two Jamaat admins. Names and contact details are never shown." />
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`min-h-10 rounded-full border px-4 text-sm ${filter === key ? "border-brand bg-brand/15 font-semibold" : "border-line bg-card"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <Banner kind="error">{error}</Banner>}
        {!loading && shown.length === 0 && <Banner>No open cases right now.</Banner>}
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((c) => (
            <Link key={c.id} href={`/cases/detail?id=${c.id}`}>
              <Card className="h-full">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                  {CASE_TYPE_LABELS[c.type as CaseType] ?? CATEGORY_LABELS[c.category] ?? c.category}
                  {c.sadaat ? " · Sadaat" : ""}
                </p>
                <h3 className="mt-1 text-lg">{c.number ? `#${c.number} ` : ""}{c.title || "Help for a family"}</h3>
                <p className="mt-1 text-muted">{c.description}</p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, c.amountNeeded ? (c.amountRaised / c.amountNeeded) * 100 : 0)}%` }} />
                </div>
                <p className="num mt-2 text-sm">
                  {formatRupees(c.amountRaised)} <span className="font-normal text-muted">of {formatRupees(c.amountNeeded)}</span>
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

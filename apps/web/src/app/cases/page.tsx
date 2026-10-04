"use client";

import Link from "next/link";
import { formatRupees } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Card, PageHeader } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";

interface PublicCase {
  category: string;
  description: string;
  amountNeeded: number;
  amountRaised: number;
}

export default function Cases() {
  const { rows, loading, error } = useCollection<PublicCase>("publicCases");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <PageHeader eyebrow="Community" title="Open cases" intro="Names and contact details are never shown publicly." />
        {error && <Banner kind="error">{error}</Banner>}
        {!loading && rows.length === 0 && <Banner>No open cases right now.</Banner>}
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <Link key={c.id} href={`/cases/detail?id=${c.id}`}>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{c.category}</p>
                <p className="mt-1">{c.description}</p>
                <p className="mt-3 text-sm text-muted tabular-nums">
                  {formatRupees(c.amountRaised)} of {formatRupees(c.amountNeeded)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

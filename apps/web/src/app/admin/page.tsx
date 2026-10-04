"use client";

import { Card, PageHeader } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";

function Count({ label, path }: { label: string; path: string }) {
  const { rows } = useCollection(path);
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-3xl font-bold tabular-nums">{rows.length}</p>
    </Card>
  );
}

export default function Overview() {
  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Count label="Cases" path="cases" />
        <Count label="Loans" path="loans" />
        <Count label="Donations" path="donations" />
        <Count label="Members" path="members" />
        <Count label="Institutions" path="institutions" />
        <Count label="Open reports" path="communityReports" />
      </div>
    </>
  );
}

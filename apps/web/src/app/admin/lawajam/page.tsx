"use client";

import { formatRupees } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { PageHeader } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";

interface Lawajam {
  memberId: string;
  household?: string;
  amount: number;
  period?: string;
  status?: string;
}

export default function AdminLawajam() {
  const { rows, error } = useCollection<Lawajam>("lawajamRecords");
  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Lawajam" />
      <Table<Lawajam>
        rows={rows}
        error={error}
        cols={[
          { head: "Household", cell: (r) => r.household ?? r.memberId },
          { head: "Period", cell: (r) => r.period ?? "" },
          { head: "Amount", cell: (r) => formatRupees(r.amount) },
          { head: "Status", cell: (r) => r.status ?? "due" },
        ]}
      />
    </>
  );
}

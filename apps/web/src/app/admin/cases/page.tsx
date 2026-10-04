"use client";

import Link from "next/link";
import { useState } from "react";
import { CASE_STATUS_LABELS, CATEGORY_LABELS, formatRupees } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { PageHeader } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";

interface Case {
  category: string;
  status: string;
  description?: string;
  amountRequested?: number;
}

const FILTERS = [
  ["all", "All"],
  ["submitted", "To verify"],
  ["verified", "To approve"],
  ["approved", "To pay out"],
  ["disbursed", "Paid out"],
  ["declined", "Cancelled"],
] as const;

export default function AdminCases() {
  const { rows, error } = useCollection<Case>("cases");
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const shown = rows.filter((r) => filter === "all" || r.status === filter);
  return (
    <>
      <PageHeader
        eyebrow="Committee dashboard"
        title="Cases"
        intro="Open a case to see the details, then accept it, approve it, hand over the money or cancel it. A different person must approve than verified."
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => {
          const n = key === "all" ? rows.length : rows.filter((r) => r.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`min-h-10 rounded-full border px-4 text-sm ${filter === key ? "border-brand bg-brand/15 font-semibold" : "border-line bg-card"}`}
            >
              {label} ({n})
            </button>
          );
        })}
      </div>
      <Table<Case>
        rows={shown}
        error={error}
        empty="No cases in this view."
        cols={[
          { head: "Category", cell: (r) => CATEGORY_LABELS[r.category] ?? r.category },
          { head: "Need", cell: (r) => <span className="line-clamp-2">{r.description ?? ""}</span> },
          { head: "Requested", cell: (r) => formatRupees(r.amountRequested ?? 0) },
          { head: "Status", cell: (r) => CASE_STATUS_LABELS[r.status] ?? r.status },
          {
            head: "",
            cell: (r) => (
              <Link className="font-semibold text-brand underline" href={`/admin/cases/detail?id=${r.id}`}>
                Review
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}

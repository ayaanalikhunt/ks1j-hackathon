"use client";

import Link from "next/link";
import { useState } from "react";
import { CASE_STATUS_LABELS, CASE_TYPE_LABELS, QUEUES, formatRupees, type CaseType } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { PageHeader } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";

interface Case {
  number?: number;
  title?: string;
  type?: CaseType;
  category: string;
  sadaatClaimed?: boolean;
  beneficiarySadaatVerified?: boolean;
  status: string;
  description?: string;
  requirement?: string;
  amountRequested?: number;
  raised?: number;
}

// Same queues as the dashboard overview, in the order a case travels.
const FILTERS = [["all", "All"], ...QUEUES.map(([key, label]) => [key, label] as const)] as const;

export default function AdminCases() {
  const { rows, error } = useCollection<Case>("cases");
  const [filter, setFilter] = useState<string>("all");
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
          { head: "Case", cell: (r) => (<span className="font-semibold">{r.number ? `#${r.number} ` : ""}{r.title || r.requirement || r.description || "Case"}</span>) },
          { head: "Type", cell: (r) => CASE_TYPE_LABELS[r.type as CaseType] ?? "" },
          { head: "Category", cell: (r) => (r.beneficiarySadaatVerified ? "Sadaat" : r.sadaatClaimed ? "Sadaat (to check)" : "Non-Sadaat") },
          { head: "Requested", cell: (r) => formatRupees(r.amountRequested ?? 0) },
          { head: "Raised", cell: (r) => formatRupees(r.raised ?? 0) },
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

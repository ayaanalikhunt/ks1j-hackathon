"use client";

import { KHUMS_DISCLAIMER, formatRupees } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, PageHeader } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";

interface Khums {
  memberId: string;
  surplus: number;
  due: number;
}

export default function AdminKhums() {
  const { rows, error } = useCollection<Khums>("khumsCalculations");
  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Khums" />
      <div className="mb-3"><Banner>{KHUMS_DISCLAIMER}</Banner></div>
      <Table<Khums>
        rows={rows}
        error={error}
        cols={[
          { head: "Member", cell: (r) => r.memberId },
          { head: "Surplus", cell: (r) => formatRupees(r.surplus) },
          { head: "Khums due", cell: (r) => formatRupees(r.due) },
        ]}
      />
    </>
  );
}

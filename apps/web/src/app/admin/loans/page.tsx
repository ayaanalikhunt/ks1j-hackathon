"use client";

import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { emiSchedule, formatRupees } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Loan {
  principal: number;
  months?: number;
  status: string;
  familyAccepted?: boolean;
  trusteeAccepted?: boolean;
  nextDue?: string;
}

// Zero interest, zero late fees. Follow-up is human and non-judgmental.
export default function AdminLoans() {
  const { rows, error } = useCollection<Loan>("loans");
  const [msg, setMsg] = useState<string | null>(null);
  const act = (id: string, patch: Record<string, unknown>) =>
    updateDoc(doc(db, "loans", id), patch).catch((e) => setMsg((e as Error).message));
  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Loans" intro="No interest. No late fees. Ever." />
      {msg && <Banner kind="error">{msg}</Banner>}
      <Table<Loan>
        rows={rows}
        error={error}
        cols={[
          { head: "Principal", cell: (r) => formatRupees(r.principal) },
          { head: "EMI", cell: (r) => (r.months ? `${formatRupees(emiSchedule(r.principal, r.months)[0])} × ${r.months}` : "Not set") },
          { head: "Status", cell: (r) => r.status },
          { head: "Agreed", cell: (r) => `${r.familyAccepted ? "Family ✓" : "Family …"} ${r.trusteeAccepted ? "Trustee ✓" : "Trustee …"}` },
          {
            head: "Action",
            cell: (r) => (
              <div className="flex gap-2">
                {r.status === "applied" && (
                  <Button
                    className="!min-h-9 !px-3"
                    onClick={() => act(r.id, { months: r.months ?? 12, status: "emi_pending_agreement", trusteeAccepted: true, familyAccepted: false })}
                  >
                    Propose EMI
                  </Button>
                )}
                {r.status === "emi_pending_agreement" && r.familyAccepted && (
                  <Button className="!min-h-9 !px-3" onClick={() => act(r.id, { status: "agreed" })}>
                    Confirm agreement
                  </Button>
                )}
                {r.status === "agreed" && (
                  <Button className="!min-h-9 !px-3" onClick={() => act(r.id, { status: "disbursed" })}>
                    Disburse
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

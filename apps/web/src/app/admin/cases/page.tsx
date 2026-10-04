"use client";

import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { canApprove, formatRupees, isAdminLike } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Case {
  category: string;
  status: string;
  description?: string;
  amountRequested?: number;
  verifiedBy?: string;
  approvedBy?: string;
}

export default function AdminCases() {
  const { user, member } = useAuth();
  const { rows, error } = useCollection<Case>("cases");
  const [msg, setMsg] = useState<string | null>(null);
  const uid = user?.uid ?? "";

  async function act(id: string, patch: Record<string, unknown>) {
    setMsg(null);
    try {
      await updateDoc(doc(db, "cases", id), patch);
    } catch (e) {
      setMsg("Not allowed: " + (e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Committee dashboard"
        title="Cases"
        intro="A verifier verifies. A different trustee approves. The database enforces this."
      />
      {msg && <Banner kind="error">{msg}</Banner>}
      <Table<Case>
        rows={rows}
        error={error}
        cols={[
          { head: "Category", cell: (r) => r.category },
          { head: "Description", cell: (r) => r.description ?? "" },
          { head: "Requested", cell: (r) => formatRupees(r.amountRequested ?? 0) },
          { head: "Status", cell: (r) => r.status },
          {
            head: "Action",
            cell: (r) => (
              <div className="flex gap-2">
                {member?.role === "verifier" && r.status === "submitted" && (
                  <Button className="!min-h-9 !px-3" onClick={() => act(r.id, { status: "verified", verifiedBy: uid })}>
                    Verify
                  </Button>
                )}
                {member?.role === "trustee" && r.status === "verified" && (
                  <>
                    <Button
                      className="!min-h-9 !px-3"
                      disabled={!canApprove(r.verifiedBy, uid)}
                      title={canApprove(r.verifiedBy, uid) ? "" : "A different person must approve"}
                      onClick={() => act(r.id, { status: "approved", approvedBy: uid })}
                    >
                      Approve
                    </Button>
                    <Button
                      className="!min-h-9 !bg-card !px-3 !text-fg border border-line"
                      onClick={() => act(r.id, { status: "declined", approvedBy: uid })}
                    >
                      Decline
                    </Button>
                  </>
                )}
                {isAdminLike(member?.role) && r.status === "approved" && (
                  <Button className="!min-h-9 !px-3" onClick={() => act(r.id, { status: "disbursed" })}>
                    Mark disbursed
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

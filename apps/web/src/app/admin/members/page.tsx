"use client";

import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { ROLES, type Role } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface M {
  fullName: string;
  role: Role;
  sadaatVerified: boolean;
}

export default function AdminMembers() {
  const { member } = useAuth();
  const { rows, error } = useCollection<M>("members");
  const [msg, setMsg] = useState<string | null>(null);
  const isAdmin = member?.role === "admin";
  const set = (id: string, patch: Partial<M>) => updateDoc(doc(db, "members", id), patch).catch((e) => setMsg((e as Error).message));
  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Members" intro="Only an admin can change roles or verify Sadaat status." />
      {msg && <Banner kind="error">{msg}</Banner>}
      <Table<M>
        rows={rows}
        error={error}
        cols={[
          { head: "Name", cell: (r) => r.fullName },
          {
            head: "Role",
            cell: (r) =>
              isAdmin ? (
                <select className="rounded-lg border border-line bg-bg p-1" value={r.role} onChange={(e) => set(r.id, { role: e.target.value as Role })}>
                  {ROLES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              ) : (
                r.role
              ),
          },
          {
            head: "Sadaat verified",
            cell: (r) =>
              isAdmin ? (
                <input type="checkbox" checked={r.sadaatVerified} onChange={(e) => set(r.id, { sadaatVerified: e.target.checked })} />
              ) : r.sadaatVerified ? (
                "Yes"
              ) : (
                "No"
              ),
          },
        ]}
      />
    </>
  );
}

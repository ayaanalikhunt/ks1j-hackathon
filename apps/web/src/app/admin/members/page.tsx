"use client";

import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { ROLES, canAssignRole, isAdminLike, type Role } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface M {
  householdId?: string;
  fullName: string;
  role: Role;
  sadaatVerified: boolean;
}

const label = (r: string) => r.replace("_", " ");

export default function AdminMembers() {
  const { user, member } = useAuth();
  const { rows, error } = useCollection<M>("members");
  const households = useCollection<{ name: string; area: string }>("households");
  const [msg, setMsg] = useState<string | null>(null);
  const isAdmin = isAdminLike(member?.role);
  const set = (id: string, patch: Partial<M>) => updateDoc(doc(db, "members", id), patch).catch((e) => setMsg((e as Error).message));
  return (
    <>
      <PageHeader
        eyebrow="Committee dashboard"
        title="Members"
        intro="Admins verify Sadaat status. Only the owner and super admins change roles, and only the owner can touch owner or super admin."
      />
      {msg && <Banner kind="error">{msg}</Banner>}
      <Table<M>
        rows={rows}
        error={error}
        cols={[
          { head: "Name", cell: (r) => r.fullName },
          {
            head: "Role",
            cell: (r) => {
              const actor = member?.role;
              const editable = actor && r.id !== user?.uid && canAssignRole(actor, r.role, r.role);
              if (!editable) return <span className="capitalize">{label(r.role)}</span>;
              return (
                <select className="rounded-lg border border-line bg-bg p-1 capitalize" value={r.role} onChange={(e) => set(r.id, { role: e.target.value as Role })}>
                  {ROLES.filter((x) => canAssignRole(actor, r.role, x)).map((x) => (
                    <option key={x} value={x}>{label(x)}</option>
                  ))}
                </select>
              );
            },
          },
          {
            head: "Household",
            cell: (r) => {
              const current = households.rows.find((h) => h.id === r.householdId);
              if (!isAdmin) return current ? `${current.name} (${current.area})` : "Not linked";
              // Linking is how a member gets to see and pay their household's Lawajam.
              return (
                <select className="rounded-lg border border-line bg-bg p-1" value={r.householdId ?? ""} onChange={(e) => set(r.id, { householdId: e.target.value } as Partial<M>)}>
                  <option value="">Not linked</option>
                  {households.rows.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({h.area})</option>
                  ))}
                </select>
              );
            },
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

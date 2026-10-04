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
  membershipVerified?: boolean;
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
  // Linking also keeps each household's list of member names current, so a member can see who is in their household.
  async function link(id: string, newHid: string) {
    setMsg(null);
    try {
      const me = rows.find((x) => x.id === id);
      const oldHid = me?.householdId;
      await updateDoc(doc(db, "members", id), { householdId: newHid });
      const namesOf = (h: string, add?: string) => [...rows.filter((x) => x.householdId === h && x.id !== id).map((x) => x.fullName), ...(add ? [add] : [])];
      if (oldHid) await updateDoc(doc(db, "households", oldHid), { memberNames: namesOf(oldHid) });
      if (newHid) await updateDoc(doc(db, "households", newHid), { memberNames: namesOf(newHid, me?.fullName) });
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
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
                <select className="rounded-lg border border-line bg-bg p-1" value={r.householdId ?? ""} onChange={(e) => link(r.id, e.target.value)}>
                  <option value="">Not linked</option>
                  {households.rows.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({h.area})</option>
                  ))}
                </select>
              );
            },
          },
          {
            head: "Membership verified",
            cell: (r) =>
              isAdmin ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={r.membershipVerified === true} onChange={(e) => set(r.id, { membershipVerified: e.target.checked })} />
                  {r.membershipVerified ? "Verified" : "Waiting"}
                </label>
              ) : r.membershipVerified ? "Verified" : "Waiting",
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

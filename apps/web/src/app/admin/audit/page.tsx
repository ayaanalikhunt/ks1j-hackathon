"use client";

import { collection, limit, orderBy, query } from "firebase/firestore";
import { useState } from "react";
import { formatDateTime, isAdminLike } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { useQueryRows } from "@/lib/useQueryRows";

interface Entry {
  action: string;
  actor: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  newValue?: Record<string, unknown> | null;
  at?: { toDate(): Date } | null;
}

const WORDS: Record<string, string> = {
  DOCUMENT_ACCESSED: "Document opened",
  DOCUMENT_UPLOADED: "Document uploaded",
  PAYMENT_VERIFIED: "Payment verified",
  ALLOCATION_CREATED: "Donation allocated",
  ALLOCATION_REVERSED: "Allocation reversed",
  DISBURSEMENT_CREATED: "Payout queued for approval",
  DISBURSEMENT_COMPLETED: "Payout completed",
  DISBURSEMENT_APPROVED: "Payout approved",
  DISBURSEMENT_REJECTED: "Payout rejected",
  PROOF_VERIFIED: "Proof verified",
  DONATION_REFUNDED: "Donation refunded",
  PAYMENT_SETTINGS_CHANGED: "Payment settings changed",
  CASE_COMPLETED: "Case completed",
  FRAUD_FLAG_DECIDED: "Fraud flag decided",
  DONOR_PROFILE_VIEWED: "Donor details opened",
  DONOR_LIST_VIEWED: "Donor list opened",
};

/** The append-only record of every sensitive action. Admins can read it; nobody can change it. */
export default function AuditLog() {
  const { member } = useAuth();
  const { rows, error } = useQueryRows<Entry>(query(collection(db, "auditLogs"), orderBy("at", "desc"), limit(300)), "audit");
  const members = useCollection<{ fullName: string }>("members");
  const [action, setAction] = useState("");
  const [text, setText] = useState("");

  if (member && !isAdminLike(member.role)) return <Banner kind="error">The audit log is for admins.</Banner>;
  const nameOf = (u: string) => (u === "system" ? "The system" : members.rows.find((m) => m.id === u)?.fullName ?? "A committee member");
  const actions = [...new Set(rows.map((r) => r.action))].sort();
  const shown = rows.filter((r) => (!action || r.action === action) && (!text || `${r.entityId} ${r.entityType} ${nameOf(r.actor)}`.toLowerCase().includes(text.toLowerCase())));

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Audit log" intro="Every payment, allocation, payout, refund, setting change and document view, with who did it and when. Entries cannot be edited or deleted. Showing the latest 300." />
      <div className="mb-4 flex flex-wrap gap-3">
        <button onClick={() => setAction(action === "DOCUMENT_ACCESSED" ? "" : "DOCUMENT_ACCESSED")} className={`min-h-10 rounded-full border px-4 text-sm ${action === "DOCUMENT_ACCESSED" ? "border-brand bg-brand/15 font-semibold" : "border-line bg-card"}`}>
          Document access only
        </button>
        <select className="min-h-10 rounded-xl border border-line bg-bg px-3" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{WORDS[a] ?? a}</option>)}
        </select>
        <input className="min-h-10 rounded-xl border border-line bg-bg px-3" placeholder="Search a person or id" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <Table<Entry>
        rows={shown}
        error={error}
        empty="No entries match."
        cols={[
          { head: "When", cell: (r) => (r.at ? formatDateTime(r.at.toDate()) : "just now") },
          { head: "Who", cell: (r) => nameOf(r.actor) },
          { head: "What", cell: (r) => WORDS[r.action] ?? r.action },
          { head: "On", cell: (r) => <code className="text-xs">{r.entityType} {r.entityId}</code> },
          { head: "Detail", cell: (r) => r.reason ?? (r.newValue ? JSON.stringify(r.newValue) : "") },
        ]}
      />
    </>
  );
}

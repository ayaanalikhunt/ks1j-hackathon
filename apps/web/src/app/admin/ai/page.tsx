"use client";

import { collection, limit, orderBy, query } from "firebase/firestore";
import { formatDateTime, isAdminLike } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useQueryRows } from "@/lib/useQueryRows";

interface Row {
  intent: string;
  outcome: string;
  lang: string;
  scholar?: string;
  confidence?: number;
  routeId?: string;
  errorCode?: string;
  latencyMs?: number;
  cached?: boolean;
  signedIn?: boolean;
  at?: { toDate(): Date } | null;
}

/** How the Ask AI Guide is being used. Questions are never stored here: only the kind of request and how it went. */
export default function AiUsage() {
  const { member } = useAuth();
  const { rows, error } = useQueryRows<Row>(query(collection(db, "aiAuditLog"), orderBy("at", "desc"), limit(200)), "ai");
  if (member && !isAdminLike(member.role)) return <Banner kind="error">This page is for admins.</Banner>;

  const count = (f: (r: Row) => boolean) => rows.filter(f).length;
  const answered = rows.filter((r) => r.outcome === "ANSWERED");
  const avg = answered.length ? Math.round(answered.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / answered.length) : 0;
  const notOn = count((r) => r.errorCode === "ai_not_configured");

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Ask AI Guide usage" intro="The latest 200 requests. The text of a question is never saved, only the kind of request, the language and the outcome." />
      {notOn > 0 && <div className="mb-4"><Banner kind="error">{notOn} fiqh questions could not be answered because the AI key has not been set. Commands such as “open donation” still work.</Banner></div>}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="num text-2xl font-semibold">{rows.length}</p><p className="mt-1 text-sm text-muted">Requests</p></Card>
        <Card><p className="num text-2xl font-semibold">{answered.length}</p><p className="mt-1 text-sm text-muted">Fiqh answers</p></Card>
        <Card><p className="num text-2xl font-semibold">{count((r) => r.outcome === "EXECUTED")}</p><p className="mt-1 text-sm text-muted">Pages opened</p></Card>
        <Card><p className="num text-2xl font-semibold">{avg} ms</p><p className="mt-1 text-sm text-muted">Average answer time</p></Card>
      </div>
      <Table<Row>
        rows={rows}
        error={error}
        empty="No requests yet."
        cols={[
          { head: "When", cell: (r) => (r.at ? formatDateTime(r.at.toDate()) : "") },
          { head: "Kind", cell: (r) => r.intent },
          { head: "Outcome", cell: (r) => r.outcome + (r.cached ? " (cached)" : "") },
          { head: "Language", cell: (r) => r.lang },
          { head: "Marja'", cell: (r) => r.scholar ?? "" },
          { head: "Page", cell: (r) => r.routeId ?? "" },
          { head: "Time", cell: (r) => (r.latencyMs != null ? `${r.latencyMs} ms` : "") },
          { head: "Signed in", cell: (r) => (r.signedIn ? "Yes" : "No") },
        ]}
      />
    </>
  );
}

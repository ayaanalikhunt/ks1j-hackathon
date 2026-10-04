"use client";

import Link from "next/link";
import { isStaff } from "@ks1j/shared";
import { Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/useCollection";

function Stat({ n, label, who, href }: { n: number; label: string; who: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:border-brand">
        <p className="font-display text-3xl font-bold tabular-nums">{n}</p>
        <p className="mt-1 font-semibold">{label}</p>
        <p className="text-sm text-muted">{who}</p>
      </Card>
    </Link>
  );
}

export default function Overview() {
  const { member } = useAuth();
  const cases = useCollection<{ status: string }>("cases");
  const loans = useCollection<{ status: string }>("loans");
  const donations = useCollection<{ status: string }>("donations");
  const reports = useCollection<{ status: string }>("communityReports");
  const by = (rows: { status: string }[], s: string) => rows.filter((r) => r.status === s).length;
  const first = member?.fullName.split(" ")[0] ?? "";
  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title={`Salaam, ${first}`} intro="What is waiting for the committee today. You see what your role allows." />
      {member && isStaff(member.role) && (
        <>
          <h2 className="mb-3 font-display text-2xl font-bold">Cases</h2>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat n={by(cases.rows, "submitted")} label="To verify" who="Verifier or admin" href="/admin/cases" />
            <Stat n={by(cases.rows, "verified")} label="To approve" who="Trustee or admin" href="/admin/cases" />
            <Stat n={by(cases.rows, "approved")} label="To pay out" who="Admin" href="/admin/cases" />
            <Stat n={by(cases.rows, "disbursed")} label="Paid out" who="Done" href="/admin/cases" />
          </div>
          <h2 className="mb-3 font-display text-2xl font-bold">Needs attention</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat n={by(donations.rows, "pending")} label="Gifts to confirm" who="Admin" href="/admin/payments" />
            <Stat n={by(loans.rows, "applied")} label="New loan requests" who="Trustee" href="/admin/loans" />
            <Stat n={by(loans.rows, "emi_pending_agreement")} label="Loans awaiting agreement" who="Family and trustee" href="/admin/loans" />
            <Stat n={by(reports.rows, "open")} label="Open community reports" who="Moderators" href="/admin/community" />
          </div>
        </>
      )}
    </>
  );
}

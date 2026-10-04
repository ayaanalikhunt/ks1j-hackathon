"use client";

import Link from "next/link";
import { FUND_LABELS, FUND_TYPES, QUEUES, formatRupees, isStaff } from "@ks1j/shared";
import { Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useFlags } from "@/lib/flags";
import { useCollection } from "@/lib/useCollection";

function Stat({ n, label, who, href }: { n: number | string; label: string; who: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:border-brand">
        <p className="num text-3xl">{n}</p>
        <p className="mt-1 font-semibold">{label}</p>
        <p className="text-sm text-muted">{who}</p>
      </Card>
    </Link>
  );
}

const RULES = [
  "No case reaches donors until a verifier and a different trustee have both approved it.",
  "Sehme Sadaat goes only to verified Sadaat cases. Sehme Imam goes only to institutions with a verified ijazah.",
  "Every fund has its own ledger. Nothing is edited. Corrections are new reversing entries.",
  "AI only flags and suggests. A person always approves, rejects or pays.",
];

export default function Overview() {
  const { member } = useAuth();
  const cases = useCollection<{ status: string }>("cases");
  const loans = useCollection<{ status: string }>("loans");
  const donations = useCollection<{ status: string }>("donations");
  const reports = useCollection<{ status: string }>("communityReports");
  const people = useCollection<{ membershipVerified?: boolean }>("members");
  const { flags, decided } = useFlags();
  const ledger = useCollection<{ fund: string; direction?: "in" | "out"; amount: number }>("ledger");
  const by = (rows: { status: string }[], s: string) => rows.filter((r) => r.status === s).length;
  const first = member?.fullName.split(" ")[0] ?? "";
  // Balance = money in minus money out, per fund. Funds never mix.
  const balance = (fund: string) => {
    const rows = ledger.rows.filter((r) => r.fund === fund);
    const inn = rows.filter((r) => r.direction !== "out").reduce((s, r) => s + r.amount, 0);
    const out = rows.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0);
    return { inn, out, held: inn - out };
  };
  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title={`Salaam, ${first}`} intro="What is waiting for the committee today. You see what your role allows." />
      {member && isStaff(member.role) && (
        <>
          <h2 className="mb-3 font-display text-2xl">Cases</h2>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {QUEUES.map(([status, label, who]) => (
              <Stat key={status} n={by(cases.rows, status)} label={label} who={who} href="/admin/cases" />
            ))}
          </div>

          <h2 className="mb-3 font-display text-2xl">Needs attention</h2>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat n={by(donations.rows, "pending")} label="Gifts to confirm" who="Admin" href="/admin/payments" />
            <Stat n={by(loans.rows, "applied")} label="Loan applications to check" who="Verifier and trustee" href="/admin/loans" />
            <Stat n={by(loans.rows, "emi_pending_agreement")} label="Loans awaiting agreement" who="Family and trustee" href="/admin/loans" />
            <Stat n={by(reports.rows, "open")} label="Open community reports" who="Moderators" href="/admin/community" />
            <Stat n={people.rows.filter((m) => !m.membershipVerified).length} label="New members to verify" who="Admin" href="/admin/members" />
            <Stat n={flags.filter((f) => !decided.has(f.id)).length} label="Open fraud flags" who="Verifier" href="/admin/flags" />
          </div>

          <h2 className="mb-3 font-display text-2xl">Fund balances</h2>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
            {FUND_TYPES.map((f) => {
              const b = balance(f);
              return (
                <Card key={f}>
                  <p className="text-sm text-muted">{FUND_LABELS[f]}</p>
                  <p className="num mt-1 text-xl">{formatRupees(b.held)}</p>
                  <p className="text-xs text-muted">In {formatRupees(b.inn)} · Out {formatRupees(b.out)}</p>
                </Card>
              );
            })}
          </div>

          <h2 className="mb-3 font-display text-2xl">Rules this dashboard enforces</h2>
          <Card>
            <ul className="list-disc space-y-1 pl-5">
              {RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

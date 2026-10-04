"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { formatRupees } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, LinkButton } from "@/components/ui";
import { db } from "@/lib/firebase";

interface Stats {
  totalDisbursed: number;
  familiesHelped: number;
  scholarships: number;
  loansActive: number;
}

const STEPS = [
  ["Verify", "A verifier checks every case and its documents."],
  ["Approve", "A different trustee approves. Never the same person."],
  ["Give", "Your donation reaches the right fund, with a receipt."],
];

export default function Home() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => onSnapshot(doc(db, "publicStats", "summary"), (d) => setS((d.data() as Stats) ?? null), () => {}), []);
  const tiles: [string, string][] = [
    ["Total disbursed", formatRupees(s?.totalDisbursed ?? 0)],
    ["Families helped", String(s?.familiesHelped ?? 0)],
    ["Scholarships", String(s?.scholarships ?? 0)],
    ["Active loans", String(s?.loansActive ?? 0)],
  ];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Jamaat services</p>
          <h1 className="mt-1 font-display text-4xl font-bold sm:text-5xl">One place for care, giving and learning.</h1>
          <div className="mt-3 h-[3px] w-16 rounded bg-gold" />
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Welfare, scholarships, education loans, Khums and Lawajam, and a verified-source helpdesk, with every
            approval checked by two different people.
          </p>
          <div className="mt-6"><LinkButton href="/cases">See open cases</LinkButton></div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl font-bold">Together so far</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map(([label, value], i) => (
              <Card key={label} className={i === 0 ? "col-span-2 sm:col-span-1" : ""}>
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-1 font-display text-[clamp(1.5rem,7vw,1.875rem)] font-bold tabular-nums [overflow-wrap:anywhere]">
                  {value}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl font-bold">How it works</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <Card key={t}>
                <p className="text-sm font-semibold text-brand">Step {i + 1}</p>
                <h3 className="font-display text-xl font-bold">{t}</h3>
                <p className="mt-1 text-muted">{d}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

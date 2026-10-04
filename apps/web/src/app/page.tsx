"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRupees } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/ui";
import { db } from "@/lib/firebase";

interface Stats {
  totalDisbursed: number;
  familiesHelped: number;
  scholarships: number;
  loansActive: number;
}

const DOES = [
  ["Ask for help", "Welfare, scholarships and education loans. Apply once and follow every step."],
  ["Pay Khums and Lawajam", "Work out what is due and keep your receipts in one place."],
  ["Support families in need", "Give to verified cases. Names and contact details stay private."],
  ["Get answers you can trust", "The helpdesk only answers from Jamaat-approved sources."],
];

const STEPS = [
  ["Verify", "A verifier checks every case, its sources and its proof."],
  ["Approve", "A different committee member approves. Never the same person."],
  ["Give", "Your gift reaches the right fund, and every rupee is recorded."],
];

// A quiet geometric lattice in the brand's lighter green, drawn once as an inline SVG tile.
const PATTERN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96' fill='none' stroke='%23ffffff' stroke-opacity='.07' stroke-width='1.2'><path d='M48 0 96 48 48 96 0 48Z'/><circle cx='48' cy='48' r='13'/><path d='M0 0 48 48M96 0 48 48M0 96 48 48M96 96 48 48' stroke-opacity='.04'/></svg>`,
)}")`;

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
      <main className="mx-auto max-w-5xl space-y-12 px-4 py-6 sm:py-10">
        <section
          className="relative overflow-hidden rounded-[28px] px-6 py-12 text-white sm:px-12 sm:py-20"
          style={{ backgroundColor: "#0b4d3a", backgroundImage: PATTERN }}
        >
          {/* A gold mihrab arch, echoing the brand pack. Decorative only. */}
          <svg
            aria-hidden
            viewBox="0 0 200 300"
            className="pointer-events-none absolute -right-6 bottom-0 hidden h-[88%] text-[#c9a24a] opacity-80 md:block"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 300V130C20 70 70 25 100 8c30 17 80 62 80 122v170" />
            <path d="M40 300V135C40 82 78 44 100 30c22 14 60 52 60 105v165" strokeOpacity=".5" />
            <path d="M100 56v26M100 112l12-12-12-12-12 12Z" />
            <circle cx="100" cy="100" r="3" fill="currentColor" />
          </svg>
          <div className="relative max-w-2xl md:max-w-[33rem]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c9a24a]">One Jamaat. One app.</p>
            <h1 className="mt-3 font-display text-4xl leading-tight sm:text-6xl">Everything from the Jamaat, in one app.</h1>
            <p className="mt-5 text-lg leading-relaxed text-white/80">
              Ask for help, pay Khums and Lawajam, support families in need and get answers you can trust. Every case is checked by two
              committee members, and every rupee is recorded.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app" className="inline-flex min-h-12 items-center rounded-xl bg-[#c9a24a] px-6 font-bold text-[#1d2a24]">
                Get the Android app
              </Link>
              <Link href="/cases" className="inline-flex min-h-12 items-center rounded-xl border border-white/40 px-6 font-semibold">
                See open cases
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/60">The app is for members. This website is for everyone.</p>
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Impact</p>
          <h2 className="mt-1 font-display text-3xl">Together so far</h2>
          <div className="mt-2 h-[3px] w-14 rounded bg-gold" />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map(([label, value], i) => (
              <Card key={label} className={i === 0 ? "col-span-2 sm:col-span-1" : ""}>
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-1 num text-[clamp(1.5rem,7vw,1.875rem)] [overflow-wrap:anywhere]">{value}</p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">What you can do</p>
          <h2 className="mt-1 font-display text-3xl">Made for every member</h2>
          <div className="mt-2 h-[3px] w-14 rounded bg-gold" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {DOES.map(([t, d]) => (
              <Card key={t}>
                <h3 className="font-display text-xl">{t}</h3>
                <p className="mt-1 text-muted">{d}</p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Where money goes</p>
          <h2 className="mt-1 font-display text-3xl">How every case is handled</h2>
          <div className="mt-2 h-[3px] w-14 rounded bg-gold" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <Card key={t}>
                <p className="text-sm font-semibold text-brand">Step {i + 1}</p>
                <h3 className="font-display text-xl">{t}</h3>
                <p className="mt-1 text-muted">{d}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line py-6 text-center text-sm text-muted">KS1J · One Jamaat. One app.</footer>
    </>
  );
}

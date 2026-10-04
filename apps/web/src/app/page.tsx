"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRupees } from "@ks1j/shared";
import { CountUp } from "@/components/CountUp";
import { PaperCollage } from "@/components/HomeVisuals";
import { LocationPrompt } from "@/components/LocationPrompt";
import { SiteHeader } from "@/components/SiteHeader";
import { GuideDemo } from "@/components/home/GuideDemo";
import { HelpThatMoves } from "@/components/home/HelpThatMoves";
import { Hero } from "@/components/home/Hero";
import { KhumsDemo } from "@/components/home/KhumsDemo";
import { MoneyFlow } from "@/components/home/MoneyFlow";
import { TwoPerson } from "@/components/home/TwoPerson";
import { Walkthrough } from "@/components/home/Walkthrough";
import { db } from "@/lib/firebase";

interface Stats {
  totalDisbursed: number;
  familiesHelped: number;
  scholarships: number;
  loansActive: number;
}

// The page tells one story in ten parts (01 to 10). Each major section has one moment of motion; everything else is still.
export default function Home() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => onSnapshot(doc(db, "publicStats", "summary"), (d) => setS((d.data() as Stats) ?? null), () => {}), []);
  // live figures only; zero is shown as zero
  const tiles: [string, number, (n: number) => string][] = [
    ["Total disbursed", s?.totalDisbursed ?? 0, formatRupees],
    ["Families helped", s?.familiesHelped ?? 0, String],
    ["Scholarships", s?.scholarships ?? 0, String],
    ["Active loans", s?.loansActive ?? 0, String],
  ];

  return (
    <div className="dark-scope">
      <SiteHeader overlay />
      <LocationPrompt />
      <main className="mx-auto max-w-6xl space-y-24 px-4 py-6 sm:space-y-36 sm:py-10">
        <Hero />

        <section className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]" aria-labelledby="today-title">
          <div className="order-2 md:order-1">
            <PaperCollage />
          </div>
          <div className="order-1 md:order-2">
            <p className="section-no text-muted">Before KS1J</p>
            <h2 id="today-title" className="split-title mt-2">Today, help travels on paper, office visits and forwarded messages.</h2>
            <p className="split-body">Families wait without knowing where their request is. Funds with strict rules sit in the same book. KS1J puts every request, payment and answer in one place, with the rules checked every time.</p>
          </div>
        </section>

        <Walkthrough />
        <HelpThatMoves />
        <MoneyFlow />
        <TwoPerson />
        <KhumsDemo />
        <GuideDemo />

        <section aria-labelledby="connected-title">
          <p className="section-no text-brand">08 · Your Jamaat, connected</p>
          <h2 id="connected-title" className="split-title mt-2 max-w-2xl">Find a masjid. Find each other.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Link href="/mosques" className="lift group rounded-3xl border border-line bg-card p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Mosque finder</p>
              <p className="mt-2 font-display text-2xl">36 Shia masajid across Mumbai and MMR</p>
              <p className="mt-2 text-muted">Search by name or area, or the nearest one. On Friday it looks for a confirmed Jummah, and it never guesses a time.</p>
              <span className="mt-5 inline-block font-semibold text-brand transition-transform duration-200 group-hover:translate-x-1">Open the finder →</span>
            </Link>
            <Link href="/app" className="lift group rounded-3xl border border-line bg-card p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Community, in the app</p>
              <p className="mt-2 font-display text-2xl">A feed, a directory and mentors</p>
              <p className="mt-2 text-muted">News and thanks from members, profession circles and people who can help. Phone numbers are never shown.</p>
              <span className="mt-5 inline-block font-semibold text-brand transition-transform duration-200 group-hover:translate-x-1">Get the app →</span>
            </Link>
          </div>
        </section>

        <section aria-labelledby="impact-title">
          <p className="section-no text-brand">09 · Together so far</p>
          <h2 id="impact-title" className="split-title mt-2">Live from the committee&apos;s records.</h2>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map(([label, value, fmt], i) => (
              <div key={label} className={`rounded-2xl border border-line bg-card p-5 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
                <p className="text-sm text-muted">{label}</p>
                <p className="num mt-2 text-[clamp(1.6rem,6vw,2.25rem)] [overflow-wrap:anywhere]">
                  <CountUp value={value} format={fmt} />
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            Counted from verified payments and recorded payouts. <Link href="/transparency" className="underline">See the full transparency report</Link>.
          </p>
        </section>

        <section className="join-panel relative overflow-hidden rounded-[28px] px-6 py-14 text-center text-white sm:px-12 sm:py-20" aria-labelledby="join-title">
          <div className="geo-field" aria-hidden />
          <p className="section-no relative text-[#c9a24a]">10 · Join KS1J</p>
          <h2 id="join-title" className="relative mx-auto mt-3 max-w-3xl font-display text-[clamp(2rem,5vw,3.4rem)] leading-tight">One Jamaat. One app.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/75">Members use the Android app. Everyone can give, follow the numbers and find a masjid here.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/app" className="btn-gold">Get the Android app</Link>
            <Link href="/donate" className="btn-ghost">Donate</Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        <p>KS1J · One Jamaat. One app.</p>
        <p className="mt-2 space-x-4">
          <Link href="/transparency" className="underline">Transparency</Link>
          <Link href="/contact" className="underline">Contact</Link>
          <Link href="/mosques" className="underline">Mosques</Link>
        </p>
      </footer>
    </div>
  );
}

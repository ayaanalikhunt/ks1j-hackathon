"use client";

import Link from "next/link";
import { AndroidPhone } from "./AndroidPhone";

// Small labels around the phone, one for each thing the app does. They arrive one after another, then stay still.
// They sit in the gutters beside the phone and never cover the app; on phones they become a short list under it.
const CHIPS: { label: string; detail: string; pos: string }[] = [
  { label: "Ask for help", detail: "Medical, education, ration", pos: "-left-5 top-[6%]" },
  { label: "Application status", detail: "With a trustee", pos: "-left-5 top-[33%]" },
  { label: "Khums", detail: "Imam · Sadaat shares", pos: "-left-5 top-[60%]" },
  { label: "Transparency", detail: "Every rupee recorded", pos: "-left-5 bottom-[4%]" },
  { label: "Verified case", detail: "Checked by a verifier ✓", pos: "-right-5 top-[16%]" },
  { label: "Donation", detail: "Receipt ready", pos: "-right-5 top-[45%]" },
  { label: "AI Guide", detail: "Approved texts only", pos: "-right-5 top-[74%]" },
];

export function Hero() {
  return (
    <section className="hero-panel relative overflow-hidden rounded-[28px] px-6 pb-10 pt-12 text-white sm:px-12 sm:pb-14 sm:pt-16" aria-labelledby="hero-title">
      <div className="geo-field" aria-hidden />
      <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="hero-in section-no text-[#c9a24a]" style={{ ["--d" as string]: "80ms" }}>
            01 · One Jamaat. One app.
          </p>
          <h1 id="hero-title" className="hero-in mt-3 font-display text-[clamp(2.4rem,6vw,4rem)] leading-[1.04]" style={{ ["--d" as string]: "200ms" }}>
            Everything from the Jamaat, in one app.
          </h1>
          <p className="hero-in mt-5 max-w-xl text-lg leading-relaxed text-white/75" style={{ ["--d" as string]: "380ms" }}>
            Ask for help, pay Khums and Lawajam, support families in need and get answers you can trust. Every case is checked by two committee members, and every rupee is
            recorded.
          </p>
          <div className="hero-in mt-8 flex flex-wrap gap-3" style={{ ["--d" as string]: "540ms" }}>
            <Link href="/app" className="btn-gold">Get the Android app</Link>
            <Link href="/cases" className="btn-ghost">See open cases</Link>
          </div>
          <p className="hero-in mt-4 text-sm text-white/55" style={{ ["--d" as string]: "680ms" }}>
            The app is for members. This website is for everyone.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[36rem]">
          <div className="relative h-[33rem] sm:h-[35.5rem]">
          <AndroidPhone screens={["services"]} active="services" tilt priority className="phone-enter absolute inset-x-0 top-0 mx-auto w-[15rem] sm:w-[16rem]" />
          <ul className="pointer-events-none absolute inset-0 hidden xl:block" aria-label="What the app does">
            {CHIPS.map((c, i) => (
              <li key={c.label} className={`ctx-chip absolute ${c.pos}`} style={{ ["--d" as string]: `${900 + i * 240}ms` }}>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c9a24a]">{c.label}</span>
                <span className="block text-xs text-white/80">{c.detail}</span>
              </li>
            ))}
          </ul>
          </div>
          <ul className="hero-in mt-6 flex flex-wrap justify-center gap-2 xl:hidden" style={{ ["--d" as string]: "900ms" }} aria-label="What the app does">
            {CHIPS.map((c) => (
              <li key={c.label} className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/85">{c.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

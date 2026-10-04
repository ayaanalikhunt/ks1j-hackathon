"use client";

import { useEffect, useRef, useState } from "react";
import { AndroidPhone, SCREENS, type ScreenId } from "./AndroidPhone";

// Real screens of the app, in the order a member meets them. The words are the app's own; nothing here is a mock-up.
const STEPS: { screen: ScreenId; kicker: string; title: string; body: string }[] = [
  { screen: "services", kicker: "Services", title: "One place for every request", body: "Welfare assistance, scholarships and education loans sit together. Apply once and track every step; your details are only seen by the assigned committee." },
  { screen: "apply", kicker: "Ask for help", title: "Plain questions, big buttons", body: "Medical, education, ration, scholarship or an education loan. Donors never see your name or what you write." },
  { screen: "loan", kicker: "Education loans", title: "Interest-free, agreed together", body: "Qard-e-Hasana with no late fees. Nothing is paid out until you and a trustee agree the same monthly amount, and repayment starts after the course and a grace period." },
  { screen: "khums", kicker: "Give", title: "Khums, worked out and paid where it may go", body: "Work out your Khums and pay each share to where it is allowed to go. A guide only: confirm with your Marja' or the Jamaat's alim." },
  { screen: "learn", kicker: "Learn", title: "Answers with their source", body: "The helpdesk answers only from Jamaat-approved texts, with the source shown. If it does not know, it says so." },
];

export function Walkthrough() {
  const [active, setActive] = useState<ScreenId>("services");
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    // the step crossing the middle band of the screen is the one shown
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.screen as ScreenId);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section aria-labelledby="walk-title">
      <p className="section-no text-brand">02 · Everything in one place</p>
      <h2 id="walk-title" className="split-title mt-2 max-w-2xl">Four tabs. Nothing hidden in menus.</h2>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <ol className="space-y-6 lg:space-y-0">
          {STEPS.map((s, i) => (
            <li
              key={s.screen}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-screen={s.screen}
              className={`walk-step lg:flex lg:min-h-[78vh] lg:items-center ${active === s.screen ? "is-on" : ""}`}
            >
              <div className="rounded-2xl border border-line bg-card p-5 sm:p-7 lg:border-0 lg:bg-transparent lg:p-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{s.kicker}</p>
                <h3 className="mt-2 font-display text-2xl sm:text-3xl">{s.title}</h3>
                <p className="mt-3 max-w-lg text-muted">{s.body}</p>
                {/* phones: the screen sits under its own step instead of a pinned phone */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SCREENS[s.screen].src} alt={SCREENS[s.screen].alt} loading="lazy" decoding="async" width={600} height={1298} className="mx-auto mt-5 w-48 rounded-[1.4rem] border-4 border-[#070c09] shadow-[0_20px_40px_rgba(0,0,0,0.45)] lg:hidden" />
              </div>
            </li>
          ))}
        </ol>
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <AndroidPhone screens={STEPS.map((s) => s.screen)} active={active} className="mx-auto w-[17rem]" />
            <div className="mt-5 flex justify-center gap-2" aria-hidden>
              {STEPS.map((s) => (
                <span key={s.screen} className={`h-1.5 rounded-full transition-all duration-500 ${active === s.screen ? "w-8 bg-gold" : "w-3 bg-line"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

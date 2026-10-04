"use client";

import { useInView, useReducedMotion, useSequence } from "./motion";

// 0 case arrives · 1 verifier checks · 2 same person tries to approve: refused · 3 sent to an independent trustee · 4 approved
const BEATS = 5;

function Node({ role, line, on, tone = "neutral" }: { role: string; line: string; on: boolean; tone?: "neutral" | "ok" | "no" }) {
  const ring = tone === "ok" ? "border-gold" : tone === "no" ? "border-red-400" : on ? "border-fg/40" : "border-line";
  return (
    <div className={`rounded-2xl border-2 ${ring} bg-card p-4 transition-colors duration-500 sm:p-5`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{role}</p>
      <p className={`mt-1 font-display text-lg leading-snug transition-opacity duration-500 ${on ? "opacity-100" : "opacity-40"}`}>{line}</p>
    </div>
  );
}

export function TwoPerson() {
  const reduce = useReducedMotion();
  const { ref, seen } = useInView<HTMLDivElement>(0.45);
  const [b, replay] = useSequence(BEATS, seen, 1400, reduce);

  return (
    <section aria-labelledby="trust-title">
      <p className="section-no text-brand">05 · Trust is built into the system</p>
      <h2 id="trust-title" className="split-title mt-2 max-w-2xl">The person who verifies a case can never approve it.</h2>
      <p className="split-body">Two different committee members, every time. The app refuses the second step if the same person tries to take it.</p>

      <div ref={ref} className="mt-10 rounded-3xl border border-line bg-card/60 p-5 sm:p-8">
        <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <Node role="Verifier" line={b >= 1 ? "Sources and proof checked ✓" : "Receives the case"} on={b >= 1} tone={b >= 1 ? "ok" : "neutral"} />
          <Connector on={b >= 1} />
          <div className="relative">
            <Node role="Same verifier tries to approve" line={b >= 2 ? "Refused: you verified this case" : "…"} on={b >= 2} tone={b >= 2 ? "no" : "neutral"} />
          </div>
          <Connector on={b >= 3} />
          <Node role="Independent trustee" line={b >= 4 ? "Approved ✓" : b >= 3 ? "Reviews it fresh" : "Waiting"} on={b >= 3} tone={b >= 4 ? "ok" : "neutral"} />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>Separation of duties is enforced by the database rules, not by goodwill.</span>
          <button onClick={replay} disabled={reduce} className="min-h-11 rounded-xl border border-line px-4 font-semibold text-fg disabled:opacity-40">
            Replay
          </button>
        </div>
      </div>
    </section>
  );
}

function Connector({ on }: { on: boolean }) {
  return (
    <div className="flex justify-center" aria-hidden>
      <span className="relative block h-8 w-px overflow-hidden bg-line md:h-px md:w-12">
        <span className={`absolute inset-0 origin-top bg-gold transition-transform duration-700 md:origin-left ${on ? "scale-100" : "scale-0"}`} />
      </span>
    </div>
  );
}

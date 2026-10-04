"use client";

import { useInView, useReducedMotion, useSequence } from "./motion";

const STOPS = ["Application submitted", "Verification", "Independent approval", "Funding", "Help delivered"];

// The card's state at each beat. `stop` is where on the track it sits. The amounts belong to an illustrative case only.
const STATES = [
  { stop: 0, badge: "Submitted", done: false, raised: 0 },
  { stop: 1, badge: "In verification", done: false, raised: 0 },
  { stop: 1, badge: "Verified ✓", done: true, raised: 0 },
  { stop: 2, badge: "Approved ✓", done: true, raised: 0 },
  { stop: 3, badge: "Funded ✓", done: true, raised: 100 },
  { stop: 4, badge: "Paid out ✓", done: true, raised: 100 },
];

function CaseCard({ s }: { s: (typeof STATES)[number] }) {
  return (
    <div className="w-[15.5rem] rounded-2xl bg-[#fbfcfb] p-4 text-[#1d2a24] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[#5d6e65]">CASE-2026-000184</span>
        <span key={s.badge} className={`state-badge rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.done ? "bg-[#d8efe2] text-[#0b4d3a]" : "bg-[#f4ead0] text-[#6b5a2c]"}`}>{s.badge}</span>
      </div>
      <p className="mt-2 font-display text-lg leading-tight">School fees, Class 10</p>
      <p className="text-xs text-[#5d6e65]">Education · Name never shown</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e3e8e5]">
        <div className="h-full rounded-full bg-[#0b4d3a] transition-[width] duration-[900ms] ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: `${s.raised}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-[#5d6e65]">{s.raised ? "₹40,000 of ₹40,000 raised" : "₹40,000 needed"}</p>
    </div>
  );
}

export function HelpThatMoves() {
  const reduce = useReducedMotion();
  const { ref, seen } = useInView<HTMLDivElement>(0.45);
  const [i, replay] = useSequence(STATES.length, seen, 1300, reduce);
  const s = STATES[i];

  return (
    <section aria-labelledby="moves-title">
      <p className="section-no text-brand">03 · Help that moves</p>
      <h2 id="moves-title" className="split-title mt-2 max-w-2xl">Not a form that disappears. A tracked process.</h2>
      <p className="split-body">Every request moves through the same stages, and the family can see where it is at each one.</p>

      <div ref={ref} className="mt-10 rounded-3xl border border-line bg-card p-5 sm:p-8">
        {/* wide screens: the card travels along the track */}
        <div className="track-wide relative hidden md:block" style={{ ["--pos" as string]: String(s.stop) }}>
          <div className="relative h-[11.5rem]">
            <div className="move-card absolute top-0">
              <CaseCard s={s} />
            </div>
          </div>
          <div className="relative mt-4">
            <div className="absolute inset-x-0 top-[9px] h-px bg-line" />
            <div className="absolute left-0 top-[9px] h-px bg-gold transition-[width] duration-[1000ms] ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: `${(s.stop / 4) * 100}%` }} />
            <ol className="relative grid grid-cols-5">
              {STOPS.map((label, k) => (
                <li key={label} className={`text-center text-sm ${k <= s.stop ? "text-fg" : "text-muted"} ${k === 0 ? "text-left" : k === 4 ? "text-right" : ""}`}>
                  <span className={`mb-2 inline-block h-[19px] w-[19px] rounded-full border-2 transition-colors duration-500 ${k <= s.stop ? "border-gold bg-gold" : "border-line bg-card"}`} />
                  <span className="block">{label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* phones: the card stays put and changes state, with the stages listed beneath */}
        <div className="md:hidden">
          <div className="flex justify-center">
            <CaseCard s={s} />
          </div>
          <ol className="mt-6 space-y-2">
            {STOPS.map((label, k) => (
              <li key={label} className={`flex items-center gap-3 text-sm ${k <= s.stop ? "text-fg" : "text-muted"}`}>
                <span className={`h-3 w-3 shrink-0 rounded-full border-2 transition-colors duration-500 ${k <= s.stop ? "border-gold bg-gold" : "border-line"}`} />
                {label}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>Illustrative case. Real cases show only a reference, a category and the amounts.</span>
          <button onClick={replay} className="min-h-11 rounded-xl border border-line px-4 font-semibold text-fg disabled:opacity-40" disabled={reduce}>
            Replay
          </button>
        </div>
      </div>
    </section>
  );
}

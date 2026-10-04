"use client";

import { useState } from "react";
import { formatRupees, khumsDue, khumsSplit } from "@ks1j/shared";
import { CountUp } from "@/components/CountUp";

const PRESETS = [50000, 100000, 250000, 500000];

export function KhumsDemo() {
  const [savings, setSavings] = useState(100000);
  const [text, setText] = useState("");
  const due = khumsDue(savings);
  const { imam, sadaat } = khumsSplit(due);

  function typed(v: string) {
    setText(v);
    const n = Number(v.replace(/[^\d]/g, ""));
    if (Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000) setSavings(n);
  }

  return (
    <section aria-labelledby="khums-title">
      <p className="section-no text-brand">06 · Give with confidence</p>
      <h2 id="khums-title" className="split-title mt-2 max-w-2xl">Khums, worked out in front of you.</h2>
      <p className="split-body">Choose what is left in savings at your Khums year-end. One fifth is Khums, shared equally between Sehme Imam and Sehme Sadaat, and each share can only go where it is allowed.</p>

      <div className="mt-10 grid gap-6 rounded-3xl border border-line bg-card p-5 sm:p-8 lg:grid-cols-[18rem_1fr]">
        <div>
          <p className="text-sm font-medium">Savings left at year-end</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Example amounts">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setSavings(p);
                  setText("");
                }}
                aria-pressed={savings === p && !text}
                className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors duration-200 ${savings === p && !text ? "border-gold bg-gold/15 text-fg" : "border-line text-muted hover:text-fg"}`}
              >
                {formatRupees(p)}
              </button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm text-muted">Or type an amount (₹)</span>
            <input inputMode="numeric" value={text} onChange={(e) => typed(e.target.value)} placeholder="e.g. 175000" className="min-h-12 w-full rounded-xl border border-line bg-bg px-3 num" />
          </label>
        </div>

        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-2xl border border-line p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Savings</p>
              <p className="num mt-1 text-2xl"><CountUp value={savings} format={formatRupees} /></p>
            </div>
            <span className="text-center text-gold" aria-hidden>→ 20% →</span>
            <div className="rounded-2xl border-2 border-gold p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Khums due</p>
              <p className="num mt-1 text-2xl"><CountUp value={due} format={formatRupees} /></p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line">
            <div className="flex h-11 text-sm font-semibold text-white">
              <div className="flex items-center justify-center bg-[#1e4f9c] transition-[flex-grow] duration-500" style={{ flexGrow: imam || 1 }}>Sehme Imam</div>
              <div className="flex items-center justify-center bg-[#9a7a2c] transition-[flex-grow] duration-500" style={{ flexGrow: sadaat || 1 }}>Sehme Sadaat</div>
            </div>
            <div className="grid grid-cols-2 text-center">
              <p className="num border-r border-line py-2"><CountUp value={imam} format={formatRupees} /></p>
              <p className="num py-2"><CountUp value={sadaat} format={formatRupees} /></p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">This is a guide only. Confirm with your Marja&apos; or the Jamaat&apos;s alim.</p>
        </div>
      </div>
    </section>
  );
}

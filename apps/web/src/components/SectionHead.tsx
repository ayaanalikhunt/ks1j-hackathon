"use client";

import { useReveal } from "./useReveal";

/** Eyebrow, heading and gold rule that reveal together on scroll; the rule draws itself in (see .rule in globals.css). */
export function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      <h2 className="mt-1 font-display text-3xl">{title}</h2>
      <div className="rule mt-2 h-[3px] w-14 rounded bg-gold" />
    </div>
  );
}

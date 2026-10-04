"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useInView, useReducedMotion } from "./motion";

const QUESTION = "Can I apply for an education loan?";
// The app's own wording for education loans (the Education loan and Services screens), not a new claim.
const ANSWER =
  "Yes. Education loans are Qard-e-Hasana: interest-free, with no late fees. You agree a monthly amount with a trustee, and repayment starts after your course and a grace period. Apply from Services, Education loan.";

export function GuideDemo() {
  const reduce = useReducedMotion();
  const { ref, seen } = useInView<HTMLDivElement>(0.5);
  const [phase, setPhase] = useState<"idle" | "thinking" | "typing" | "done">("idle");
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!seen) return;
    if (reduce) {
      const id = requestAnimationFrame(() => {
        setShown(ANSWER.length);
        setPhase("done");
      });
      return () => cancelAnimationFrame(id);
    }
    const think = setTimeout(() => setPhase("thinking"), 500);
    const start = setTimeout(() => setPhase("typing"), 1700);
    return () => {
      clearTimeout(think);
      clearTimeout(start);
    };
  }, [seen, reduce]);

  useEffect(() => {
    if (phase !== "typing") return;
    // word by word, about how fast a person reads
    const t = setInterval(() => {
      setShown((n) => {
        const next = ANSWER.indexOf(" ", n + 1);
        if (next === -1) {
          clearInterval(t);
          setPhase("done");
          return ANSWER.length;
        }
        return next;
      });
    }, 70);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <section aria-labelledby="guide-title" className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="section-no text-brand">07 · Answers you can trust</p>
        <h2 id="guide-title" className="split-title mt-2">Not a generic chatbot.</h2>
        <p className="split-body">The Jamaat helpdesk answers only from texts the Jamaat has approved, and shows where the answer came from. When it does not know, it says so and points you to the office.</p>
        <Link href="/ask" className="btn-quiet mt-6">Open the Ask AI Guide</Link>
      </div>

      <div ref={ref} className="rounded-3xl border border-line bg-card p-5 sm:p-6" aria-label="Example conversation with the Jamaat helpdesk">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Example · Jamaat helpdesk</p>
        <div className="mt-4 space-y-3">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand/20 px-4 py-2.5">{QUESTION}</div>
          {phase === "thinking" && (
            <div className="w-fit rounded-2xl bg-bg px-4 py-3" aria-label="Thinking">
              <span className="typing-dots" aria-hidden><i /><i /><i /></span>
            </div>
          )}
          {(phase === "typing" || phase === "done") && (
            <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-bg px-4 py-3">
              <p>
                {ANSWER.slice(0, shown)}
                {phase === "typing" && <span className="caret" aria-hidden />}
              </p>
              <p className={`mt-3 inline-flex items-center gap-2 rounded-full border border-gold/50 px-3 py-1 text-xs font-semibold text-gold transition-opacity duration-700 ${phase === "done" ? "opacity-100" : "opacity-0"}`}>
                ✓ From Jamaat-approved texts
              </p>
            </div>
          )}
        </div>
        {/* the full answer for screen readers, whatever the animation is doing */}
        <p className="sr-only">{ANSWER}</p>
      </div>
    </section>
  );
}

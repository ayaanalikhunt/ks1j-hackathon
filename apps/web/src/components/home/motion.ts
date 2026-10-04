"use client";

import { useEffect, useRef, useState } from "react";

/** True for people who asked their system for less motion. Read once on mount; false during prerender. */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    const id = requestAnimationFrame(on);
    mq.addEventListener("change", on);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener("change", on);
    };
  }, []);
  return reduce;
}

/**
 * Becomes true the first time the element is `threshold` visible, and stays true. Without IntersectionObserver it is true at
 * once, so content is never hidden behind an animation that cannot run.
 */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      const id = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, seen };
}

/** Steps 0..n-1, advancing every `ms` once `run` is true, stopping at the last. Jumps straight to the end for reduced motion. */
export function useSequence(n: number, run: boolean, ms: number, reduce: boolean) {
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (reduce) {
      const id = requestAnimationFrame(() => setStep(n - 1));
      return () => cancelAnimationFrame(id);
    }
    let i = 0;
    const start = requestAnimationFrame(() => setStep(0));
    const t = setInterval(() => {
      i += 1;
      setStep(Math.min(i, n - 1));
      if (i >= n - 1) clearInterval(t);
    }, ms);
    return () => {
      cancelAnimationFrame(start);
      clearInterval(t);
    };
  }, [run, n, ms, reduce, round]);
  /** Plays the sequence again from the start. */
  const replay = () => setRound((r) => r + 1);
  return [step, replay] as const;
}

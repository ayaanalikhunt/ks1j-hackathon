"use client";

import { useEffect, useRef, useState } from "react";

/** Counts from 0 up to `value` the first time it is on screen, and eases to any later change. Plain text if motion is reduced. */
export function CountUp({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const [n, setN] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      shown.current = value;
      setN(value);
      setReady(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setReady(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  useEffect(() => {
    if (!ready) return;
    const from = shown.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1400);
      const v = from + (value - from) * (1 - Math.pow(1 - p, 3));
      shown.current = v;
      setN(Math.round(v));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, value]);

  return <span ref={ref}>{format(n)}</span>;
}

"use client";

import { useRef } from "react";

export const SCREENS = {
  services: { src: "/app-screens/services.webp", alt: "KS1J app, Services tab: welfare assistance, scholarship and education loan" },
  apply: { src: "/app-screens/apply.webp", alt: "KS1J app, Apply for help: choose medical, education, ration, scholarship or education loan" },
  loan: { src: "/app-screens/loan.webp", alt: "KS1J app, Education loan: interest-free, agree a monthly amount with a trustee" },
  khums: { src: "/app-screens/khums.webp", alt: "KS1J app, Khums: work out your Khums and pay each share where it is allowed to go" },
  learn: { src: "/app-screens/learn.webp", alt: "KS1J app, Learn: answers come only from Jamaat-approved texts, with the source shown" },
} as const;
export type ScreenId = keyof typeof SCREENS;

/**
 * A real screenshot of the KS1J Android app in a plain Android handset (punch-hole camera, no notch). Several screens can be
 * stacked: the `active` one is shown and the others cross-fade out. `tilt` adds a slow pointer-follow perspective on desktop.
 */
export function AndroidPhone({ screens, active, tilt = false, priority = false, className = "" }: { screens: ScreenId[]; active: ScreenId; tilt?: boolean; priority?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function onMove(e: React.PointerEvent) {
    if (!tilt || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => ref.current?.style.setProperty("--tilt", `rotateY(${(x * 10).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg)`));
  }
  const reset = () => ref.current?.style.setProperty("--tilt", "rotateY(-8deg) rotateX(4deg)");

  return (
    <div className={`phone-stage ${className}`} onPointerMove={onMove} onPointerLeave={reset}>
      <div ref={ref} className={`android-phone ${tilt ? "is-tilt" : ""}`}>
        <span className="android-cam" aria-hidden />
        <div className="android-screen">
          {screens.map((id, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={id}
              src={SCREENS[id].src}
              alt={id === active ? SCREENS[id].alt : ""}
              aria-hidden={id !== active}
              width={600}
              height={1298}
              loading={priority && i === 0 ? "eager" : "lazy"}
              decoding="async"
              className={`android-shot ${id === active ? "is-on" : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

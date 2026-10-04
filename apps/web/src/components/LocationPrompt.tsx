"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "ks1j-location-asked";

/**
 * First visit only: explains why the site would like the location, before the browser ever asks. "Allow location" opens the
 * mosque finder, which asks once and uses the answer for that search only. Either choice is remembered, so this never nags.
 */
export function LocationPrompt() {
  const [show, setShow] = useState(false);
  // read after the first paint: the page is prerendered, so the server never knows whether this visitor was asked
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (!localStorage.getItem(KEY) && "geolocation" in navigator) setShow(true);
      } catch {
        // storage blocked: never prompt rather than prompt every visit
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const remember = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  };
  if (!show) return null;
  return (
    <div role="dialog" aria-label="Find a nearby Shia masjid" className="mx-auto mt-4 max-w-5xl px-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-xl">Find a nearby Shia masjid</p>
          <p className="text-sm text-muted">Allow location so KS1J can show nearby masajid and, on Friday, the nearest confirmed Jummah. It is used once and not saved.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/mosques/?locate=1" onClick={remember} className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-[var(--bg)]">Allow location</Link>
          <button onClick={remember} className="min-h-12 rounded-xl border border-line px-5 font-semibold">Not now</button>
        </div>
      </div>
    </div>
  );
}

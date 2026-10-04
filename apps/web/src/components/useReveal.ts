"use client";

import { useCallback } from "react";

let observer: IntersectionObserver | null = null;

function shared() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            observer?.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
  }
  return observer;
}

/**
 * Scroll reveal: a box starts hidden and "spawns" in place (fade and a slight grow, no sliding) the first time it
 * scrolls into view. The hiding CSS only applies once the head script has confirmed IntersectionObserver exists
 * (see themeScript), so without JavaScript everything is simply visible.
 *
 * Returns a callback ref, so a box that mounts later (a table whose data arrives after load) is picked up too.
 */
export function useReveal<T extends HTMLElement>() {
  return useCallback((el: T | null) => {
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    shared().observe(el);
  }, []);
}

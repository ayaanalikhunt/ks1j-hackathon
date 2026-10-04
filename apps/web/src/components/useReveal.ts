"use client";

import { useCallback } from "react";

const pending = new Set<HTMLElement>();
let listening = false;
let queued = false;

/** Reveal every waiting box that is on screen or already above it, so a fast jump down the page never leaves blanks behind. */
function sweep() {
  queued = false;
  const limit = window.innerHeight * 0.92;
  for (const el of pending) {
    if (el.getBoundingClientRect().top < limit) {
      el.classList.add("is-in");
      pending.delete(el);
    }
  }
}

function queue() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(sweep);
  }
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue, { passive: true });
}

/**
 * Scroll reveal: a box starts hidden and "spawns" in place (fade and a slight grow, no sliding) the first time it
 * reaches the bottom of the screen. The hiding CSS only applies once the head script has confirmed support
 * (see themeScript), so without JavaScript, or with reduced motion, everything is simply visible.
 *
 * Returns a callback ref, so a box that mounts later (a table whose data arrives after load) is picked up too.
 */
export function useReveal<T extends HTMLElement>() {
  return useCallback((el: T | null) => {
    if (!el) return;
    if (!document.documentElement.classList.contains("js-reveal")) {
      el.classList.add("is-in");
      return;
    }
    pending.add(el);
    listen();
    queue();
  }, []);
}

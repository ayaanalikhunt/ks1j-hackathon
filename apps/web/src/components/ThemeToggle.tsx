"use client";

export const themeScript = `(function(){try{var t=localStorage.getItem("ks1j-theme");if(t){document.documentElement.setAttribute("data-theme",t)}}catch(e){}try{if("IntersectionObserver" in window&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.add("js-reveal")}}catch(e){}})();`;

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const cur =
      root.getAttribute("data-theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ks1j-theme", next);
    } catch {}
  }
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-full border border-line bg-card px-3 py-2 text-sm shadow-soft"
    >
      ◐
    </button>
  );
}

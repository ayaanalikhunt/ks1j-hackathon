"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { canOpenDashboard } from "@ks1j/shared";
import { useAuth } from "@/lib/auth";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Site navigation. Sticky; with `overlay` (the home page) it starts see-through and turns solid once the page scrolls.
 * Below the large breakpoint the links fold into a menu button. The current page is marked for sight and for screen readers.
 */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const { user, member, signOut } = useAuth();
  const path = usePathname()?.replace(/\/$/, "") || "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    const id = requestAnimationFrame(on);
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", on);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const links: [string, string][] = [
    ["/cases", "Cases"],
    ["/ask", "Ask AI Guide"],
    ["/mosques", "Mosques"],
    ["/donate", "Donate"],
    ["/transparency", "Transparency"],
    ...(user ? ([["/donations", "My donations"]] as [string, string][]) : []),
    ["/app", "Get the app"],
    ["/contact", "Contact"],
    ...(member && canOpenDashboard(member.role) ? ([["/admin", "Dashboard"]] as [string, string][]) : []),
  ];
  const isOn = (href: string) => path === href || path.startsWith(`${href}/`);
  const solid = !overlay || scrolled || open;

  const account = user ? (
    <button onClick={() => signOut()} className="nav-link text-sm font-semibold">
      Sign out
    </button>
  ) : (
    <Link href="/login" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-transform duration-200 hover:-translate-y-px">
      Sign in
    </Link>
  );

  return (
    <header className={`site-header sticky top-0 z-40 ${solid ? "is-solid" : "is-clear"}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-x-5 px-4 py-3">
        <Brand />
        <nav aria-label="Main" className="hidden flex-1 flex-wrap items-center gap-x-1 text-sm font-semibold lg:flex">
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={isOn(href) ? "page" : undefined} className="nav-link">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <ThemeToggle />
          <span className="hidden lg:inline-flex">{account}</span>
          <button
            className="menu-btn lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            <span className={open ? "is-x" : ""} aria-hidden />
          </button>
        </div>
      </div>
      <div id="mobile-nav" className={`mobile-nav lg:hidden ${open ? "is-open" : ""}`} hidden={!open}>
        <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-col px-4 pb-4">
          {links.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={isOn(href) ? "page" : undefined} className="mobile-link">
              {label}
            </Link>
          ))}
          <div className="mt-3">{account}</div>
        </nav>
      </div>
    </header>
  );
}

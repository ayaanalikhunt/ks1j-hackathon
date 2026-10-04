"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useReveal } from "./useReveal";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={`reveal min-w-0 rounded-2xl border border-line bg-card p-4 shadow-soft sm:p-6 ${className}`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <header className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      <h1 className="mt-1 font-display text-3xl sm:text-4xl">{title}</h1>
      <div className="mt-3 h-[3px] w-16 rounded bg-gold" />
      {intro && <p className="mt-3 max-w-2xl text-muted">{intro}</p>}
    </header>
  );
}

export function Button({ className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`min-h-12 rounded-xl bg-brand px-5 font-semibold text-[var(--bg)] disabled:opacity-50 ${className}`}
    />
  );
}

export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-[var(--bg)]">
      {children}
    </Link>
  );
}

export function Field({ label, ...p }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input {...p} className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" />
    </label>
  );
}

export function Banner({ kind = "info", children }: { kind?: "info" | "error"; children: ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${kind === "error" ? "border-red-400 text-red-600" : "border-line text-muted"}`}>
      {children}
    </div>
  );
}

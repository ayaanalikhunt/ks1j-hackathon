"use client";

import Link from "next/link";
import { canOpenDashboard } from "@ks1j/shared";
import { useAuth } from "@/lib/auth";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  const { user, member, signOut } = useAuth();
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Brand />
        <nav className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold">
          <Link href="/cases">Cases</Link>
          <Link href="/donate">Donate</Link>
          <Link href="/transparency">Transparency</Link>
          {user && <Link href="/donations">My donations</Link>}
          <Link href="/app">Get the app</Link>
          <Link href="/contact">Contact</Link>
          {member && canOpenDashboard(member.role) && <Link href="/admin">Dashboard</Link>}
        </nav>
        <ThemeToggle />
        {user ? (
          <button onClick={() => signOut()} className="text-sm font-semibold underline">
            Sign out
          </button>
        ) : (
          <Link href="/login" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[var(--bg)]">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

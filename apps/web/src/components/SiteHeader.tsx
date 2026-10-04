"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { isStaff } from "@ks1j/shared";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  const { user, member, signOut } = useAuth();
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="font-display text-2xl font-bold" style={{ color: "var(--wordmark)" }}>
          KS1J
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-4 text-sm">
          <Link href="/cases">Cases</Link>
          <Link href="/contact">Contact</Link>
          {member && isStaff(member.role) && <Link href="/admin">Dashboard</Link>}
        </nav>
        {user ? (
          <button onClick={() => signOut()} className="text-sm underline">
            Sign out
          </button>
        ) : (
          <Link href="/login" className="text-sm underline">
            Sign in
          </Link>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

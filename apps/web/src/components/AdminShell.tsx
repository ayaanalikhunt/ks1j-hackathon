"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canOpenDashboard, isStaff } from "@ks1j/shared";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { Banner } from "./ui";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/cases", "Cases"],
  ["/admin/loans", "Loans"],
  ["/admin/payments", "Payments"],
  ["/admin/khums", "Khums"],
  ["/admin/lawajam", "Lawajam"],
  ["/admin/institutions", "Institutions"],
  ["/admin/helpdesk", "Helpdesk KB"],
  ["/admin/announcements", "Announcements"],
  ["/admin/members", "Members"],
  ["/admin/community", "Community"],
] as const;

// Volunteers are not staff: they never see cases, loans, members or money.
const VOLUNTEER_NAV = new Set(["/admin/announcements", "/admin/community"]);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, member, loading } = useAuth();
  const path = usePathname()?.replace(/\/$/, "") || "/admin";
  if (loading) return <p className="p-6">Loading…</p>;
  if (!user) return <div className="p-6"><Banner>Please <Link className="underline" href="/login">sign in</Link>.</Banner></div>;
  if (!member || !canOpenDashboard(member.role))
    return <div className="p-6"><Banner kind="error">This area is for committee staff and volunteers only.</Banner></div>;
  const staff = isStaff(member.role);
  const nav = staff ? NAV : NAV.filter(([href]) => VOLUNTEER_NAV.has(href));
  if (!staff && !VOLUNTEER_NAV.has(path))
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-6">
        <Banner kind="error">Volunteers can use Announcements and Community moderation only.</Banner>
        <Link className="underline" href="/admin/community/">Go to Community</Link>
      </div>
    );
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:flex-row">
      <aside className="rounded-2xl border border-line bg-card p-4 shadow-soft md:w-56 md:shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Committee dashboard</p>
        <p className="mt-1 font-semibold">{member.fullName}</p>
        <p className="mb-3 text-sm capitalize text-muted">{member.role.replace("_", " ")}</p>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {nav.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm ${path === href ? "bg-brand/15 font-semibold text-brand" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex items-center justify-between">
          <Link href="/" className="text-sm underline">Site</Link>
          <ThemeToggle />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

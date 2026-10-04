"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DONOR_NOTIFICATION_KEYS, DONOR_NOTIFICATION_LABELS, PURPOSE_LABELS, VISIBILITY_LABELS, donationStage, formatDate, formatRupees, isAdminLike } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";

interface Donation {
  id: string;
  publicReference: string | null;
  amount: number;
  displayCurrency: string;
  displayAmount: number | null;
  purpose: string | null;
  status: string | null;
  visibility: string | null;
  allocatedAmount: number;
  disbursedAmount: number;
  createdAt: string | null;
}
interface Donor {
  id: string;
  profile: { fullName: string | null; displayName: string | null; email: string | null; phone: string | null; country: string | null; preferredCurrency: string | null; notifications: Record<string, boolean> | null; createdAt: string | null } | null;
  member: { fullName: string | null; role: string | null } | null;
  totals: { paidCount: number; paidTotal: number; allocated: number; disbursed: number };
  donations: Donation[];
}

const get = httpsCallable<{ donorId: string }, Donor>(getFunctions(auth.app, "asia-south1"), "getDonor");

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-4 border-b border-line py-1.5 text-sm last:border-0">
    <span className="text-muted">{k}</span>
    <span className="max-w-[65%] text-right font-medium [overflow-wrap:anywhere]">{v}</span>
  </div>
);

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const { member } = useAuth();
  const admin = !member || isAdminLike(member.role);
  const [d, setD] = useState<Donor | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !admin) return;
    let live = true;
    get({ donorId: id })
      .then((r) => live && setD(r.data))
      .catch((e) => {
        if (live) {
          setError((e as Error).message);
          setD(null);
        }
      });
    return () => {
      live = false;
    };
  }, [id, admin]);

  if (!admin) return <Banner kind="error">Donor details are for admins.</Banner>;
  if (d === undefined) return <p className="text-muted">Loading…</p>;
  if (d === null) return <Banner kind="error">{error ?? "No such donor."}</Banner>;
  const p = d.profile;
  const name = p?.fullName || d.member?.fullName || "A donor";

  return (
    <>
      <Link href="/admin/donors" className="mb-3 inline-block text-sm underline">← All donors</Link>
      <PageHeader eyebrow="Donor" title={name} intro="Opening this page was recorded in the audit log. Donors choose whether their name appears on public pages. Anonymous and private donors are never named publicly." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-display text-xl">Details (private)</h2>
          {p ? (
            <>
              <Row k="Full name" v={p.fullName || "Not given"} />
              <Row k="Name shown if public" v={p.displayName || "Not set"} />
              <Row k="Email" v={p.email || "Not given"} />
              <Row k="Phone" v={p.phone || "Not given"} />
              <Row k="Country" v={p.country || "Not given"} />
              <Row k="Preferred currency" v={p.preferredCurrency || "INR"} />
              <Row k="Profile created" v={p.createdAt ? formatDate(new Date(p.createdAt)) : ""} />
              <h3 className="mt-3 font-semibold">Notifications they chose</h3>
              {DONOR_NOTIFICATION_KEYS.map((k) => <Row key={k} k={DONOR_NOTIFICATION_LABELS[k]} v={p.notifications?.[k] === false ? "Off" : "On"} />)}
            </>
          ) : (
            <p className="text-muted">This donor has not set up a profile. They are known by their member account{d.member?.fullName ? ` (${d.member.fullName})` : ""}.</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-display text-xl">Giving</h2>
          <Row k="Verified donations" v={d.totals.paidCount} />
          <Row k="Total given" v={formatRupees(d.totals.paidTotal)} />
          <Row k="Allocated to cases" v={formatRupees(d.totals.allocated)} />
          <Row k="Paid out" v={formatRupees(d.totals.disbursed)} />
          <p className="mt-3 text-sm text-muted">Only references, amounts and stages are shown. A donor&apos;s donation never gives them, or you here, access to a beneficiary&apos;s details.</p>
        </Card>
      </div>

      <h2 className="mb-2 mt-8 font-display text-2xl">Donations</h2>
      <Table<Donation>
        rows={d.donations}
        empty="No donations."
        cols={[
          { head: "Reference", cell: (r) => r.publicReference ?? r.id },
          { head: "Date", cell: (r) => (r.createdAt ? formatDate(new Date(r.createdAt)) : "") },
          { head: "Amount", cell: (r) => (<span>{formatRupees(r.amount)}{r.displayCurrency !== "INR" && r.displayAmount ? <span className="block text-xs text-muted">{r.displayAmount} {r.displayCurrency}</span> : null}</span>) },
          { head: "Purpose", cell: (r) => PURPOSE_LABELS[r.purpose ?? ""] ?? "" },
          { head: "Stage", cell: (r) => donationStage({ status: r.status ?? undefined, allocatedAmount: r.allocatedAmount, disbursedAmount: r.disbursedAmount, amount: r.amount }) },
          { head: "Name shown", cell: (r) => (r.visibility ? VISIBILITY_LABELS[r.visibility]?.split(":")[0] ?? r.visibility : "") },
        ]}
      />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Detail />
    </Suspense>
  );
}

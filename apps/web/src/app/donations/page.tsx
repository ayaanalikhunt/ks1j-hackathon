"use client";

import { collection, doc, query, updateDoc, where } from "firebase/firestore";
import Link from "next/link";
import { PURPOSE_LABELS, donationStage, formatDate, csvRow, formatRupees } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Button, Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { downloadText } from "@/lib/download";
import { db } from "@/lib/firebase";
import { useQueryRows } from "@/lib/useQueryRows";

export interface MyDonation {
  publicReference?: string;
  amount: number;
  displayCurrency?: string;
  displayAmount?: number;
  purpose?: string;
  status?: string;
  allocatedAmount?: number;
  disbursedAmount?: number;
  createdAt?: { toDate(): Date };
  paidAt?: { toDate(): Date };
  visibility?: string;
}

export default function MyDonations() {
  const { user } = useAuth();
  const q = user ? query(collection(db, "donations"), where("payerId", "==", user.uid)) : null;
  const { rows, loading, error } = useQueryRows<MyDonation>(q, user?.uid ?? "");
  const notes = useQueryRows<{ text: string; read?: boolean; at?: { toDate(): Date }; link?: string | null }>(
    user ? query(collection(db, "notifications"), where("userId", "==", user.uid)) : null,
    `n${user?.uid ?? ""}`,
  );
  const updates = [...notes.rows].sort((a, b) => (b.at?.toDate().getTime() ?? Infinity) - (a.at?.toDate().getTime() ?? Infinity)).slice(0, 8);
  const mine = [...rows].sort((a, b) => (b.createdAt?.toDate().getTime() ?? 0) - (a.createdAt?.toDate().getTime() ?? 0));

  function exportCsv() {
    const head = csvRow(["Reference", "Date", "Amount (INR)", "Original amount", "Purpose", "Status", "Allocated", "Disbursed"]);
    downloadText(
      "my-donations.csv",
      [head, ...mine.map((d) => csvRow([d.publicReference ?? "", d.createdAt ? formatDate(d.createdAt.toDate()) : "", d.amount, d.displayCurrency && d.displayCurrency !== "INR" ? `${d.displayAmount} ${d.displayCurrency}` : "", PURPOSE_LABELS[d.purpose ?? ""] ?? "", donationStage(d), d.allocatedAmount ?? 0, d.disbursedAmount ?? 0]))].join("\n"),
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <PageHeader eyebrow="Your giving" title="My donations" intro="Each figure comes from the committee's verified records." />
        {!user && <Banner>Please <Link className="underline" href="/login">sign in</Link> to see your donations.</Banner>}
        {error && <Banner kind="error">{error}</Banner>}
        {user && !loading && mine.length === 0 && (
          <Banner>
            You have not made a donation yet. <Link className="underline" href="/donate">Donate now</Link> or <Link className="underline" href="/donations/profile">set up your profile</Link>.
          </Banner>
        )}
        {mine.length > 0 && (
          <div className="mb-4 flex gap-2">
            <Button onClick={exportCsv}>Download CSV</Button>
            <Link href="/donate" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold">Donate again</Link>
            <Link href="/donations/profile" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold">Profile and notifications</Link>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {mine.map((d) => (
            <Link key={d.id} href={`/donations/detail?id=${d.id}`}>
              <Card className="h-full">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{d.publicReference ?? "Donation"}</p>
                <p className="num mt-1 text-2xl font-semibold">{formatRupees(d.amount)}</p>
                {d.displayCurrency && d.displayCurrency !== "INR" && <p className="text-sm text-muted">{d.displayAmount} {d.displayCurrency}</p>}
                <p className="mt-1 text-muted">{PURPOSE_LABELS[d.purpose ?? ""] ?? "Donation"}{d.createdAt ? ` · ${formatDate(d.createdAt.toDate())}` : ""}</p>
                <p className="mt-2 font-semibold">{donationStage(d)}</p>
                <p className="mt-1 text-sm text-muted">
                  Allocated {formatRupees(d.allocatedAmount ?? 0)} · Paid out {formatRupees(d.disbursedAmount ?? 0)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
        {updates.length > 0 && (
          <>
            <h2 className="mb-2 mt-8 font-display text-2xl">Updates</h2>
            <div className="space-y-2">
              {updates.map((n) => (
                <Card key={n.id}>
                  <p className={n.read ? "text-muted" : "font-semibold"}>{n.text}</p>
                  <p className="mt-1 flex items-center gap-3 text-sm text-muted">
                    {n.at ? formatDate(n.at.toDate()) : ""}
                    {!n.read && <button className="underline" onClick={() => updateDoc(doc(db, "notifications", n.id), { read: true })}>Mark as read</button>}
                  </p>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

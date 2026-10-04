"use client";

import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PURPOSE_LABELS, donationStage, formatDate, formatRupees } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Button, Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useQueryRows } from "@/lib/useQueryRows";
import type { MyDonation } from "../page";

interface Alloc {
  caseNumber?: number | null;
  caseRef?: string | null;
  amount: number;
  category?: string;
  status: string;
  disbursedAmount?: number;
}
interface Disb {
  allocationId: string;
  amount: number;
  method: string;
  status: string;
  proofStatus?: string;
  completedAt?: { toDate(): Date };
}

const METHOD: Record<string, string> = { bank_transfer: "Bank transfer", upi: "UPI", cash: "Cash", direct_to_provider: "Paid directly to the provider", other: "Other" };

function Step({ done, title, children }: { done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${done ? "bg-brand" : "border border-line"}`} />
      <div>
        <p className={done ? "font-semibold" : "font-semibold text-muted"}>{title}</p>
        {children && <div className="text-sm text-muted">{children}</div>}
      </div>
    </li>
  );
}

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const { user } = useAuth();
  const [d, setD] = useState<(MyDonation & { consent?: boolean }) | null | undefined>(undefined);
  const [shown, setShown] = useState(false);
  useEffect(() => (user && id ? onSnapshot(doc(db, "donations", id), (s) => setD(s.exists() ? (s.data() as MyDonation) : null), () => setD(null)) : undefined), [id, user]);
  const allocs = useQueryRows<Alloc>(user && id ? query(collection(db, "allocations"), where("donationId", "==", id), where("donorId", "==", user.uid)) : null, `a${id}${user?.uid}`);
  const disbs = useQueryRows<Disb>(user && id ? query(collection(db, "disbursements"), where("donationId", "==", id), where("donorId", "==", user.uid)) : null, `d${id}${user?.uid}`);

  if (!user) return <Banner>Please <Link className="underline" href="/login">sign in</Link>.</Banner>;
  if (d === undefined) return <p className="text-muted">Loading…</p>;
  if (d === null) return <Banner>We could not find that donation.</Banner>;

  const live = allocs.rows.filter((a) => a.status === "allocated");
  async function receipt() {
    const { receiptPdf } = await import("@/lib/pdf");
    receiptPdf({
      reference: d!.publicReference ?? "Donation",
      createdAt: d!.createdAt ? d!.createdAt.toDate() : null,
      paidAt: d!.paidAt ? d!.paidAt.toDate() : null,
      amount: d!.amount,
      purpose: PURPOSE_LABELS[d!.purpose ?? ""] ?? "Donation",
      status: d!.status ?? "pending",
      visibility: d!.visibility ? d!.visibility[0].toUpperCase() + d!.visibility.slice(1) : undefined,
      displayCurrency: d!.displayCurrency,
      displayAmount: d!.displayAmount,
      exchangeRate: d!.exchangeRate,
      fxMarkupPercent: d!.fxMarkupPercent,
      fxMarkupAmount: d!.fxMarkupAmount,
      effectiveRate: d!.effectiveRate,
      paymentMethod: d!.paymentMethod,
      paymentId: d!.paymentId,
      allocatedAmount: d!.allocatedAmount ?? 0,
      disbursedAmount: d!.disbursedAmount ?? 0,
      allocations: live.map((a) => ({
        ref: a.caseRef ?? (a.caseNumber ? `Case #${a.caseNumber}` : "Committee fund"),
        category: PURPOSE_LABELS[a.category ?? ""] ?? "",
        amount: a.amount,
        disbursed: a.disbursedAmount ?? 0,
      })),
    }).save(`${d!.publicReference ?? "receipt"}.pdf`);
  }
  const paid = d.status === "paid";
  const done = (d.disbursedAmount ?? 0) >= d.amount && paid;
  const pendingProof = disbs.rows.some((x) => x.status === "completed" && x.proofStatus !== "verified");

  return (
    <>
      <PageHeader eyebrow={d.publicReference ?? "Donation"} title={formatRupees(d.amount)} intro={`${PURPOSE_LABELS[d.purpose ?? ""] ?? "Donation"} · ${donationStage(d)}`} />
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => setShown((v) => !v)}>Where did my donation go?</Button>
        {paid && <Button onClick={receipt}>Download receipt (PDF)</Button>}
        <Button className="!bg-card !text-[var(--fg)] border border-line" onClick={() => window.print()}>Print receipt</Button>
      </div>

      <Card className="mb-4">
        <h2 className="font-display text-xl">Receipt</h2>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <dt className="text-muted">Reference</dt><dd className="num">{d.publicReference}</dd>
          <dt className="text-muted">Date</dt><dd>{d.createdAt ? formatDate(d.createdAt.toDate()) : ""}</dd>
          <dt className="text-muted">Amount</dt><dd className="num">{formatRupees(d.amount)}</dd>
          {d.displayCurrency && d.displayCurrency !== "INR" && (<><dt className="text-muted">Original amount</dt><dd className="num">{d.displayAmount} {d.displayCurrency}</dd></>)}
          <dt className="text-muted">Purpose</dt><dd>{PURPOSE_LABELS[d.purpose ?? ""] ?? "Donation"}</dd>
          <dt className="text-muted">Payment</dt><dd>{paid ? "Verified" : d.status === "refunded" ? "Refunded" : "Pending"}</dd>
          <dt className="text-muted">Allocation</dt><dd>{(d.allocatedAmount ?? 0) > 0 ? `${formatRupees(d.allocatedAmount ?? 0)} allocated` : "Allocation pending"}</dd>
        </dl>
        <p className="mt-3 text-xs text-muted">KS1J. Zero interest, zero late fees. This receipt shows only what the committee has recorded.</p>
      </Card>

      {shown && (
        <Card>
          <h2 className="font-display text-xl">Where did my donation go?</h2>
          {!paid ? (
            <p className="mt-2 text-muted">This payment has not been verified yet, so nothing has been allocated.</p>
          ) : (
            <ol className="mt-3 space-y-4">
              <Step done title={`${formatRupees(d.amount)} donated and verified`} />
              {live.length === 0 ? (
                <Step done={false} title="Allocation pending">The committee has not yet allocated this donation to a case. We never say it has helped someone before it has.</Step>
              ) : (
                live.map((a) => {
                  const paidOut = disbs.rows.filter((x) => x.status === "completed" && x.allocationId === a.id);
                  return (
                    <Step key={a.id} done title={`${formatRupees(a.amount)} allocated to ${a.caseRef ?? (a.caseNumber ? `Case #${a.caseNumber}` : "the committee's fund")}`}>
                      {PURPOSE_LABELS[a.category ?? ""] ?? ""}
                      {paidOut.map((x) => (
                        <p key={x.id}>
                          {formatRupees(x.amount)} paid out{x.completedAt ? ` on ${formatDate(x.completedAt.toDate())}` : ""} ({METHOD[x.method] ?? x.method}) ·{" "}
                          {x.proofStatus === "verified" ? "proof verified by the committee" : "supporting documentation pending committee verification"}
                        </p>
                      ))}
                    </Step>
                  );
                })
              )}
              <Step done={(d.disbursedAmount ?? 0) > 0} title={`${formatRupees(d.disbursedAmount ?? 0)} of ${formatRupees(d.amount)} paid out`} />
              <Step done={done && !pendingProof} title={done ? "Complete" : "In progress"}>
                {done && pendingProof ? "Paid out in full. Supporting documentation is awaiting committee verification." : undefined}
              </Step>
            </ol>
          )}
          <p className="mt-4 text-xs text-muted">Family names, addresses and documents are private. A donation does not give access to a beneficiary&apos;s details.</p>
        </Card>
      )}
    </>
  );
}

export default function DonationDetail() {
  return (
    <>
      <div className="print:hidden"><SiteHeader /></div>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Suspense fallback={null}>
          <Detail />
        </Suspense>
      </main>
    </>
  );
}

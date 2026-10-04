"use client";

import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CATEGORY_LABELS, formatRupees } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";

interface PublicCase {
  category: string;
  description: string;
  amountNeeded: number;
  amountRaised: number;
}

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const { user } = useAuth();
  const [c, setC] = useState<PublicCase | null | undefined>(undefined);
  const [amount, setAmount] = useState("500");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(
    () => (id ? onSnapshot(doc(db, "publicCases", id), (d) => setC(d.exists() ? (d.data() as PublicCase) : null)) : undefined),
    [id],
  );

  async function give() {
    setMsg(null);
    try {
      // Money never moves on the client: this only records a PENDING donation.
      await addDoc(collection(db, "donations"), {
        fund: "general",
        caseId: id,
        amount: Math.trunc(Number(amount)),
        status: "pending",
        payerId: user?.uid ?? null,
        createdAt: serverTimestamp(),
      });
      setMsg("Thank you. Your pledge is recorded as pending until payment is confirmed.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (c === undefined) return <p>Loading…</p>;
  if (c === null) return <Banner>Case not found.</Banner>;
  return (
    <>
      <Link href="/cases" className="mb-3 inline-block text-sm font-semibold underline">
        ← All cases
      </Link>
      <PageHeader eyebrow={CATEGORY_LABELS[c.category] ?? c.category} title="Help for a family" intro={c.description} />
      <Card className="mb-4 space-y-3">
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={c.amountNeeded}
          aria-valuenow={c.amountRaised}
        >
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${Math.min(100, c.amountNeeded ? (c.amountRaised / c.amountNeeded) * 100 : 0)}%` }}
          />
        </div>
        <p className="tabular-nums">
          <strong>{formatRupees(c.amountRaised)}</strong> raised of {formatRupees(c.amountNeeded)}
        </p>
        <p className="text-muted">
          Verified and approved by two different Jamaat committee members. The Jamaat pays the hospital, school or family directly and
          keeps proof.
        </p>
        <p className="text-muted">
          To protect the family&apos;s dignity, their name and contact details are hidden. The Jamaat knows who they are and has checked
          the need.
        </p>
      </Card>
      <Card className="space-y-3">
        <Field label="Amount (₹)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button onClick={give} disabled={!(Number(amount) > 0)}>
          Give to this case
        </Button>
        {msg && <Banner>{msg}</Banner>}
      </Card>
    </>
  );
}

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Suspense fallback={<p>Loading…</p>}>
          <Detail />
        </Suspense>
      </main>
    </>
  );
}

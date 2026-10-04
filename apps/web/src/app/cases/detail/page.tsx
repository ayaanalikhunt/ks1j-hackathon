"use client";

import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { formatRupees } from "@ks1j/shared";
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
      <PageHeader eyebrow={c.category} title="Case" intro={c.description} />
      <Card className="space-y-3">
        <p className="tabular-nums">
          {formatRupees(c.amountRaised)} raised of {formatRupees(c.amountNeeded)}
        </p>
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

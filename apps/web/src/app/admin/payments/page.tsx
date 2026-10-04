"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";
import { formatRupees } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Payment {
  amount: number;
  status: "pending" | "paid";
  fund?: string;
}

const confirm = httpsCallable(getFunctions(auth.app, "asia-south1"), "confirmPayment");

function PaymentTable({ kind, path }: { kind: "donation" | "repayment"; path: string }) {
  const { member } = useAuth();
  const { rows, error } = useCollection<Payment>(path);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string) {
    setBusy(id);
    setMsg(null);
    try {
      await confirm({ kind, id });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {msg && <Banner kind="error">{msg}</Banner>}
      <Table<Payment>
        rows={rows}
        error={error}
        cols={[
          { head: "Amount", cell: (r) => formatRupees(r.amount) },
          { head: "Fund", cell: (r) => r.fund ?? "repayment" },
          { head: "Status", cell: (r) => r.status },
          {
            head: "",
            cell: (r) =>
              r.status === "pending" &&
              member?.role === "admin" && (
                <Button className="!min-h-9 !px-3" disabled={busy === r.id} onClick={() => run(r.id)}>
                  Confirm received
                </Button>
              ),
          },
        ]}
      />
    </>
  );
}

export default function AdminPayments() {
  return (
    <>
      <PageHeader
        eyebrow="Committee dashboard"
        title="Payments"
        intro="A gift stays pending until an admin confirms the money has arrived. Confirming appends a ledger entry."
      />
      <h2 className="mb-2 font-display text-2xl font-bold">Donations</h2>
      <PaymentTable kind="donation" path="donations" />
      <h2 className="mb-2 mt-6 font-display text-2xl font-bold">Loan repayments</h2>
      <PaymentTable kind="repayment" path="repayments" />
    </>
  );
}

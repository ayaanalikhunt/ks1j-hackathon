"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";
import { FUND_LABELS, FUND_TYPES, KHUMS_DISCLAIMER, formatDate, formatRupees, isAdminLike, isoToDmy, toCsv } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { downloadText } from "@/lib/download";
import { useCollection } from "@/lib/useCollection";

interface LedgerRow {
  fund: string;
  direction?: "in" | "out";
  kind: string;
  amount: number;
  institutionId?: string | null;
  caseId?: string | null;
  createdAt?: { toDate(): Date } | null;
}
interface Institution {
  name: string;
  city?: string;
  ijazahVerified: boolean;
  received?: number;
  handedOver?: number;
}
interface Handover {
  institutionName: string;
  amount: number;
  reference: string;
  at?: { toDate(): Date } | null;
}
interface Calc {
  memberId: string;
  yearEnd?: string;
  surplus: number;
  due: number;
}

const recordHandover = httpsCallable(getFunctions(auth.app, "asia-south1"), "recordHandover");
const KIND_LABELS: Record<string, string> = {
  donation: "Donation received",
  repayment: "Loan repayment",
  lawajam: "Lawajam received",
  payout: "Paid out to a case",
  handover: "Handed over to an institution",
};
const when = (d?: { toDate(): Date } | null) => (d ? formatDate(d.toDate()) : "");

export default function KhumsAndLedgers() {
  const { member } = useAuth();
  const canHandOver = isAdminLike(member?.role);
  const ledger = useCollection<LedgerRow>("ledger");
  const institutions = useCollection<Institution>("institutions");
  const handovers = useCollection<Handover>("handovers");
  const calcs = useCollection<Calc>("khumsCalculations");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...ledger.rows].sort((a, b) => (b.createdAt?.toDate().getTime() ?? 0) - (a.createdAt?.toDate().getTime() ?? 0));
  const sums = (fund: string) => {
    const rows = ledger.rows.filter((r) => r.fund === fund);
    const inn = rows.filter((r) => r.direction !== "out").reduce((s, r) => s + r.amount, 0);
    const out = rows.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0);
    return { inn, out, held: inn - out };
  };

  async function hand(id: string, held: number) {
    const amount = Math.trunc(Number(amounts[id] ?? 0));
    setBusy(true);
    setMsg(null);
    try {
      await recordHandover({ institutionId: id, amount: amount || held, reference: refs[id] ?? "" });
      setMsg({ error: false, text: "Handover recorded and written to the ledger." });
      setAmounts((a) => ({ ...a, [id]: "" }));
      setRefs((r) => ({ ...r, [id]: "" }));
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const exportLedger = () =>
    downloadText(
      "ks1j-ledger.csv",
      toCsv(
        ["Date", "Fund", "What", "In or out", "Amount (INR)"],
        sorted.map((r) => [when(r.createdAt), FUND_LABELS[r.fund] ?? r.fund, KIND_LABELS[r.kind] ?? r.kind, r.direction === "out" ? "Out" : "In", r.amount]),
      ),
    );
  const exportHandovers = () =>
    downloadText(
      "ks1j-handovers.csv",
      toCsv(
        ["Date", "Institution", "Reference", "Amount (INR)"],
        handovers.rows.map((h) => [when(h.at), h.institutionName, h.reference, h.amount]),
      ),
    );

  const verified = institutions.rows.filter((i) => i.ijazahVerified);
  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Khums and ledgers" intro="Every rupee by fund. Funds never mix, and entries are never edited. Corrections are new rows." />
      {msg && <div className="mb-3"><Banner kind={msg.error ? "error" : "info"}>{msg.text}</Banner></div>}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button className="!min-h-10 !px-4" onClick={exportLedger}>Download ledger for Excel</Button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {FUND_TYPES.map((f) => {
          const s = sums(f);
          return (
            <Card key={f}>
              <p className="text-sm text-muted">{FUND_LABELS[f]}</p>
              <p className="num mt-1 text-xl">{formatRupees(s.held)}</p>
              <p className="text-xs text-muted">In {formatRupees(s.inn)} · Out {formatRupees(s.out)}</p>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-1 font-display text-2xl">Sehme Imam by institution</h2>
      <p className="mb-3 text-muted">Collected for each verified institution and handed over by finance. The system refuses a handover larger than what is held.</p>
      <div className="mb-8 space-y-3">
        {verified.length === 0 && <Banner>No verified institutions yet.</Banner>}
        {verified.map((i) => {
          const held = (i.received ?? 0) - (i.handedOver ?? 0);
          return (
            <Card key={i.id}>
              <h3 className="text-lg">{i.name}{i.city ? `, ${i.city}` : ""}</h3>
              <p className="num text-sm text-muted">Received {formatRupees(i.received ?? 0)} · Handed over {formatRupees(i.handedOver ?? 0)} · Held {formatRupees(held)}</p>
              {canHandOver && held > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Amount (₹)" inputMode="numeric" placeholder={`All ${held}`} value={amounts[i.id] ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [i.id]: e.target.value }))} />
                  <Field label="Bank transfer or cheque number" value={refs[i.id] ?? ""} onChange={(e) => setRefs((r) => ({ ...r, [i.id]: e.target.value }))} />
                  <Button className="self-end" disabled={busy || (refs[i.id] ?? "").trim().length < 3} onClick={() => hand(i.id, held)}>
                    Record handover
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl">Handovers to institutions</h2>
        <Button className="!min-h-10 !px-4" onClick={exportHandovers}>Download for Excel</Button>
      </div>
      <div className="mb-8">
        <Table<Handover>
          rows={[...handovers.rows].sort((a, b) => (b.at?.toDate().getTime() ?? 0) - (a.at?.toDate().getTime() ?? 0))}
          error={handovers.error}
          empty="No handovers yet."
          cols={[
            { head: "Date", cell: (r) => when(r.at) },
            { head: "Institution", cell: (r) => r.institutionName },
            { head: "Reference", cell: (r) => r.reference },
            { head: "Amount", cell: (r) => formatRupees(r.amount) },
          ]}
        />
      </div>

      <h2 className="mb-2 font-display text-2xl">Recent ledger entries</h2>
      <div className="mb-8">
        <Table<LedgerRow>
          rows={sorted.slice(0, 50)}
          error={ledger.error}
          empty="Nothing has been recorded yet."
          cols={[
            { head: "Date", cell: (r) => when(r.createdAt) },
            { head: "Fund", cell: (r) => FUND_LABELS[r.fund] ?? r.fund },
            { head: "What", cell: (r) => KIND_LABELS[r.kind] ?? r.kind },
            { head: "Amount", cell: (r) => (<span className="num">{r.direction === "out" ? "−" : ""}{formatRupees(r.amount)}</span>) },
          ]}
        />
      </div>

      <h2 className="mb-1 font-display text-2xl">Members&apos; Khums calculations</h2>
      <div className="mb-3"><Banner>{KHUMS_DISCLAIMER}</Banner></div>
      <Table<Calc>
        rows={calcs.rows}
        error={calcs.error}
        empty="No one has saved a Khums calculation yet."
        cols={[
          { head: "Year-end", cell: (r) => isoToDmy(r.yearEnd) },
          { head: "Savings", cell: (r) => formatRupees(r.surplus) },
          { head: "Khums due", cell: (r) => formatRupees(r.due) },
        ]}
      />
    </>
  );
}

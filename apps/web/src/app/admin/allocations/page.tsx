"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { where } from "firebase/firestore";
import { useMemo, useState } from "react";
import { PURPOSE_LABELS, formatRupees } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

const fns = getFunctions(auth.app, "asia-south1");
const fn = (name: string) => httpsCallable<unknown, Record<string, unknown>>(fns, name);

interface Donation { publicReference?: string; amount: number; allocatedAmount?: number; disbursedAmount?: number; purpose?: string; fund?: string; status: string; visibility?: string }
interface CaseRow { number?: number; title?: string; amountRequested: number; raised?: number; status: string; zakatEligible?: boolean }
interface Alloc { donationId: string; caseNumber?: number | null; amount: number; reservedAmount?: number; disbursedAmount?: number; status: string; category?: string }
interface Disb { allocationId: string; amount: number; method: string; status: string; proofStatus?: string; processedBy: string }

function useAction() {
  const [msg, setMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(name: string, data: unknown, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn(name)(data);
      setMsg({ kind: "info", text: ok });
      return r.data;
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return { msg, busy, run };
}

function AllocateForm({ donation, cases, act }: { donation: Donation & { id: string }; cases: (CaseRow & { id: string })[]; act: ReturnType<typeof useAction> }) {
  const left = donation.amount - (donation.allocatedAmount ?? 0);
  const [caseId, setCaseId] = useState("");
  const [amount, setAmount] = useState(String(left));
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Case</span>
        <select className="min-h-10 rounded-lg border border-line bg-bg px-2" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          <option value="">Choose…</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>#{c.number} {c.title ?? ""} (needs {formatRupees(c.amountRequested - (c.raised ?? 0))}){c.zakatEligible ? " · Zakat OK" : ""}</option>
          ))}
        </select>
      </label>
      <div className="w-28"><Field label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <Button className="!min-h-10 !px-3" disabled={!caseId || act.busy} onClick={() => act.run("allocateDonation", { donationId: donation.id, allocations: [{ caseId, amount: Number(amount) }] }, "Allocated.")}>
        Allocate
      </Button>
    </div>
  );
}

function PayoutForm({ alloc, act }: { alloc: Alloc & { id: string }; act: ReturnType<typeof useAction> }) {
  const left = alloc.amount - (alloc.reservedAmount ?? 0);
  const [amount, setAmount] = useState(String(left));
  const [method, setMethod] = useState("bank_transfer");
  const [recipient, setRecipient] = useState("");
  const [ref, setRef] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-24"><Field label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Method</span>
        <select className="min-h-10 rounded-lg border border-line bg-bg px-2" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="direct_to_provider">Direct to provider</option><option value="other">Other</option>
        </select>
      </label>
      <div className="w-40"><Field label="Paid to (private)" value={recipient} onChange={(e) => setRecipient(e.target.value)} /></div>
      <div className="w-36"><Field label="Reference no." value={ref} onChange={(e) => setRef(e.target.value)} /></div>
      <Button className="!min-h-10 !px-3" disabled={act.busy} onClick={() => act.run("createDisbursement", { allocationId: alloc.id, amount: Number(amount), method, recipientName: recipient || undefined, referenceNumber: ref || undefined }, "Payout recorded.")}>
        Record payout
      </Button>
    </div>
  );
}

function Settings() {
  const act = useAction();
  const [f, setF] = useState({ fxMarkupPercent: "", fixedInr: "", rounding: "", disbursementCheckerThreshold: "", reason: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  function save() {
    const data: Record<string, unknown> = { reason: f.reason };
    if (f.fxMarkupPercent) data.fxMarkupPercent = Number(f.fxMarkupPercent);
    if (f.fixedInr) data.fixedInr = Number(f.fixedInr);
    if (f.rounding) data.rounding = f.rounding;
    if (f.disbursementCheckerThreshold) data.disbursementCheckerThreshold = Number(f.disbursementCheckerThreshold);
    act.run("updatePaymentSettings", data, "Saved and recorded in the audit log.");
  }
  return (
    <Card>
      <h2 className="font-display text-xl">Payment settings</h2>
      <p className="text-sm text-muted">Leave a box empty to keep its current value. Every change is audit-logged with your reason.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Forex markup (%)" inputMode="decimal" value={f.fxMarkupPercent} onChange={set("fxMarkupPercent")} />
        <Field label="Fixed adjustment (₹)" inputMode="decimal" value={f.fixedInr} onChange={set("fixedInr")} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Rounding</span>
          <select className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" value={f.rounding} onChange={set("rounding")}>
            <option value="">Keep current</option><option value="nearest">Nearest rupee</option><option value="up">Up</option><option value="down">Down</option>
          </select>
        </label>
        <Field label="Second approver needed from (₹)" inputMode="numeric" value={f.disbursementCheckerThreshold} onChange={set("disbursementCheckerThreshold")} />
      </div>
      <div className="mt-3"><Field label="Reason for the change" value={f.reason} onChange={set("reason")} /></div>
      {act.msg && <div className="mt-3"><Banner kind={act.msg.kind}>{act.msg.text}</Banner></div>}
      <div className="mt-3"><Button disabled={act.busy} onClick={save}>Save settings</Button></div>
    </Card>
  );
}

export default function Allocations() {
  const act = useAction();
  const donations = useCollection<Donation>("donations", useMemo(() => [where("status", "==", "paid")], []));
  const cases = useCollection<CaseRow>("cases", useMemo(() => [where("status", "==", "published")], []));
  const allocs = useCollection<Alloc>("allocations");
  const disbs = useCollection<Disb>("disbursements");
  const [warnings, setWarnings] = useState<{ donation: string; problem: string }[] | null>(null);

  const open = donations.rows.filter((d) => d.amount - (d.allocatedAmount ?? 0) > 0);
  const payable = allocs.rows.filter((a) => a.status === "allocated" && a.amount - (a.reservedAmount ?? 0) > 0);
  const pending = disbs.rows.filter((d) => d.status === "pending_approval");
  const proofs = disbs.rows.filter((d) => d.status === "completed" && d.proofStatus === "pending");

  async function reconcile() {
    const r = await act.run("reconcileFunds", {}, "Books checked.");
    if (r) setWarnings((r as { warnings: { donation: string; problem: string }[] }).warnings);
  }

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Allocations & payouts" intro="Verified donations are split across cases here, then paid out. A second admin approves large payouts and reviews proof." />
      {act.msg && <div className="mb-4"><Banner kind={act.msg.kind}>{act.msg.text}</Banner></div>}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button onClick={reconcile} disabled={act.busy}>Check the books</Button>
        {warnings && (warnings.length === 0 ? <span className="text-sm">Everything reconciles.</span> : <span className="text-sm text-red-600">{warnings.length} problem(s) found.</span>)}
      </div>
      {warnings && warnings.length > 0 && <ul className="mb-6 list-disc pl-5 text-sm text-red-600">{warnings.map((w, i) => <li key={i}>{w.donation}: {w.problem}</li>)}</ul>}

      <h2 className="mb-2 font-display text-2xl">Waiting to be allocated</h2>
      <Table<Donation>
        rows={open}
        error={donations.error}
        empty="Every verified donation is allocated."
        cols={[
          { head: "Donation", cell: (r) => r.publicReference ?? r.id },
          { head: "For", cell: (r) => PURPOSE_LABELS[r.purpose ?? ""] ?? "" },
          { head: "Unallocated", cell: (r) => formatRupees(r.amount - (r.allocatedAmount ?? 0)) },
          { head: "Allocate", cell: (r) => <AllocateForm donation={r} cases={cases.rows} act={act} /> },
        ]}
      />

      <h2 className="mb-2 mt-8 font-display text-2xl">Ready to pay out</h2>
      <Table<Alloc>
        rows={payable}
        error={allocs.error}
        empty="Nothing waiting for payout."
        cols={[
          { head: "Case", cell: (r) => (r.caseNumber ? `#${r.caseNumber}` : "Fund") },
          { head: "Left to pay", cell: (r) => formatRupees(r.amount - (r.reservedAmount ?? 0)) },
          { head: "Payout", cell: (r) => <PayoutForm alloc={r} act={act} /> },
        ]}
      />

      <h2 className="mb-2 mt-8 font-display text-2xl">Payouts waiting for a second approver</h2>
      <Table<Disb>
        rows={pending}
        empty="None waiting."
        cols={[
          { head: "Amount", cell: (r) => formatRupees(r.amount) },
          { head: "Method", cell: (r) => r.method },
          {
            head: "",
            cell: (r) => (
              <span className="flex gap-2">
                <Button className="!min-h-9 !px-3" disabled={act.busy} onClick={() => act.run("decideDisbursement", { id: r.id, approve: true }, "Approved.")}>Approve</Button>
                <Button className="!min-h-9 !px-3 !bg-card !text-[var(--fg)] border border-line" disabled={act.busy} onClick={() => { const reason = window.prompt("Why is it rejected?"); if (reason) act.run("decideDisbursement", { id: r.id, approve: false, reason }, "Rejected."); }}>Reject</Button>
              </span>
            ),
          },
        ]}
      />

      <h2 className="mb-2 mt-8 font-display text-2xl">Proof awaiting review</h2>
      <Table<Disb>
        rows={proofs}
        empty="No proof waiting."
        cols={[
          { head: "Amount", cell: (r) => formatRupees(r.amount) },
          { head: "", cell: (r) => <Button className="!min-h-9 !px-3" disabled={act.busy} onClick={() => act.run("verifyDisbursementProof", { id: r.id }, "Proof verified.")}>Mark proof verified</Button> },
        ]}
      />

      <div className="mt-8"><Settings /></div>
    </>
  );
}

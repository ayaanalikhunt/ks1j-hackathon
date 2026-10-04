"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";
import { CASE_STATUS_LABELS, FUND_LABELS, NEED_CATEGORIES, PURPOSE_LABELS, csvRow, formatDate, formatRupees, isAdminLike, parseDmy } from "@ks1j/shared";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { downloadText } from "@/lib/download";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Bucket { key: string; amount: number; count: number; allocated: number; disbursed: number }
interface Report {
  totals: { verifiedDonations: number; donationCount: number; allocated: number; unallocated: number; disbursed: number; pendingDisbursement: number; refunded: number; awaitingVerification: number };
  byPurpose: Bucket[];
  byFund: Bucket[];
  byCurrency: Bucket[];
  byCategory: Bucket[];
  cases: { reference: string | null; status: string; requested: number; raised: number; allocated: number; disbursed: number }[];
  pipeline: Record<string, number>;
  loans: { count: number; active: number; lent: number; repaid: number; outstanding: number; pendingApproval: number };
  donationVsLoan: { donations: number; loansLent: number; loansRepaid: number };
  reconciliation: { ok: boolean; warnings: { donation: string; problem: string }[] };
  rows: { reference: string; date: string | null; amount: number; originalAmount: number; originalCurrency: string; purpose: string | null; fund: string | null; status: string; allocated: number; disbursed: number }[];
}

const run = httpsCallable<unknown, Report>(getFunctions(auth.app, "asia-south1"), "getFinancialReport");
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "QAR", "KWD"];

const Stat = ({ label, value, note }: { label: string; value: string | number; note?: string }) => (
  <Card>
    <p className="num text-2xl font-semibold">{value}</p>
    <p className="mt-1 text-sm text-muted">{label}</p>
    {note && <p className="text-xs text-muted">{note}</p>}
  </Card>
);

function Breakdown({ title, rows, label }: { title: string; rows: Bucket[]; label: (k: string) => string }) {
  return (
    <Card className="overflow-x-auto">
      <h3 className="font-display text-lg">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing for these filters.</p>
      ) : (
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-muted"><tr><th className="py-1 pr-3">Name</th><th className="pr-3">Amount</th><th className="pr-3">Allocated</th><th>Paid out</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="py-1 pr-3">{label(r.key)}</td>
                <td className="num pr-3">{formatRupees(r.amount)}</td>
                <td className="num pr-3">{formatRupees(r.allocated)}</td>
                <td className="num">{formatRupees(r.disbursed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

const sel = "min-h-12 w-full rounded-xl border border-line bg-bg px-3";

export default function Reports() {
  const { member } = useAuth();
  const staff = useCollection<{ fullName: string; role: string }>("members");
  const [f, setF] = useState({ from: "", to: "", category: "", status: "", currency: "", caseRef: "", memberId: "" });
  const [r, setR] = useState<Report | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function go() {
    setMsg(null);
    const from = f.from ? parseDmy(f.from) : "";
    const to = f.to ? parseDmy(f.to) : "";
    if ((f.from && !from) || (f.to && !to)) return setMsg("Dates must be DD/MM/YYYY.");
    setBusy(true);
    try {
      setR((await run({ ...f, from, to })).data);
    } catch (e) {
      setR(null);
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!r) return;
    const head = csvRow(["Reference", "Date", "Amount (INR)", "Original amount", "Currency", "Purpose", "Fund", "Status", "Allocated", "Disbursed"]);
    const body = r.rows.map((x) => csvRow([x.reference, x.date ? formatDate(new Date(x.date)) : "", x.amount, x.originalAmount, x.originalCurrency, PURPOSE_LABELS[x.purpose ?? ""] ?? "", FUND_LABELS[x.fund ?? ""] ?? "", x.status, x.allocated, x.disbursed]));
    downloadText("ks1j-report.csv", [head, ...body].join("\n"));
  }

  if (member && !isAdminLike(member.role)) return <Banner kind="error">Reports are for admins.</Banner>;
  const t = r?.totals;
  const p = r?.pipeline;

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Reports" intro="Added up on the server from verified payments, allocations, payouts, cases and loans. No donor or family is named." />

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="From (DD/MM/YYYY)" value={f.from} onChange={set("from")} placeholder="01/10/2026" />
          <Field label="To (DD/MM/YYYY)" value={f.to} onChange={set("to")} placeholder="31/10/2026" />
          <label className="block"><span className="mb-1 block text-sm font-medium">Purpose</span>
            <select className={sel} value={f.category} onChange={set("category")}><option value="">All</option>{Object.entries(PURPOSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Status</span>
            <select className={sel} value={f.status} onChange={set("status")}><option value="">All</option><option value="paid">Verified</option><option value="pending">Awaiting verification</option><option value="refunded">Refunded</option></select></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Original currency</span>
            <select className={sel} value={f.currency} onChange={set("currency")}><option value="">All</option>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <Field label="Case (CASE-2026-000184)" value={f.caseRef} onChange={set("caseRef")} />
          <label className="block"><span className="mb-1 block text-sm font-medium">Committee member</span>
            <select className={sel} value={f.memberId} onChange={set("memberId")}><option value="">Anyone</option>{staff.rows.filter((m) => m.role !== "member").map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={go} disabled={busy}>{busy ? "Running…" : "Run report"}</Button>
          {r && <Button className="!bg-card !text-[var(--fg)] border border-line" onClick={exportCsv}>Download CSV</Button>}
          {r && <Button className="!bg-card !text-[var(--fg)] border border-line" onClick={() => window.print()}>Print</Button>}
        </div>
        {msg && <div className="mt-3"><Banner kind="error">{msg}</Banner></div>}
        <p className="mt-3 text-xs text-muted">With a case selected, each donation counts only for the part allocated to that case. The committee-member filter matches who approved an allocation or paid out.</p>
      </Card>

      {!r && !msg && <Banner>Choose filters (or none) and run the report.</Banner>}

      {r && t && p && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Verified donations" value={formatRupees(t.verifiedDonations)} note={`${t.donationCount} donations`} />
            <Stat label="Allocated" value={formatRupees(t.allocated)} />
            <Stat label="Unallocated" value={formatRupees(t.unallocated)} />
            <Stat label="Paid out" value={formatRupees(t.disbursed)} />
            <Stat label="Pending payout" value={formatRupees(t.pendingDisbursement)} note="Allocated, not yet paid out" />
            <Stat label="Refunded" value={formatRupees(t.refunded)} />
            <Stat label="Awaiting verification" value={formatRupees(t.awaitingVerification)} note="Not counted anywhere above" />
            <Card>
              <p className={`text-2xl font-semibold ${r.reconciliation.ok ? "" : "text-red-600"}`}>{r.reconciliation.ok ? "Reconciled" : `${r.reconciliation.warnings.length} problem(s)`}</p>
              <p className="mt-1 text-sm text-muted">Donation = allocations + unallocated</p>
            </Card>
          </div>
          {!r.reconciliation.ok && <ul className="list-disc pl-5 text-sm text-red-600">{r.reconciliation.warnings.map((w, i) => <li key={i}>{w.donation}: {w.problem}</li>)}</ul>}

          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title="By donation purpose" rows={r.byPurpose} label={(k) => PURPOSE_LABELS[k] ?? k} />
            <Breakdown title="By fund" rows={r.byFund} label={(k) => FUND_LABELS[k] ?? k} />
            <Breakdown title="By allocation category" rows={r.byCategory} label={(k) => PURPOSE_LABELS[k] ?? NEED_CATEGORIES[k] ?? k} />
            <Breakdown title="By original currency (value in rupees)" rows={r.byCurrency} label={(k) => k} />
          </div>

          <Card className="overflow-x-auto">
            <h3 className="font-display text-lg">By case</h3>
            {r.cases.length === 0 ? <p className="mt-2 text-sm text-muted">No allocations for these filters.</p> : (
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-muted"><tr><th className="py-1 pr-3">Case</th><th className="pr-3">Status</th><th className="pr-3">Requested</th><th className="pr-3">Raised</th><th className="pr-3">Allocated</th><th>Paid out</th></tr></thead>
                <tbody>{r.cases.map((c, i) => (
                  <tr key={`${c.reference}-${i}`} className="border-t border-line">
                    <td className="py-1 pr-3"><code>{c.reference}</code></td><td className="pr-3">{CASE_STATUS_LABELS[c.status] ?? c.status}</td>
                    <td className="num pr-3">{formatRupees(c.requested)}</td><td className="num pr-3">{formatRupees(c.raised)}</td><td className="num pr-3">{formatRupees(c.allocated)}</td><td className="num">{formatRupees(c.disbursed)}</td>
                  </tr>))}</tbody>
              </table>
            )}
          </Card>

          <div>
            <h3 className="mb-2 font-display text-lg">Case pipeline (all cases, not filtered)</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Pending verification" value={p.pendingVerification} />
              <Stat label="Awaiting approval" value={p.awaitingApproval} />
              <Stat label="Awaiting publishing" value={p.awaitingPublish} />
              <Stat label="Open for funding" value={p.fundingOpen} note={`${formatRupees(p.stillNeeded)} still needed`} />
              <Stat label="Funded, awaiting payout" value={p.fundedAwaitingPayout} />
              <Stat label="Paid out, not yet closed" value={p.paidOutNotClosed} />
              <Stat label="Completed" value={p.completed} />
              <Stat label="Outstanding" value={p.outstanding} note="Open for funding, or funded and waiting for payout" />
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-display text-lg">Donations and loans (kept separate)</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Donations (verified)" value={formatRupees(r.donationVsLoan.donations)} note="Given, not repaid" />
              <Stat label="Loans lent" value={formatRupees(r.loans.lent)} note={`${r.loans.count} loans`} />
              <Stat label="Loans repaid" value={formatRupees(r.loans.repaid)} />
              <Stat label="Loans outstanding" value={formatRupees(r.loans.outstanding)} note={`${r.loans.active} active · ${r.loans.pendingApproval} awaiting a decision`} />
            </div>
            <p className="mt-2 text-xs text-muted">Loan figures are not filtered by date, purpose or currency.</p>
          </div>
        </div>
      )}
    </>
  );
}

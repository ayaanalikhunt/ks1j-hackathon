"use client";

import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { LAWAJAM_YEAR_PATTERN, formatRupees, isAdminLike, lawajamYear, toCsv } from "@ks1j/shared";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { downloadText } from "@/lib/download";
import { useCollection } from "@/lib/useCollection";

interface Household {
  name: string;
  area: string;
  address?: string;
}
interface LawajamRecord {
  householdId: string;
  householdName: string;
  area: string;
  year: string;
  amount: number;
  status: "due" | "paid";
}
interface M {
  fullName: string;
  householdId?: string;
}

export default function AdminLawajam() {
  const { user, member } = useAuth();
  const canEdit = isAdminLike(member?.role);
  const households = useCollection<Household>("households");
  const records = useCollection<LawajamRecord>("lawajamRecords");
  const members = useCollection<M>("members");
  const [year, setYear] = useState(lawajamYear());
  const [amount, setAmount] = useState("1200");
  const [hName, setHName] = useState("");
  const [hArea, setHArea] = useState("");
  const [viewYear, setViewYear] = useState(lawajamYear());
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const yearOk = LAWAJAM_YEAR_PATTERN.test(year);
  const amt = Math.trunc(Number(amount));

  async function raise() {
    setBusy(true);
    setMsg(null);
    try {
      // One due per household per year: the id is "<household>_<year>", so existing ones are skipped, never overwritten.
      const have = new Set(records.rows.map((r) => r.id));
      let made = 0;
      for (const h of households.rows) {
        const id = `${h.id}_${year}`;
        if (have.has(id)) continue;
        await setDoc(doc(db, "lawajamRecords", id), {
          householdId: h.id,
          householdName: h.name,
          area: h.area,
          year,
          amount: amt,
          status: "due",
          createdAt: serverTimestamp(),
          createdBy: user!.uid,
        });
        made++;
      }
      setViewYear(year);
      setMsg({ error: false, text: made === 0 ? "Every household already has a due for that year." : `Raised ${year} dues for ${made} household${made === 1 ? "" : "s"}.` });
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function addHousehold() {
    setBusy(true);
    setMsg(null);
    try {
      await addDoc(collection(db, "households"), { name: hName.trim(), area: hArea.trim(), createdBy: user!.uid, createdAt: serverTimestamp() });
      setHName("");
      setMsg({ error: false, text: "Household added. Link members to it from the Members page." });
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const ofYear = records.rows.filter((r) => r.year === viewYear);
  const collected = ofYear.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const outstanding = ofYear.filter((r) => r.status === "due").reduce((s, r) => s + r.amount, 0);
  const paidCount = ofYear.filter((r) => r.status === "paid").length;
  const years = [...new Set(records.rows.map((r) => r.year))].sort().reverse();
  const areas = [...new Set(ofYear.map((r) => r.area || "No area"))].sort();
  const namesIn = (hid: string) => members.rows.filter((m) => m.householdId === hid).map((m) => m.fullName).join(", ") || "No members linked";
  const unpaid = ofYear.filter((r) => r.status === "due");

  const copyReminders = () =>
    navigator.clipboard
      .writeText(unpaid.map((r) => `${r.householdName} (${r.area}): ${namesIn(r.householdId)} - ${formatRupees(r.amount)} due for ${r.year}`).join("\n"))
      .then(() => setMsg({ error: false, text: `Copied ${unpaid.length} households to your clipboard.` }));
  const exportYear = () =>
    downloadText(
      `ks1j-lawajam-${viewYear}.csv`,
      toCsv(
        ["Area", "Household", "Members", "Year", "Amount (INR)", "Status"],
        ofYear.map((r) => [r.area, r.householdName, namesIn(r.householdId), r.year, r.amount, r.status === "paid" ? "Paid" : "Due"]),
      ),
    );

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Lawajam" intro="Yearly membership dues per household. Kept in their own ledger, never mixed with Khums or cases." />
      {msg && <div className="mb-3"><Banner kind={msg.error ? "error" : "info"}>{msg.text}</Banner></div>}

      {canEdit && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="font-display text-xl">Raise dues for a year</h2>
            <p className="text-sm text-muted">Creates a due for every household that does not have one for that year yet.</p>
            <Field label="Year (for example 2027-28)" value={year} onChange={(e) => setYear(e.target.value)} />
            <Field label="Amount per household (₹)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button disabled={busy || !yearOk || !(amt > 0) || households.rows.length === 0} onClick={raise}>Raise dues</Button>
            {households.rows.length === 0 && <p className="text-sm text-muted">Add a household first.</p>}
          </Card>
          <Card className="space-y-3">
            <h2 className="font-display text-xl">Add a household</h2>
            <Field label="Household name" value={hName} onChange={(e) => setHName(e.target.value)} />
            <Field label="Area (for example Andheri)" value={hArea} onChange={(e) => setHArea(e.target.value)} />
            <Button disabled={busy || !hName.trim() || !hArea.trim()} onClick={addHousehold}>Add household</Button>
          </Card>
        </div>
      )}

      {years.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {years.map((y) => (
            <button key={y} onClick={() => setViewYear(y)} className={`min-h-10 rounded-full border px-4 text-sm ${viewYear === y ? "border-brand bg-brand/15 font-semibold" : "border-line bg-card"}`}>
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card><p className="text-sm text-muted">Collected</p><p className="num text-2xl">{formatRupees(collected)}</p></Card>
        <Card><p className="text-sm text-muted">Outstanding</p><p className="num text-2xl">{formatRupees(outstanding)}</p></Card>
        <Card className="col-span-2 md:col-span-1"><p className="text-sm text-muted">Households paid</p><p className="num text-2xl">{paidCount} / {ofYear.length}</p></Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button className="!min-h-10 !px-4" onClick={exportYear} disabled={ofYear.length === 0}>Download {viewYear} for Excel</Button>
        <Button className="!min-h-10 !px-4 !bg-card !text-fg border border-line" onClick={copyReminders} disabled={unpaid.length === 0}>Copy reminder list ({unpaid.length})</Button>
      </div>

      {ofYear.length === 0 && <Banner>Nothing has been raised yet. Add households, link members to them, then raise the dues.</Banner>}
      {areas.map((area) => {
        const rows = ofYear.filter((r) => (r.area || "No area") === area);
        const paid = rows.filter((r) => r.status === "paid").length;
        return (
          <Card key={area} className="mb-3">
            <h3 className="text-lg">{area} <span className="text-sm font-normal text-muted">({paid}/{rows.length} paid)</span></h3>
            <ul className="mt-2 divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-semibold">{r.householdName}</span>
                    <span className="block text-sm text-muted">{namesIn(r.householdId)}</span>
                  </span>
                  <span className="num text-sm">{formatRupees(r.amount)} · {r.status === "paid" ? "Paid" : "Due"}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </>
  );
}

"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useEffect, useState } from "react";
import { csvRow, formatDate, formatRupees, isAdminLike } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { downloadText } from "@/lib/download";
import { auth } from "@/lib/firebase";

interface DonorRow {
  id: string;
  name: string;
  country: string | null;
  preferredCurrency: string | null;
  hasProfile: boolean;
  donationCount: number;
  totalDonated: number;
  lastDonationAt: string | null;
}

const list = httpsCallable<unknown, { donors: DonorRow[] }>(getFunctions(auth.app, "asia-south1"), "listDonors");

export default function Donors() {
  const { member } = useAuth();
  const admin = !member || isAdminLike(member.role);
  const [rows, setRows] = useState<DonorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!admin) return;
    let live = true;
    list({})
      .then((r) => live && setRows(r.data.donors))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [admin]);

  if (!admin) return <Banner kind="error">Donor details are for admins.</Banner>;
  const shown = (rows ?? []).filter((d) => !text || `${d.name} ${d.country ?? ""}`.toLowerCase().includes(text.toLowerCase()));

  function exportCsv() {
    const head = csvRow(["Name", "Country", "Preferred currency", "Verified donations", "Total (INR)", "Last donation"]);
    downloadText("ks1j-donors.csv", [head, ...shown.map((d) => csvRow([d.name, d.country ?? "", d.preferredCurrency ?? "", d.donationCount, d.totalDonated, d.lastDonationAt ? formatDate(new Date(d.lastDonationAt)) : ""]))].join("\n"));
  }

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Donors" intro="Who has given, and how much. A donor's identity is private: only admins see it, and every time you open a donor's details it is recorded in the audit log." />
      {error && <Banner kind="error">{error}</Banner>}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="min-h-11 rounded-xl border border-line bg-bg px-3" placeholder="Search a name or country" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search donors" />
        <Button className="!min-h-11 !px-4" onClick={exportCsv} disabled={shown.length === 0}>Download CSV</Button>
        {rows && <span className="text-sm text-muted">{shown.length} of {rows.length} donors</span>}
      </div>
      {rows === null && !error && <p className="text-muted">Loading…</p>}
      {rows && (
        <Table<DonorRow>
          rows={shown}
          empty="No donors yet."
          cols={[
            { head: "Donor", cell: (r) => <Link className="font-semibold underline" href={`/admin/donors/detail?id=${r.id}`}>{r.name}</Link> },
            { head: "Country", cell: (r) => r.country ?? "" },
            { head: "Currency", cell: (r) => r.preferredCurrency ?? "" },
            { head: "Verified gifts", cell: (r) => r.donationCount },
            { head: "Total given", cell: (r) => formatRupees(r.totalDonated) },
            { head: "Last gift", cell: (r) => (r.lastDonationAt ? formatDate(new Date(r.lastDonationAt)) : "") },
            { head: "Profile", cell: (r) => (r.hasProfile ? "Yes" : "Not set up") },
          ]}
        />
      )}
    </>
  );
}

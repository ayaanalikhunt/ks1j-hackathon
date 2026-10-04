"use client";

import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DONOR_CURRENCIES, DONOR_NOTIFICATION_KEYS, DONOR_NOTIFICATION_LABELS, donorWants, type DonorNotificationKey } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";

export interface DonorProfile {
  fullName?: string;
  displayName?: string;
  phone?: string;
  country?: string;
  preferredCurrency?: string;
  notifications?: Partial<Record<DonorNotificationKey, boolean>>;
}

function Form({ uid, email, saved, fallbackName, fallbackPhone }: { uid: string; email: string; saved: DonorProfile | null; fallbackName: string; fallbackPhone: string }) {
  // Edits live in state; until the donor edits a field, it shows what is saved (or what the member profile already knows).
  const [edit, setEdit] = useState<DonorProfile>({});
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const v = {
    fullName: edit.fullName ?? saved?.fullName ?? fallbackName,
    displayName: edit.displayName ?? saved?.displayName ?? "",
    phone: edit.phone ?? saved?.phone ?? fallbackPhone,
    country: edit.country ?? saved?.country ?? "India",
    preferredCurrency: edit.preferredCurrency ?? saved?.preferredCurrency ?? "INR",
    notifications: { ...saved?.notifications, ...edit.notifications },
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const data = {
        donorId: uid,
        fullName: v.fullName.trim(),
        displayName: v.displayName.trim(),
        email,
        phone: v.phone.trim(),
        country: v.country.trim(),
        preferredCurrency: v.preferredCurrency,
        notifications: Object.fromEntries(DONOR_NOTIFICATION_KEYS.map((k) => [k, donorWants(v.notifications, k)])),
        updatedAt: serverTimestamp(),
      };
      if (saved) await updateDoc(doc(db, "donors", uid), data);
      else await setDoc(doc(db, "donors", uid), { ...data, createdAt: serverTimestamp() });
      setEdit({});
      setMsg({ error: false, text: "Saved." });
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="mb-4 space-y-3">
        <h2 className="font-display text-xl">Your details</h2>
        <Field label="Full name" value={v.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} maxLength={80} />
        <Field label="Name to show publicly (only if you choose “public” on a donation)" value={v.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })} maxLength={60} />
        <Field label="Phone" value={v.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} maxLength={25} />
        <Field label="Country" value={v.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} maxLength={60} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Preferred currency</span>
          <select className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" value={v.preferredCurrency} onChange={(e) => setEdit({ ...edit, preferredCurrency: e.target.value })}>
            {DONOR_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <p className="text-sm text-muted">Email: {email} (from your sign-in). Only committee staff can see your details, and never on a public page unless you choose it.</p>
      </Card>

      <Card className="mb-4 space-y-2">
        <h2 className="font-display text-xl">Notifications</h2>
        <p className="text-sm text-muted">These appear in the app and on My donations. Email and SMS are not offered yet.</p>
        {DONOR_NOTIFICATION_KEYS.map((k) => (
          <label key={k} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={donorWants(v.notifications, k)} onChange={(e) => setEdit({ ...edit, notifications: { ...edit.notifications, [k]: e.target.checked } })} />
            {DONOR_NOTIFICATION_LABELS[k]}
          </label>
        ))}
      </Card>

      {msg && <div className="mb-3"><Banner kind={msg.error ? "error" : "info"}>{msg.text}</Banner></div>}
      <Button onClick={save} disabled={busy || !v.fullName.trim()}>{busy ? "Saving…" : "Save"}</Button>
    </>
  );
}

export default function DonorProfilePage() {
  const { user, member } = useAuth();
  const [saved, setSaved] = useState<DonorProfile | null | undefined>(undefined);
  useEffect(() => (user ? onSnapshot(doc(db, "donors", user.uid), (s) => setSaved(s.exists() ? (s.data() as DonorProfile) : null), () => setSaved(null)) : undefined), [user]);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader eyebrow="Your giving" title="Profile and notifications" intro="Used to pre-fill the donation form and to decide which updates you receive." />
        <Link href="/donations" className="mb-4 inline-block text-sm font-semibold underline">← My donations</Link>
        {!user && <Banner>Please <Link className="underline" href="/login">sign in</Link>.</Banner>}
        {user && saved === undefined && <p className="text-muted">Loading…</p>}
        {user && saved !== undefined && (
          <Form key={saved ? "saved" : "new"} uid={user.uid} email={user.email ?? ""} saved={saved} fallbackName={member?.fullName ?? ""} fallbackPhone={(member as { phone?: string } | null)?.phone ?? ""} />
        )}
      </main>
    </>
  );
}

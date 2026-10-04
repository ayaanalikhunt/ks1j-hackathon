"use client";

import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { formatRupees, isAdminLike } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { compressImage } from "@/lib/image";
import { useDocs } from "@/lib/documents";
import { useCollection } from "@/lib/useCollection";

interface Institution {
  name: string;
  city?: string;
  marja?: string;
  ijazahVerified: boolean;
  addedBy?: string;
  verifiedBy?: string;
  receiving?: boolean;
  received?: number;
  handedOver?: number;
}

/** The ijazah photo is in a staff-only subcollection, loaded only when someone asks to see it. */
function IjazahPhoto({ id }: { id: string }) {
  const docs = useDocs<{ kind: string }>("institutions", id);
  const url = docs.rows[0]?.dataUrl;
  if (docs.loading) return <p className="text-sm text-muted">Loading…</p>;
  if (!url) return <p className="text-sm text-muted">{docs.error ?? "No ijazah photo was attached."}</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Ijazah" className="max-h-72 rounded-lg border border-line bg-white object-contain" />;
}

export default function AdminInstitutions() {
  const { user, member } = useAuth();
  const uid = user?.uid ?? "";
  const { rows, error } = useCollection<Institution>("institutions");
  const members = useCollection<{ fullName: string }>("members");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [marja, setMarja] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const canAdd = member?.role === "trustee" || isAdminLike(member?.role);
  const nameOf = (u?: string) => members.rows.find((m) => m.id === u)?.fullName ?? "A trustee";

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ error: false, text: ok });
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const add = () =>
    run(async () => {
      const ref = await addDoc(collection(db, "institutions"), {
        name: name.trim(),
        city: city.trim(),
        marja: marja.trim(),
        ijazahVerified: false,
        addedBy: uid,
        receiving: true,
        createdAt: serverTimestamp(),
      });
      if (photo) {
        const dataUrl = await compressImage(photo);
        await addDoc(collection(db, "institutions", ref.id, "documents"), { kind: "ijazah", name: photo.name, dataUrl, uploadedAt: serverTimestamp(), addedBy: uid });
      }
      setName("");
      setCity("");
      setMarja("");
      setPhoto(null);
    }, "Added. A different trustee must now check the ijazah before members can see it.");

  const verify = (id: string) =>
    run(() => updateDoc(doc(db, "institutions", id), { ijazahVerified: true, verifiedBy: uid, verifiedAt: serverTimestamp() }), "Verified. Members can now give Sehme Imam to this institution.");
  const toggle = (id: string, receiving: boolean) => run(() => updateDoc(doc(db, "institutions", id), { receiving: !receiving }), receiving ? "Gifts paused." : "Gifts resumed.");

  const waiting = rows.filter((i) => !i.ijazahVerified);
  const verified = rows.filter((i) => i.ijazahVerified);

  return (
    <>
      <PageHeader
        eyebrow="Committee dashboard"
        title="Sehme Imam institutions"
        intro="Sehme Imam goes only to institutions holding an ijazah from a Marja'. One trustee adds, a different trustee verifies."
      />
      {msg && <div className="mb-3"><Banner kind={msg.error ? "error" : "info"}>{msg.text}</Banner></div>}

      {canAdd && (
        <Card className="mb-6 space-y-3">
          <h2 className="font-display text-xl">Add an institution</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Field label="Marja' who granted the ijazah" value={marja} onChange={(e) => setMarja(e.target.value)} />
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Ijazah document (photo)</span>
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <Button disabled={busy || !name.trim() || !city.trim() || !marja.trim() || !photo} onClick={add}>Add institution</Button>
        </Card>
      )}

      <h2 className="mb-1 font-display text-2xl">Waiting for ijazah verification</h2>
      <p className="mb-3 text-muted">Hidden from members until verified.</p>
      <div className="mb-8 space-y-3">
        {waiting.length === 0 && <Banner>Nothing is waiting.</Banner>}
        {waiting.map((i) => {
          const mine = i.addedBy === uid;
          return (
            <Card key={i.id} className="space-y-2">
              <h3 className="text-lg">{i.name}</h3>
              <p className="text-sm text-muted">{i.city} · Ijazah from {i.marja} · Added by {nameOf(i.addedBy)}</p>
              <Button className="!min-h-10 !bg-card !px-4 !text-fg border border-line" onClick={() => setOpen(open === i.id ? null : i.id)}>
                {open === i.id ? "Hide ijazah" : "View ijazah"}
              </Button>
              {open === i.id && <IjazahPhoto id={i.id} />}
              {canAdd &&
                (mine ? (
                  <p className="text-sm text-muted">You added this one, so a different trustee must verify it.</p>
                ) : (
                  <Button disabled={busy} onClick={() => verify(i.id)}>I checked the ijazah: verify</Button>
                ))}
            </Card>
          );
        })}
      </div>

      <h2 className="mb-2 font-display text-2xl">Verified</h2>
      <Table<Institution>
        rows={verified}
        error={error}
        empty="No verified institutions yet."
        cols={[
          { head: "Institution", cell: (r) => (<span><span className="font-semibold">{r.name}</span><span className="block text-sm text-muted">{r.city}</span></span>) },
          { head: "Marja'", cell: (r) => r.marja ?? "" },
          { head: "Verified by", cell: (r) => nameOf(r.verifiedBy) },
          { head: "Held", cell: (r) => formatRupees((r.received ?? 0) - (r.handedOver ?? 0)) },
          { head: "Status", cell: (r) => (r.receiving === false ? "Paused" : "Receiving") },
          {
            head: "",
            cell: (r) =>
              isAdminLike(member?.role) && (
                <button className="underline" disabled={busy} onClick={() => toggle(r.id, r.receiving !== false)}>
                  {r.receiving === false ? "Resume" : "Pause"}
                </button>
              ),
          },
        ]}
      />
    </>
  );
}

"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { useMemo, useState } from "react";
import { PENDING_MOSQUE_CANDIDATES, findPossibleDuplicates, formatDateTime, hasVerifiedPin, type MosqueVenue } from "@ks1j/shared";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { useMosques } from "@/lib/useMosques";

const verify = httpsCallable<{ id: string; changes: Record<string, unknown>; reason?: string }, { changed: string[] }>(getFunctions(auth.app, "asia-south1"), "verifyMosque");

const VERIFICATION = ["PENDING_VERIFICATION", "VOLUNTEER_VERIFIED", "OFFICIALLY_VERIFIED", "SOURCE_CONFLICT", "MAP_UNVERIFIED", "CLOSED", "RELOCATED", "REMOVED"];
const JUMMAH = ["YES", "LIKELY", "NO", "UNCONFIRMED"];

function Editor({ m, onDone }: { m: MosqueVenue; onDone: () => void }) {
  const friday = m.jummahSchedules?.[0];
  const [f, setF] = useState({
    verificationStatus: m.verificationStatus,
    jummahStatus: m.jummahStatus,
    latitude: m.latitude?.toString() ?? "",
    longitude: m.longitude?.toString() ?? "",
    phone: m.phone ?? "",
    photoUrl: m.photoUrl ?? "",
    address: m.address,
    fridayTime: friday?.time ?? "",
    fridaySource: friday?.source ?? "",
    reason: "",
  });
  const [msg, setMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    setMsg(null);
    const changes: Record<string, unknown> = {
      verificationStatus: f.verificationStatus,
      jummahStatus: f.jummahStatus,
      phone: f.phone.trim(),
      photoUrl: f.photoUrl.trim(),
      address: f.address.trim(),
      jummahSchedules: f.fridayTime ? [{ day: "FRIDAY", time: f.fridayTime, status: "VERIFIED", source: f.fridaySource.trim() }] : [],
    };
    if (f.latitude.trim() || f.longitude.trim()) {
      changes.latitude = Number(f.latitude);
      changes.longitude = Number(f.longitude);
    }
    try {
      const r = await verify({ id: m.id, changes, reason: f.reason.trim() || undefined });
      setMsg({ kind: "info", text: r.data.changed.length ? `Saved: ${r.data.changed.join(", ")}. Recorded in the audit log.` : "Nothing had changed." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const sel = "min-h-12 w-full rounded-xl border border-line bg-bg px-3";
  return (
    <Card className="mt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-medium">Verification</span>
          <select className={sel} value={f.verificationStatus} onChange={set("verificationStatus")}>{VERIFICATION.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Jummah</span>
          <select className={sel} value={f.jummahStatus} onChange={set("jummahStatus")}>{JUMMAH.map((v) => <option key={v}>{v}</option>)}</select></label>
        <Field label="Latitude (checked on the map)" inputMode="decimal" value={f.latitude} onChange={set("latitude")} placeholder="e.g. 18.9551" />
        <Field label="Longitude" inputMode="decimal" value={f.longitude} onChange={set("longitude")} placeholder="e.g. 72.8338" />
        <Field label="Phone" value={f.phone} onChange={set("phone")} />
        <Field label="Photo link (https)" value={f.photoUrl} onChange={set("photoUrl")} />
        <div className="sm:col-span-2"><Field label="Address" value={f.address} onChange={set("address")} /></div>
        <Field label="Verified Friday time (24-hour, leave empty if not confirmed)" value={f.fridayTime} onChange={set("fridayTime")} placeholder="13:30" />
        <Field label="How was the time confirmed?" value={f.fridaySource} onChange={set("fridaySource")} placeholder="Called the trustee on 2 Oct" />
        <div className="sm:col-span-2"><Field label="Note for the audit log" value={f.reason} onChange={set("reason")} /></div>
      </div>
      <p className="mt-2 text-sm text-muted">A venue can only be marked verified once it has a map pin you have checked. Never enter a time you have not confirmed.</p>
      {msg && <div className="mt-3"><Banner kind={msg.kind}>{msg.text}</Banner></div>}
      <div className="mt-3 flex gap-2">
        <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
        <button onClick={onDone} className="min-h-12 rounded-xl border border-line px-5 font-semibold">Close</button>
      </div>
    </Card>
  );
}

export default function AdminMosques() {
  const { mosques, live } = useMosques();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const rows = useMemo(() => mosques.filter((m) => `${m.name} ${m.area} ${m.city}`.toLowerCase().includes(q.toLowerCase())), [mosques, q]);
  const done = mosques.filter((m) => m.verificationStatus === "VOLUNTEER_VERIFIED" || m.verificationStatus === "OFFICIALLY_VERIFIED").length;

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Mosque verification" intro={`${done} of ${mosques.length} venues verified. Check each venue yourself (call or visit), then record what you found.`} />
      {!live && <div className="mb-4"><Banner kind="error">The mosques collection is empty, so nothing here can be saved yet. Run <code>node tools/seed/seed-mosques.mjs</code> once to load the 36 source venues.</Banner></div>}
      <Card className="mb-4">
        <h2 className="font-display text-xl">Unresolved names from members</h2>
        <p className="mt-1 text-sm text-muted">Never merged automatically. Check each one and, if it is the same place, add the name as an alias when you verify that venue.</p>
        <ul className="mt-3 space-y-2">
          {PENDING_MOSQUE_CANDIDATES.map((c) => {
            const hits = findPossibleDuplicates({ name: c.submittedName }, mosques);
            return (
              <li key={c.id} className="rounded-xl border border-line p-3 text-sm">
                <p className="font-semibold">{c.submittedName}</p>
                {c.notes && <p className="text-muted">{c.notes}</p>}
                <p className="mt-1">
                  {hits.length === 0
                    ? "No likely match in the directory. Verify separately."
                    : `Possible match: ${hits.map((h) => `${h.mosque.name} (${h.confidence.toLowerCase()}: ${h.reasons.join(", ")})`).join("; ")}`}
                </p>
              </li>
            );
          })}
        </ul>
      </Card>
      <div className="mb-4"><Field label="Find a venue" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="space-y-3">
        {rows.map((m) => (
          <div key={m.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-xl">{m.name}</h3>
                  <p className="text-sm text-muted">{m.area}, {m.city} · Jummah {m.jummahStatus} · {m.verificationStatus.replace(/_/g, " ").toLowerCase()}</p>
                  <p className="text-sm text-muted">Map pin: {hasVerifiedPin(m) ? "checked" : m.latitude ? "entered, not yet verified" : "missing"}{m.lastCheckedAt ? ` · last checked ${formatDateTime(new Date(m.lastCheckedAt))}` : ""}</p>
                </div>
                <button disabled={!live} onClick={() => setOpen(open === m.id ? null : m.id)} className="min-h-12 rounded-xl border border-line px-5 font-semibold disabled:opacity-50">{open === m.id ? "Close" : "Verify"}</button>
              </div>
            </Card>
            {open === m.id && <Editor m={m} onDone={() => setOpen(null)} />}
          </div>
        ))}
      </div>
    </>
  );
}

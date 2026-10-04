"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MOSQUES,
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  extractMosqueQuery,
  findNearbyShiaMosques,
  hasVerifiedPin,
  isFriday,
  searchFriday,
  searchMosques,
  type FridayCandidate,
  type MosqueVenue,
  type UserLocation,
} from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { getCurrentUserLocation, type LocationError } from "@/lib/location";

const JUMMAH_LABEL: Record<MosqueVenue["jummahStatus"], string> = {
  YES: "Jummah: reported in public reviews. Please confirm the time before travelling.",
  LIKELY: "Jummah: Likely. Please verify Friday timing before travelling.",
  NO: "Jummah: not held here (daily jamaat only).",
  UNCONFIRMED: "Jummah: not confirmed.",
};

const LOCATION_MESSAGE: Record<LocationError, string> = {
  LOCATION_PERMISSION_DENIED:
    "Location is switched off for this site. You can still search by name or area. To use near me, allow location in your browser settings and tap Use my location again.",
  LOCATION_UNAVAILABLE: "We could not work out where you are. You can still search by name or area.",
  LOCATION_TIMEOUT: "Finding your location took too long. Please try again, or search by name or area.",
  LOCATION_UNKNOWN_ERROR: "Something went wrong finding your location. You can still search by name or area.",
};

function VenueCard({ m, distanceKm }: { m: MosqueVenue; distanceKm?: number | null }) {
  const pin = hasVerifiedPin(m);
  const verified = m.verificationStatus === "VOLUNTEER_VERIFIED" || m.verificationStatus === "OFFICIALLY_VERIFIED";
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-xl">{m.name}</h3>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${verified ? "border-brand text-brand" : "border-line text-muted"}`}>
          {verified ? "Verified by volunteers" : "Awaiting verification"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {m.type} · {m.area}, {m.city}
      </p>
      <p className="mt-2">{m.address}</p>
      {typeof distanceKm === "number" && <p className="mt-1 text-sm font-medium">About {distanceKm.toFixed(1)} km away in a straight line</p>}
      <p className="mt-2 text-sm">{JUMMAH_LABEL[m.jummahStatus]}</p>
      {m.jummahSchedules
        ?.filter((s) => s.status === "VERIFIED")
        .map((s) => (
          <p key={s.time} className="text-sm font-medium">
            Friday {s.time} (verified)
          </p>
        ))}
      {m.sourceNote && <p className="mt-1 text-sm text-muted">Note: {m.sourceNote}</p>}
      {m.phone && (
        <p className="mt-1 text-sm">
          Phone:{" "}
          <a className="underline" href={`tel:${m.phone.replace(/\s+/g, "")}`}>
            {m.phone}
          </a>
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={buildGoogleMapsUrl(m)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-[var(--bg)]">
          {pin ? "Open in Maps" : "Search this address in Maps"}
        </a>
        <a href={buildAppleMapsUrl(m)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl border border-line px-5 font-semibold">
          Apple Maps
        </a>
      </div>
      {!pin && <p className="mt-2 text-xs text-muted">The exact map pin has not been checked yet, so the map searches by address.</p>}
    </Card>
  );
}

function Finder() {
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [text, setText] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);
  const [loc, setLoc] = useState<UserLocation | null>(null);
  const [locError, setLocError] = useState<LocationError | null>(null);
  const [asked, setAsked] = useState(false);
  const [friday, setFriday] = useState(() => isFriday());
  const [showUnconfirmed, setShowUnconfirmed] = useState(false);

  const parsed = useMemo(() => extractMosqueQuery(submitted), [submitted]);
  const wantsFriday = friday || parsed.intent === "FIND_NEAREST_FRIDAY_MASJID";
  const needLocation = parsed.requiresLocation && !loc;

  async function useLocation() {
    setAsked(true);
    setLocError(null);
    try {
      setLoc(await getCurrentUserLocation());
    } catch (e) {
      setLocError((e instanceof Error ? e.message : "LOCATION_UNKNOWN_ERROR") as LocationError);
    }
  }

  const matches = useMemo(() => searchMosques(parsed, MOSQUES), [parsed]);
  const nearby = useMemo(() => (loc ? findNearbyShiaMosques(loc, matches) : []), [loc, matches]);
  const fri = useMemo(() => searchFriday(loc, matches), [loc, matches]);

  const list: { m: MosqueVenue; d?: number | null }[] = wantsFriday
    ? fri.confirmed.map((r) => ({ m: r.mosque, d: r.distanceKm }))
    : loc && parsed.intent === "FIND_NEARBY_SHIA_MASJID" && nearby.length
      ? nearby.map((r) => ({ m: r.mosque, d: r.distanceKm }))
      : matches.map((m) => ({ m }));
  const fallback: FridayCandidate[] = wantsFriday && !fri.confirmed.length ? [...fri.likely, ...(showUnconfirmed ? fri.unconfirmed : [])] : [];

  return (
    <>
      <PageHeader eyebrow="Mosque finder" title="Find a Shia masjid" intro="Search by name or area, or use your location. Every listing says clearly whether it has been checked by volunteers." />

      {!asked && !loc && (
        <Card className="mb-4">
          <h2 className="font-display text-xl">Find a nearby Shia masjid</h2>
          <p className="mt-1 text-muted">
            Allow location so KS1J can show nearby masajid and, on Friday, help you find the nearest confirmed Jummah. Your location is used once for this search and is not saved.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={useLocation}>Allow location</Button>
            <button onClick={() => setAsked(true)} className="min-h-12 rounded-xl border border-line px-5 font-semibold">
              Not now
            </button>
          </div>
        </Card>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(text);
        }}
        className="mb-4 space-y-3"
      >
        <Field label="Search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Name, area or city. For example: Dongri Shia masjid" />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Search</Button>
          <button type="button" onClick={useLocation} className="min-h-12 rounded-xl border border-line px-5 font-semibold">
            {loc ? "Update my location" : "Use my location"}
          </button>
          <label className="flex min-h-12 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={friday} onChange={(e) => setFriday(e.target.checked)} /> Friday Jummah
          </label>
        </div>
      </form>

      {locError && (
        <div className="mb-4">
          <Banner kind="error">{LOCATION_MESSAGE[locError]}</Banner>
        </div>
      )}
      {needLocation && !locError && (
        <div className="mb-4">
          <Banner>To find the nearest masjid, tap Use my location. Showing every match in the meantime.</Banner>
        </div>
      )}
      {loc && (
        <div className="mb-4">
          <Banner>Distances are straight-line, not driving distance. Only masajid whose map pin has been checked by volunteers can be ranked by distance.</Banner>
        </div>
      )}
      {wantsFriday && (
        <div className="mb-4">
          <Banner>Exact Jummah times are only shown after a volunteer has confirmed them. Please confirm the time before you travel.</Banner>
        </div>
      )}

      {wantsFriday && !fri.confirmed.length && (
        <Card className="mb-4">
          <h2 className="font-display text-xl">We could not find a verified Friday Jamaat near you</h2>
          <p className="mt-1 text-muted">No masjid has been confirmed by volunteers for Friday yet. These are the ones reported as likely.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setShowUnconfirmed(true)} className="min-h-12 rounded-xl border border-line px-5 font-semibold">
              Show unconfirmed options too
            </button>
            <button onClick={() => setFriday(false)} className="min-h-12 rounded-xl border border-line px-5 font-semibold">
              Search all Shia masajid
            </button>
          </div>
        </Card>
      )}

      <div className="space-y-3" aria-live="polite">
        {[...list, ...fallback.map((c) => ({ m: c.mosque, d: c.distanceKm }))].map(({ m, d }) => (
          <VenueCard key={m.id} m={m} distanceKm={d} />
        ))}
        {!list.length && !fallback.length && !wantsFriday && <Banner>Nothing matched. Try just the area name, or clear the search to see every listing.</Banner>}
      </div>

      {process.env.NODE_ENV !== "production" && (
        <pre className="mt-6 overflow-x-auto rounded-xl border border-line p-3 text-xs">
          {`RAW: ${parsed.rawInput}\nNORMALIZED: ${parsed.normalizedInput}\nSCRIPT: ${parsed.script}\nINTENT: ${parsed.intent}\nCITY: ${parsed.city ?? "-"}\nAREA: ${parsed.area ?? "-"}\nQUERY: ${parsed.query}\nLOCATION REQUIRED: ${parsed.requiresLocation}\nJUMMAH: ${wantsFriday}`}
        </pre>
      )}
    </>
  );
}

export default function MosquesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <Suspense fallback={null}>
          <Finder />
        </Suspense>
      </main>
    </>
  );
}

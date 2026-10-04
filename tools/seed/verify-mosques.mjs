// One-off: the committee confirmed on 2026-10-04 that all 36 source venues are verified. The source list has no map pins,
// so each venue is pinned to the centre of the PIN code printed in its own address, looked up in OpenStreetMap (Nominatim,
// one request a second, as its usage policy asks). Name and street searches were tried first and were too often wrong.
// The pin is marked approximate (`pinPrecision: "postcode"`) so the finder says so, and maps links keep searching by name
// and address for these venues. No Friday time is added: none was supplied. Every change is written to the audit log.
//
//   gcloud auth application-default login     (once)
//   node tools/seed/verify-mosques.mjs        (from the repo root; add --dry to only print)
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DRY = process.argv.includes("--dry");
const BOX = { latMin: 18.8, latMax: 20.0, lngMin: 72.6, lngMax: 73.3 }; // same bounds verifyMosque enforces
const UA = "KS1J-mosque-directory/1.0 (https://ks1j-8a2e3.web.app)";

initializeApp({ credential: applicationDefault(), projectId: "ks1j-8a2e3" });
const db = getFirestore();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

async function geocode(params) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=in&${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
  await sleep(1100);
  if (!res.ok) return null;
  const hits = await res.json();
  for (const h of hits) {
    const lat = Number(h.lat), lng = Number(h.lon);
    if (lat >= BOX.latMin && lat <= BOX.latMax && lng >= BOX.lngMin && lng <= BOX.lngMax) {
      return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
    }
  }
  return null;
}

const snap = await db.collection("mosques").get();
let done = 0;
const missed = [];
for (const d of snap.docs) {
  const m = d.data();
  const pin = m.postalCode ?? /(\d{6})/.exec(m.address)?.[1];
  // the PIN centre, cross-checked against the area name: OpenStreetMap has the odd PIN in the wrong place
  const byPin = pin ? await geocode({ postalcode: pin }) : null;
  const byArea = await geocode({ q: `${m.area.split("/")[0].trim()}, ${m.city}` });
  const apart = byPin && byArea ? km(byPin, byArea) : 0;
  const useArea = !byPin || apart > 20; // only a gross PIN error; area names are themselves ambiguous (several Dongris)
  const hit = useArea ? byArea : byPin;
  const precision = useArea ? "area" : "postcode";
  if (byPin && byArea && apart > 20) console.log(`  ! PIN ${pin} centre is ${apart.toFixed(1)} km from ${m.area}; using the area`);
  if (!hit) {
    missed.push(m.name);
    continue;
  }
  const update = {
    latitude: hit.lat,
    longitude: hit.lng,
    pinSource: precision === "postcode" ? `Centre of PIN code ${pin} (OpenStreetMap)` : `Centre of ${m.area} (OpenStreetMap)`,
    pinPrecision: precision,
    verificationStatus: "VOLUNTEER_VERIFIED",
    verifiedAt: FieldValue.serverTimestamp(),
    verifiedBy: "committee-bulk-2026-10-04",
    lastCheckedAt: FieldValue.serverTimestamp(),
  };
  console.log(`${precision.padEnd(8)} ${pin}  ${m.name}  ->  ${hit.lat}, ${hit.lng}`);
  if (DRY) continue;
  const batch = db.batch();
  batch.update(d.ref, update);
  batch.create(db.collection("auditLogs").doc(), {
    action: "MOSQUE_UPDATED",
    actor: "committee-bulk-2026-10-04",
    entityType: "mosque",
    entityId: d.id,
    oldValue: { verificationStatus: m.verificationStatus ?? null, latitude: m.latitude ?? null, longitude: m.longitude ?? null },
    newValue: { verificationStatus: "VOLUNTEER_VERIFIED", latitude: hit.lat, longitude: hit.lng, pinSource: update.pinSource },
    reason: "Committee confirmed all source venues verified; approximate pin at the centre of the venue's PIN code (or its area where the PIN data was wrong).",
    at: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  done++;
}
console.log(`\n${done} verified with a pin${DRY ? " (dry run, nothing written)" : ""}. ${missed.length} not found:${missed.map((n) => `\n  - ${n}`).join("")}`);

// Mosque verification: what a volunteer or staff member may change on a venue, validated here (pure, testable) and applied by
// the verifyMosque function. Nothing is ever guessed: a venue only becomes verified with a map pin, and an exact Friday time
// only shows once it is marked VERIFIED with a source.

const JUMMAH = ["YES", "LIKELY", "NO", "UNCONFIRMED"];
const VERIFICATION = [
  "PENDING_VERIFICATION", "VOLUNTEER_VERIFIED", "OFFICIALLY_VERIFIED", "SOURCE_CONFLICT", "MAP_UNVERIFIED", "CLOSED", "RELOCATED", "REMOVED",
];
const VERIFIED = ["VOLUNTEER_VERIFIED", "OFFICIALLY_VERIFIED"];
const SCHEDULE_STATUS = ["VERIFIED", "LIKELY", "UNCONFIRMED"];

// A pin outside greater Mumbai (with Vasai, Palghar and Thane) is almost certainly a typo or swapped digits.
const BOX = { latMin: 18.8, latMax: 20.0, lngMin: 72.6, lngMax: 73.3 };

/** Fields a staff member may set, with their checks. Anything else is rejected, not ignored. */
const FIELDS = {
  name: (v) => str(v, 3, 140),
  type: (v) => str(v, 3, 60),
  area: (v) => str(v, 2, 80),
  address: (v) => str(v, 5, 300),
  phone: (v) => (v === "" ? "" : str(v, 6, 30)),
  photoUrl: (v) => (v === "" ? "" : httpsUrl(v)),
  googleMapsUrl: (v) => (v === "" ? "" : httpsUrl(v)),
  sourceNote: (v) => (v === "" ? "" : str(v, 1, 400)),
  jummahStatus: (v) => oneOf(v, JUMMAH),
  verificationStatus: (v) => oneOf(v, VERIFICATION),
  latitude: (v) => num(v, BOX.latMin, BOX.latMax),
  longitude: (v) => num(v, BOX.lngMin, BOX.lngMax),
  jummahSchedules: (v) => schedules(v),
};

function bad(msg) {
  const e = new Error(msg);
  e.code = "invalid";
  throw e;
}
const str = (v, min, max) => {
  if (typeof v !== "string") bad("Expected text.");
  const t = v.trim();
  if (t.length < min || t.length > max) bad(`Text must be ${min} to ${max} characters.`);
  return t;
};
const oneOf = (v, list) => (list.includes(v) ? v : bad(`Must be one of ${list.join(", ")}.`));
const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : bad(`Must be a number from ${lo} to ${hi}.`));
function httpsUrl(v) {
  const t = str(v, 8, 500);
  try {
    if (new URL(t).protocol !== "https:") bad("Link must start with https://");
  } catch (e) {
    if (e.code === "invalid") throw e;
    bad("That is not a valid link.");
  }
  return t;
}
function schedules(v) {
  if (!Array.isArray(v) || v.length > 6) bad("Friday times must be a list of at most 6.");
  return v.map((s) => {
    if (!s || typeof s !== "object") bad("Each Friday time needs details.");
    const time = typeof s.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) ? s.time : bad("Time must look like 13:30 (24-hour).");
    const status = oneOf(s.status, SCHEDULE_STATUS);
    const source = s.source === undefined || s.source === "" ? undefined : str(s.source, 3, 200);
    if (status === "VERIFIED" && !source) bad("A verified Friday time needs a source (for example: called the trustee, visited on Friday).");
    return { day: "FRIDAY", time, status, ...(source ? { source } : {}) };
  });
}

/**
 * @param {object} current the venue as stored
 * @param {object} patch the requested changes
 * @returns {{changes: object, oldValue: object}} only fields that actually differ
 */
function validatePatch(current, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) bad("Changes are required.");
  const keys = Object.keys(patch);
  if (keys.length === 0) bad("Nothing to change.");
  const changes = {};
  for (const k of keys) {
    if (!FIELDS[k]) bad(`${k} cannot be changed here.`);
    changes[k] = FIELDS[k](patch[k]);
  }
  const next = { ...current, ...changes };
  const hasPin = typeof next.latitude === "number" && typeof next.longitude === "number";
  if (("latitude" in changes) !== ("longitude" in changes)) bad("Set latitude and longitude together.");
  if (VERIFIED.includes(next.verificationStatus) && !hasPin) bad("A venue cannot be marked verified without a checked map pin.");
  if (next.jummahStatus === "NO" && (next.jummahSchedules ?? []).some((s) => s.status === "VERIFIED")) bad("A venue with no Friday jamaat cannot have a verified Friday time.");

  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const real = {};
  const oldValue = {};
  for (const k of Object.keys(changes)) {
    if (!same(changes[k], current[k])) {
      real[k] = changes[k];
      oldValue[k] = current[k] ?? null;
    }
  }
  return { changes: real, oldValue };
}

module.exports = { validatePatch, VERIFIED, BOX };

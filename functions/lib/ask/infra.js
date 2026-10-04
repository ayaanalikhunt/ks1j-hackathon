// Ask AI Guide infrastructure: a per-minute rate limit kept in Firestore (so it holds across server instances), a short
// cache for PUBLIC fiqh answers, and privacy-safe client identification. Personal donation data is never cached.
const crypto = require("node:crypto");
const { Timestamp } = require("firebase-admin/firestore");

const ANON_PER_MIN = 12;
const MEMBER_PER_MIN = 40;
const BURST = 4;

/** Only a /24-style prefix of an address is ever used, and only as a hash. The full address is never stored. */
function ipPrefix(ip) {
  const s = String(ip ?? "");
  const parts = s.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  return s.slice(0, 8);
}

const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 24);

/** Pure: given how many requests this minute, is another one allowed? */
function verdict(hits, isMember) {
  const limit = (isMember ? MEMBER_PER_MIN : ANON_PER_MIN) + BURST;
  return { allowed: hits <= limit, limit };
}

/** Fixed one-minute window per member (or per address prefix). The document id is a hash, and rows expire after an hour. */
async function rateLimit(db, key, isMember, now = Date.now()) {
  const minute = Math.floor(now / 60_000);
  const ref = db.doc(`rateLimits/${hash(key)}_${minute}`);
  const hits = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const n = (s.exists ? s.get("n") : 0) + 1;
    tx.set(ref, { n, expireAt: Timestamp.fromMillis(now + 3_600_000) });
    return n;
  });
  const v = verdict(hits, isMember);
  return { ...v, retryAfterSec: Math.max(1, 60 - Math.floor((now % 60_000) / 1000)) };
}

// ---- cache: public answers keyed by (scholar, question, language). 5 minutes, 200 entries, per server instance.
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 200;
const cache = new Map();
const cacheKey = (parts) => parts.join("|").toLowerCase().replace(/\s+/g, " ").trim();

function cacheGet(parts) {
  const k = cacheKey(parts);
  const e = cache.get(k);
  if (!e) return undefined;
  if (Date.now() - e.at > CACHE_TTL_MS) {
    cache.delete(k);
    return undefined;
  }
  return e.value;
}
function cacheSet(parts, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(cacheKey(parts), { value, at: Date.now() });
}

module.exports = { ipPrefix, hash, verdict, rateLimit, cacheGet, cacheSet, ANON_PER_MIN, MEMBER_PER_MIN, BURST };

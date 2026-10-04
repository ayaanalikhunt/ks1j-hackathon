// Mosque Finder logic: Unicode-safe normalisation, phrase matching, query extraction, search, distance, Friday rules, map links.
// The application, never the model, decides location, distance, verification and map destinations.
import type { MosqueVenue } from "./mosqueData";

// ---------- Unicode ----------

const ZERO_WIDTH = /[​‌‍﻿]/g;

/** NFC, zero-width characters to spaces, whitespace collapsed. Never strips combining marks (\p{M}). */
export function normalizeUnicode(input: string): string {
  return input.normalize("NFC").replace(ZERO_WIDTH, " ").replace(/\s+/gu, " ").trim();
}

const TOKEN_RE = /[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu;

export function tokenize(input: string): string[] {
  return Array.from(normalizeUnicode(input).toLocaleLowerCase().matchAll(TOKEN_RE)).map((m) => m[0]);
}

export function safeScriptStrip(input: string): string {
  return normalizeUnicode(input).replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/gu, " ").trim();
}

/** Tokens with hyphens and apostrophes split, so "Saqqa-e-Sakina" and "saqqa e sakina" compare equal. */
const looseTokens = (s: string) => tokenize(s.replace(/[-'’]/gu, " "));

export function detectScript(input: string): "gujarati" | "devanagari" | "arabic" | "latin" | "mixed" | "unknown" {
  const has = {
    gujarati: /[઀-૿]/u.test(input),
    devanagari: /[ऀ-ॿ]/u.test(input),
    arabic: /[؀-ۿݐ-ݿࢠ-ࣿ]/u.test(input),
    latin: /[A-Za-z]/u.test(input),
  };
  const found = (Object.keys(has) as (keyof typeof has)[]).filter((k) => has[k]);
  return found.length === 0 ? "unknown" : found.length === 1 ? found[0] : "mixed";
}

// ---------- Phrase matching (whole tokens only, longest phrase first) ----------

export interface PhraseMatch {
  alias: string;
  canonical: string;
  startToken: number;
  endToken: number;
}

export function findPhraseMatch(tokens: string[], aliases: Array<{ alias: string; canonical: string }>): PhraseMatch | null {
  const prepared = aliases
    .map((a) => ({ ...a, tokens: tokenize(a.alias) }))
    .filter((a) => a.tokens.length > 0)
    .sort((a, b) => b.tokens.length - a.tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    for (const a of prepared) {
      if (i + a.tokens.length > tokens.length) continue;
      if (a.tokens.every((t, j) => tokens[i + j] === t)) {
        return { alias: a.alias, canonical: a.canonical, startToken: i, endToken: i + a.tokens.length - 1 };
      }
    }
  }
  return null;
}

const a = (alias: string, canonical: string) => ({ alias, canonical });

export const CITY_ALIASES = [
  a("mumbai", "Mumbai"), a("bombay", "Mumbai"), a("मुंबई", "Mumbai"), a("મુંબઈ", "Mumbai"),
  a("mira road", "Mira Road"), a("मीरा रोड", "Mira Road"), a("મીરા રોડ", "Mira Road"),
  a("mumbra", "Mumbra"), a("मुंब्रा", "Mumbra"), a("મુંબ્રા", "Mumbra"),
  a("vasai", "Vasai"), a("वसई", "Vasai"), a("વસઈ", "Vasai"),
  a("nalasopara", "Nalasopara"), a("नालासोपारा", "Nalasopara"),
  a("palghar", "Palghar"), a("पालघर", "Palghar"), a("પાલઘર", "Palghar"),
  a("navi mumbai", "Navi Mumbai"), a("नवी मुंबई", "Navi Mumbai"), a("નવી મુંબઈ", "Navi Mumbai"),
];

export const AREA_ALIASES = [
  a("dongri", "Dongri"), a("dongri ki", "Dongri"), a("dongri mein", "Dongri"),
  a("डोंगरी", "Dongri"), a("डोंगरी की", "Dongri"), a("डोंगरी में", "Dongri"),
  a("ડૉંગરી", "Dongri"), a("ડૉંગરીની", "Dongri"), a("ડૉંગરીમાં", "Dongri"),
  a("bandra", "Bandra West"), a("bandra west", "Bandra West"), a("बांद्रा", "Bandra West"),
  a("kurla", "Kurla West"), a("kurla west", "Kurla West"),
  a("mira road", "Mira Road East"), a("mira road ki", "Mira Road East"), a("mira road mein", "Mira Road East"),
  a("मीरा रोड", "Mira Road East"), a("મીરા રોડ", "Mira Road East"),
  a("mumbra", "Mumbra"), a("मुम्ब्रा", "Mumbra"), a("मुंब्रा", "Mumbra"), a("મુંબ્રા", "Mumbra"),
  a("vasai", "Vasai West"), a("vasai west", "Vasai West"), a("वसई", "Vasai West"),
  a("andheri west", "Andheri West"), a("andheri east", "Andheri East"), a("andheri", "Andheri"),
  a("jogeshwari east", "Jogeshwari East"), a("jogeshwari west", "Jogeshwari West"), a("jogeshwari", "Jogeshwari"),
  a("saki naka", "Saki Naka"), a("sakinaka", "Sakinaka"),
  a("govandi west", "Govandi West"), a("govandi", "Govandi West"),
  a("malad west", "Malad West"), a("malad", "Malad West"),
  a("vikhroli west", "Vikhroli West"), a("vikhroli", "Vikhroli West"),
  a("wadala", "Wadala"),
  a("mahim west", "Mahim West"), a("mahim", "Mahim West"),
  a("dharavi", "Dharavi / Sion"), a("sion", "Dharavi / Sion"),
  a("bandra east", "Bandra East (BKC)"), a("bkc", "Bandra East (BKC)"),
  a("khar east", "Khar East"), a("khar", "Khar / Santacruz East"),
  a("mazgaon", "Mazgaon"),
  a("mulund west", "Mulund West"), a("mulund", "Mulund West"),
  a("byculla", "Byculla"),
  a("bhendi bazaar", "Bhendi Bazaar"), a("bhendi bazar", "Bhendi Bazaar"),
  a("umerkhadi", "Umerkhadi"), a("kumbharwada", "Kumbharwada"),
  a("turbhe", "Turbhe"), a("naya nagar", "Naya Nagar"), a("kausa", "Kausa"),
];

// ---------- Query extraction ----------

export type MosqueIntent = "SEARCH_MOSQUES" | "FIND_NEARBY_SHIA_MASJID" | "FIND_NEAREST_FRIDAY_MASJID" | "OPEN_MOSQUE" | "OPEN_MOSQUE_MAP";

export interface MosqueQuery {
  rawInput: string;
  normalizedInput: string;
  intent: MosqueIntent;
  query: string;
  city?: string;
  area?: string;
  language?: string;
  script?: string;
  mosqueType?: "MASJID" | "IMAMBARGAH" | "MEHFIL" | "ANY";
  requiresLocation: boolean;
  requiresConfirmation: boolean;
}

const set = (s: string) => new Set(s.split(/\s+/u).filter(Boolean));

const FILLER = set(
  "show open dikhao dikha batao batado bata khol kholo kholna page please pls mein me ki ka ke ko for the near nearby " +
    "find where can i pray prayer namaz namaaz is which kaunsi sabse mere paas mujhe hai kya wali wala rasta closest nearest to my " +
    "બતાવો બતાવ ખોલો ખોલ મારી મારે માટે આજે નજીક નજીકની સૌથી નમાજ " +
    "मुझे दिखाओ दिखा बताओ खोलो खोल मेरे पास की के में आज सबसे नमाज़ नमाज " +
    "دکھاؤ دکھاو کھولو کھول مجھے میرے کی کا کے میں کے لیے قریب سب سے نماز",
);
const DONATION_TERMS = set("donation donate दान દાન");
const NEGATION_TERMS = set("nahi nahin nhi not no नहीं नहि નહીં નહિ نہیں");
const MOSQUE_TERMS = set(
  "masjid mosque shia jama jamaat jamat imambargah imambara imambada mehfil azakhana madrasa " +
    "મસ્જિદ શિયા જમાત ઇમામબર્ગાહ ઇમામબાડા મેહફિલ અઝાખાના " +
    "मस्जिद शिया जमात इमामबाड़ा महफ़िल महफिल " +
    "مسجد شیعہ جماعت محفل مسجد‌ شیعه",
);
const FRIDAY_TERMS = set(
  "friday jummah jumuah juma jumma jumah जुम्मा जुमा जुमे जुम्मे جمعہ جمعه الجمعة " +
    "જુમ્મા જુમા જુમાની જુમ્માની શુક્રવાર",
);
const NEAR_TERMS = set("near nearby closest nearest paas पास नज़दीक नजदीक નજીક નજીકની قریب قریبی أقرب نزدیک‌ترین نزدیک");

export const hasMosqueTerm = (input: string) => tokenize(input).some((t) => MOSQUE_TERMS.has(t));

export function extractMosqueQuery(input: string): MosqueQuery {
  const normalizedInput = normalizeUnicode(input);
  const tokens = tokenize(normalizedInput);
  const script = detectScript(normalizedInput);

  const cityMatch = findPhraseMatch(tokens, CITY_ALIASES);
  const areaMatch = findPhraseMatch(tokens, AREA_ALIASES);

  // Remove location words only after entity extraction, so they never leak into the venue query.
  const drop = new Set<number>();
  for (const m of [cityMatch, areaMatch]) {
    if (m) for (let i = m.startToken; i <= m.endToken; i++) drop.add(i);
  }
  const query = tokens
    .filter((t, i) => !drop.has(i) && !FILLER.has(t) && !DONATION_TERMS.has(t) && !NEGATION_TERMS.has(t) && !FRIDAY_TERMS.has(t) && !NEAR_TERMS.has(t))
    .join(" ");

  const wantsFriday = tokens.some((t) => FRIDAY_TERMS.has(t));
  const wantsNear = tokens.some((t) => NEAR_TERMS.has(t)) || /मेरे पास|mere paas|મારી નજીક|میرے قریب/u.test(normalizedInput.toLocaleLowerCase());
  const requiresLocation = wantsFriday || wantsNear;

  return {
    rawInput: input,
    normalizedInput,
    intent: wantsFriday ? "FIND_NEAREST_FRIDAY_MASJID" : wantsNear ? "FIND_NEARBY_SHIA_MASJID" : "SEARCH_MOSQUES",
    query,
    city: cityMatch?.canonical,
    area: areaMatch?.canonical,
    script,
    mosqueType: "ANY",
    requiresLocation,
    requiresConfirmation: false,
  };
}

// ---------- Search ----------

// Words that describe every venue and so cannot narrow a search.
const GENERIC = MOSQUE_TERMS;

const isActive = (m: MosqueVenue) => m.verificationStatus !== "CLOSED" && m.verificationStatus !== "REMOVED";

/** Venues matching a parsed query. Closed or removed venues are excluded unless asked for. */
export function searchMosques(q: Pick<MosqueQuery, "query" | "city" | "area">, mosques: MosqueVenue[], includeInactive = false): MosqueVenue[] {
  const wanted = looseTokens(q.query).filter((t) => !GENERIC.has(t));
  const area = q.area?.toLowerCase();
  const city = q.city?.toLowerCase();
  return mosques.filter((m) => {
    if (!includeInactive && !isActive(m)) return false;
    if (city && m.city.toLowerCase() !== city) return false;
    if (area && !`${m.area} ${m.address}`.toLowerCase().includes(area)) return false;
    if (wanted.length === 0) return true;
    const hay = new Set(looseTokens([m.name, ...m.aliases, m.type, m.area, m.city].join(" ")));
    return wanted.every((t) => hay.has(t) || (t.length >= 3 && [...hay].some((h) => h.startsWith(t))));
  });
}

// ---------- Location, distance, Friday ----------

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface NearbyMosqueResult {
  mosque: MosqueVenue;
  distanceKm: number;
}

/** Straight-line distance, not driving distance. */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Friday in India (the community's timezone), decided by the application, never by the model. */
export function isFriday(date: Date = new Date(), timeZone = "Asia/Kolkata"): boolean {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(date) === "Friday";
}

const hasCoords = (m: MosqueVenue) => typeof m.latitude === "number" && typeof m.longitude === "number";
const isVerified = (m: MosqueVenue) => m.verificationStatus === "VOLUNTEER_VERIFIED" || m.verificationStatus === "OFFICIALLY_VERIFIED";
const isMosqueLike = (m: MosqueVenue) => /masjid/iu.test(m.type);

/** Automatic Friday selection needs ALL of these. LIKELY, UNCONFIRMED and NO never qualify. */
export function isPubliclyEligibleForFriday(m: MosqueVenue): boolean {
  return isMosqueLike(m) && m.jummahStatus === "YES" && isVerified(m) && hasCoords(m);
}

const withDistance = (user: UserLocation, list: MosqueVenue[]): NearbyMosqueResult[] =>
  list
    .map((mosque) => ({ mosque, distanceKm: haversineDistanceKm(user.latitude, user.longitude, mosque.latitude!, mosque.longitude!) }))
    .sort((x, y) => x.distanceKm - y.distanceKm);

export function findNearestFridayMosque(user: UserLocation, mosques: MosqueVenue[]): NearbyMosqueResult | null {
  return withDistance(user, mosques.filter((m) => isActive(m) && isPubliclyEligibleForFriday(m)))[0] ?? null;
}

/** Pending or unverified coordinates are never used for automatic ranking. */
export function findNearbyShiaMosques(user: UserLocation, mosques: MosqueVenue[], limit = 10): NearbyMosqueResult[] {
  return withDistance(user, mosques.filter((m) => isActive(m) && hasCoords(m) && isVerified(m))).slice(0, limit);
}

export interface FridayCandidate {
  mosque: MosqueVenue;
  /** null when the venue has no verified coordinates, so no distance can honestly be claimed. */
  distanceKm: number | null;
}

export interface FridaySearchResult {
  state: "FOUND" | "NO_CONFIRMED_FRIDAY_RESULT";
  confirmed: NearbyMosqueResult[];
  likely: FridayCandidate[];
  unconfirmed: FridayCandidate[];
}

export function searchFriday(user: UserLocation | null, mosques: MosqueVenue[]): FridaySearchResult {
  const active = mosques.filter(isActive);
  const confirmed = user ? withDistance(user, active.filter(isPubliclyEligibleForFriday)) : [];
  const rest = (pred: (m: MosqueVenue) => boolean): FridayCandidate[] =>
    active
      .filter((m) => !isPubliclyEligibleForFriday(m) && pred(m))
      .map((mosque) => ({ mosque, distanceKm: user && hasCoords(mosque) && isVerified(mosque) ? haversineDistanceKm(user.latitude, user.longitude, mosque.latitude!, mosque.longitude!) : null }))
      .sort((x, y) => (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity));
  return {
    state: confirmed.length ? "FOUND" : "NO_CONFIRMED_FRIDAY_RESULT",
    confirmed,
    // YES records whose pin or verification is still pending are "likely" until a volunteer confirms them
    likely: rest((m) => m.jummahStatus === "LIKELY" || m.jummahStatus === "YES"),
    unconfirmed: rest((m) => m.jummahStatus === "UNCONFIRMED"),
  };
}

// ---------- Map links (built only from the selected venue, never from model output) ----------

export const hasVerifiedPin = (m: MosqueVenue) => hasCoords(m) && isVerified(m);
/** A pin good enough to rank by distance but not to navigate to (the centre of a PIN code or an area). */
export const isApproximatePin = (m: MosqueVenue) => hasCoords(m) && !!m.pinPrecision && m.pinPrecision !== "venue";

export function buildGoogleMapsUrl(m: MosqueVenue): string {
  // an approximate pin would send people to the middle of a neighbourhood, so search the venue itself instead
  const q = hasCoords(m) && !isApproximatePin(m) ? `${m.latitude},${m.longitude}` : `${m.name}, ${m.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function buildAppleMapsUrl(m: MosqueVenue): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(`${m.name}, ${m.address}`)}`;
}

// ---------- Duplicate detection (never merges: it only flags for a person to decide) ----------

export interface DuplicateCandidate {
  name: string;
  aliases?: string[];
  phone?: string;
  address?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface DuplicateMatch {
  mosque: MosqueVenue;
  confidence: "HIGH" | "MEDIUM";
  reasons: string[];
}

const NAME_NOISE = new Set(["masjid", "mosque", "shia", "jama", "imambargah", "imambara", "imambada", "e", "the", "a.s", "s.a", "a.t.f.s"]);
const nameTokens = (s: string) => new Set(looseTokens(s).filter((t) => !NAME_NOISE.has(t) && t.length > 1));
const digits = (s?: string) => (s ?? "").replace(/\D/g, "").slice(-10);

/** Venues that may be the same place as a new submission, with the reasons. HIGH needs two independent signals. */
export function findPossibleDuplicates(c: DuplicateCandidate, mosques: MosqueVenue[]): DuplicateMatch[] {
  const mine = [c.name, ...(c.aliases ?? [])].map(nameTokens);
  const out: DuplicateMatch[] = [];
  for (const m of mosques) {
    const reasons: string[] = [];
    let best = 0;
    for (const theirs of [m.name, ...m.aliases].map(nameTokens)) {
      for (const a of mine) {
        if (!a.size || !theirs.size) continue;
        const shared = [...a].filter((t) => theirs.has(t)).length;
        best = Math.max(best, shared / Math.min(a.size, theirs.size));
      }
    }
    if (best >= 0.99) reasons.push("same name or alias");
    else if (best >= 0.5) reasons.push("similar name");
    if (digits(c.phone).length === 10 && digits(c.phone) === digits(m.phone)) reasons.push("same phone");
    if (hasCoords(m) && typeof c.latitude === "number" && typeof c.longitude === "number" && haversineDistanceKm(c.latitude, c.longitude, m.latitude!, m.longitude!) <= 0.15)
      reasons.push("within 150 m");
    if (c.postalCode && c.postalCode === m.postalCode && best >= 0.5) reasons.push("same postal code");
    if (reasons.length === 0) continue;
    const strong = reasons.filter((r) => r !== "similar name").length;
    out.push({ mosque: m, confidence: strong >= 2 || (strong >= 1 && best >= 0.5) ? "HIGH" : "MEDIUM", reasons });
  }
  return out.sort((x, y) => (x.confidence === y.confidence ? y.reasons.length - x.reasons.length : x.confidence === "HIGH" ? -1 : 1));
}

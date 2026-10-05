import { describe, expect, it } from "vitest";
import {
  MOSQUES,
  PENDING_MOSQUE_CANDIDATES,
  buildGoogleMapsUrl,
  extractMosqueQuery,
  findNearbyShiaMosques,
  findPossibleDuplicates,
  findNearestFridayMosque,
  isFriday,
  nearestFirst,
  normalizeUnicode,
  searchFriday,
  searchMosques,
  tokenize,
  type MosqueVenue,
} from "./index";

const find = (input: string) => {
  const q = extractMosqueQuery(input);
  return searchMosques(q, MOSQUES).map((m) => m.id);
};

describe("unicode", () => {
  it.each(["મસ્જિદ", "મારી નજીક શિયા મસ્જિદ બતાવો", "मस्जिद", "مسجد", "ડૉંગરીની શિયા મસ્જિદ બતાવો", "દાન", "दान", "جمعہ"])("preserves %s", (s) => {
    expect(normalizeUnicode(s)).toBe(s);
    expect(tokenize(s).join(" ")).toBe(s);
  });
  it("normalises decomposed input to NFC without losing marks", () => {
    expect(normalizeUnicode("मस्जिद".normalize("NFD"))).toBe("मस्जिद");
  });
});

describe("query extraction", () => {
  it("keeps only venue terms; area is separate", () => {
    expect(extractMosqueQuery("Dongri mein Shia masjid dikhao")).toMatchObject({ area: "Dongri", query: "shia masjid" });
    expect(extractMosqueQuery("Mira Road ki Shia masjid")).toMatchObject({ city: "Mira Road", area: "Mira Road East", query: "shia masjid" });
    expect(extractMosqueQuery("Mumbra mein masjid dikhao")).toMatchObject({ area: "Mumbra", query: "masjid" });
    expect(extractMosqueQuery("ડૉંગરીની શિયા મસ્જિદ બતાવો")).toMatchObject({ area: "Dongri", query: "શિયા મસ્જિદ" });
  });
  it("drops donation and negation words", () => {
    expect(extractMosqueQuery("donation nahi, masjid dikhao").query).toBe("masjid");
    expect(extractMosqueQuery("દાન નહીં, મસ્જિદ બતાવો").query).toBe("મસ્જિદ");
    expect(extractMosqueQuery("दान नहीं, मस्जिद दिखाओ").query).toBe("मस्जिद");
  });
  it("does not match a city inside another word", () => {
    expect(extractMosqueQuery("mumbrafoo masjid").city).toBeUndefined();
    expect(extractMosqueQuery("navi mumbai masjid").city).toBe("Navi Mumbai");
  });
  it("detects nearby and Friday intents", () => {
    expect(extractMosqueQuery("મારી નજીક શિયા મસ્જિદ બતાવો")).toMatchObject({ intent: "FIND_NEARBY_SHIA_MASJID", requiresLocation: true });
    expect(extractMosqueQuery("Find the nearest Friday mosque").intent).toBe("FIND_NEAREST_FRIDAY_MASJID");
    expect(extractMosqueQuery("आज जुमे की नमाज़ के लिए सबसे पास मस्जिद दिखाओ").intent).toBe("FIND_NEAREST_FRIDAY_MASJID");
    expect(extractMosqueQuery("آج جمعہ کی نماز کے لیے سب سے قریب مسجد دکھاؤ").intent).toBe("FIND_NEAREST_FRIDAY_MASJID");
    expect(extractMosqueQuery("Show Dongri Shia masjid")).toMatchObject({ intent: "SEARCH_MOSQUES", requiresLocation: false });
  });
});

describe("search by name and alias", () => {
  it("finds the exact venue", () => {
    expect(find("Khoja Masjid Dongri")).toEqual(["mumbai-khoja-shia-isna-ashari-dongri"]);
    expect(find("Bandra Masjid")).toContain("mumbai-khoja-shia-bandra");
    expect(find("H Nazarali Imambargah")).toEqual(["mumbai-haji-nazarali-kurla"]);
    expect(find("Saqqa e Sakina Mira Road")).toEqual(["mmr-saqqa-e-sakina-mira-road"]);
  });
  it("area-only search lists the area's venues", () => {
    expect(find("Dongri Shia masjid")).toContain("mumbai-khoja-shia-isna-ashari-dongri");
  });
  it("an ambiguous alias returns every match, never a guess", () => {
    // Abutalib is included because the source gives it the "Suhana Mehfil" alias, which is itself unverified
    expect(find("Mumbra Mehfil").sort()).toEqual(["mmr-azakhana-abutalib-mumbra", "mmr-mehfil-e-masoomeen-mumbra", "mmr-mehfil-mohibbane-husain-mumbra"]);
  });
});

describe("dataset", () => {
  it("has the 36 source venues, 27 Mumbai + 9 MMR, each once", () => {
    expect(MOSQUES).toHaveLength(36);
    expect(MOSQUES.filter((m) => m.city === "Mumbai")).toHaveLength(27);
    expect(MOSQUES.filter((m) => m.city !== "Mumbai")).toHaveLength(9);
    expect(new Set(MOSQUES.map((m) => m.id)).size).toBe(36);
  });
  it("starts unverified, with no invented coordinates or times", () => {
    for (const m of MOSQUES) {
      expect(m.verificationStatus).toBe("PENDING_VERIFICATION");
      expect(m.latitude).toBeUndefined();
      expect(m.jummahSchedules).toBeUndefined();
    }
  });
  it("keeps the six unresolved candidates separate", () => {
    expect(PENDING_MOSQUE_CANDIDATES).toHaveLength(6);
  });
});

const base: MosqueVenue = { ...MOSQUES[0], id: "t", latitude: 18.95, longitude: 72.83, verificationStatus: "VOLUNTEER_VERIFIED", jummahStatus: "YES", type: "Masjid" };
const me = { latitude: 18.96, longitude: 72.82 };
const at = (id: string, over: Partial<MosqueVenue>): MosqueVenue => ({ ...base, id, ...over });

describe("friday", () => {
  it("verified YES with a verified pin is returned, nearest first", () => {
    const far = at("far", { latitude: 19.2, longitude: 72.9 });
    expect(findNearestFridayMosque(me, [far, base])?.mosque.id).toBe("t");
  });
  it.each([
    ["LIKELY", { jummahStatus: "LIKELY" as const }],
    ["UNCONFIRMED", { jummahStatus: "UNCONFIRMED" as const }],
    ["NO", { jummahStatus: "NO" as const }],
    ["pending verification", { verificationStatus: "PENDING_VERIFICATION" as const }],
    ["no coordinates", { latitude: undefined, longitude: undefined }],
    ["not a masjid", { type: "Imambargah" }],
  ])("%s is never an automatic result", (_n, over) => {
    expect(findNearestFridayMosque(me, [at("x", over)])).toBeNull();
  });
  it("falls back to separate likely and unconfirmed lists", () => {
    const r = searchFriday(me, [at("l", { jummahStatus: "LIKELY" }), at("u", { jummahStatus: "UNCONFIRMED" })]);
    expect(r.state).toBe("NO_CONFIRMED_FRIDAY_RESULT");
    expect(r.likely.map((c) => c.mosque.id)).toEqual(["l"]);
    expect(r.unconfirmed.map((c) => c.mosque.id)).toEqual(["u"]);
  });
  it("works with no location at all", () => {
    expect(searchFriday(null, MOSQUES).state).toBe("NO_CONFIRMED_FRIDAY_RESULT");
  });
  it("isFriday follows the Indian calendar day", () => {
    expect(isFriday(new Date("2026-10-09T10:00:00Z"))).toBe(true);
    expect(isFriday(new Date("2026-10-09T19:00:00Z"))).toBe(false); // already Saturday in Mumbai
    expect(isFriday(new Date("2026-10-04T10:00:00Z"))).toBe(false);
  });
});

describe("nearby and maps", () => {
  it("excludes unverified pins from ranking", () => {
    expect(findNearbyShiaMosques(me, [at("p", { verificationStatus: "PENDING_VERIFICATION" }), base]).map((r) => r.mosque.id)).toEqual(["t"]);
  });
  it("nearestFirst ranks verified pins by distance, then keeps every other match without a distance", () => {
    const far = at("f", { latitude: 19.2, longitude: 72.9 });
    const pending = at("p", { verificationStatus: "PENDING_VERIFICATION" });
    const r = nearestFirst(me, [far, pending, base]);
    expect(r.map((x) => x.mosque.id)).toEqual(["t", "f", "p"]);
    expect(r[2].distanceKm).toBeNull();
    expect(nearestFirst(null, [far, base]).map((x) => x.distanceKm)).toEqual([null, null]);
  });
  it("an approximate pin ranks by distance but navigates by name and address", () => {
    const approx = at("a", { pinPrecision: "postcode" });
    expect(findNearbyShiaMosques(me, [approx])).toHaveLength(1);
    expect(buildGoogleMapsUrl(approx)).toContain(encodeURIComponent(approx.address));
  });
  it("the map link comes from the selected venue only", () => {
    expect(buildGoogleMapsUrl(base)).toBe("https://www.google.com/maps/search/?api=1&query=18.95%2C72.83");
    expect(buildGoogleMapsUrl(MOSQUES[0])).toContain(encodeURIComponent(MOSQUES[0].address));
  });
});

describe("duplicate detection", () => {
  it("flags an alias match from the source list", () => {
    const r = findPossibleDuplicates({ name: "Vasai Mehfil" }, MOSQUES);
    expect(r[0].mosque.id).toBe("mmr-mehfil-panjatani-vasai");
  });
  it("needs two signals for HIGH confidence", () => {
    const name = findPossibleDuplicates({ name: "Haidari Masjid" }, MOSQUES).find((x) => x.mosque.id === "mumbai-haidari-jari-mari");
    expect(name?.confidence).toBe("HIGH"); // exact alias
    const phone = findPossibleDuplicates({ name: "Something else", phone: "84199 37660" }, MOSQUES);
    expect(phone[0]).toMatchObject({ confidence: "MEDIUM", reasons: ["same phone"] });
    const both = findPossibleDuplicates({ name: "Haidari Shia", phone: "+91 84199 37660" }, MOSQUES);
    expect(both[0]).toMatchObject({ confidence: "HIGH" });
  });
  it("does not match unrelated names on generic words", () => {
    expect(findPossibleDuplicates({ name: "Shia Masjid" }, MOSQUES)).toEqual([]);
    expect(findPossibleDuplicates({ name: "Palghar Mosque" }, MOSQUES)).toEqual([]);
  });
});

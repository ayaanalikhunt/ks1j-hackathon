import { describe, expect, it } from "vitest";
import {
  canApprove,
  computeFlags,
  csvRow,
  DICTIONARY,
  LANGS,
  MESSAGE_KEYS,
  isRtl,
  translate,
  formatDate,
  formatDateTime,
  formatTime,
  isoToDmy,
  parseDmy,
  todayIso,
  daysBetween,
  firstEmiDate,
  followUp,
  minEmi,
  nextMonth,
  requiredChecks,
  requiredLoanDocs,
  emiSchedule,
  formatRupees,
  initials,
  isDonationAllowed,
  khumsDue,
  khumsSplit,
  lawajamYear,
  splitList,
  timeAgo,
  toCsv,
} from "./index";

describe("money", () => {
  it("formats Indian grouping", () => {
    expect(formatRupees(132800)).toBe("₹1,32,800");
    expect(formatRupees(999)).toBe("₹999");
    expect(formatRupees(10000000)).toBe("₹1,00,00,000");
  });
  it("khums is a fifth, rounded up", () => {
    expect(khumsDue(100000)).toBe(20000);
    expect(khumsDue(7)).toBe(2);
    expect(() => khumsDue(-1)).toThrow();
  });
  it("EMI is zero-interest and sums exactly", () => {
    const s = emiSchedule(100000, 7);
    expect(s.reduce((a, b) => a + b, 0)).toBe(100000);
    expect(s).toHaveLength(7);
  });
});

describe("khums, lawajam and exports", () => {
  it("splits khums into two halves that add back to the total", () => {
    for (const due of [0, 1, 7, 20000, 33333]) {
      const s = khumsSplit(due);
      expect(s.imam + s.sadaat).toBe(due);
      expect(Math.abs(s.imam - s.sadaat)).toBeLessThanOrEqual(1);
    }
    expect(() => khumsSplit(-1)).toThrow();
  });
  it("lawajam year follows the April to March financial year in IST", () => {
    expect(lawajamYear(new Date("2026-10-04T00:00:00Z"))).toBe("2026-27");
    expect(lawajamYear(new Date("2027-03-31T10:00:00Z"))).toBe("2026-27");
    expect(lawajamYear(new Date("2027-03-31T19:00:00Z"))).toBe("2027-28"); // already 1 April in IST
    expect(lawajamYear(new Date("2026-03-15T00:00:00Z"))).toBe("2025-26");
  });
  it("csv quotes commas and quotes, and defuses spreadsheet formulas", () => {
    expect(csvRow(["a,b", 'say "hi"', 5, null])).toBe('"a,b","say ""hi""",5,');
    expect(csvRow(["=SUM(A1)", "-5", "+91 12345"])).toBe("'=SUM(A1),-5,'+91 12345");
    expect(toCsv(["x", "y"], [[1, 2]])).toBe("x,y\r\n1,2");
  });
});

describe("rules", () => {
  it("fund separation", () => {
    expect(isDonationAllowed("sehme_sadaat", { kind: "case", beneficiaryVerifiedSadaat: true })).toBe(true);
    expect(isDonationAllowed("sehme_sadaat", { kind: "case" })).toBe(false);
    expect(isDonationAllowed("sehme_imam", { kind: "case" })).toBe(false);
    expect(isDonationAllowed("sehme_imam", { kind: "institution", ijazahVerified: true })).toBe(true);
    expect(isDonationAllowed("sehme_imam", { kind: "institution", ijazahVerified: false })).toBe(false);
    expect(isDonationAllowed("general", { kind: "case" })).toBe(true);
  });
  it("two different admins", () => {
    expect(canApprove("a", "a")).toBe(false);
    expect(canApprove("a", "b")).toBe(true);
    expect(canApprove(null, "b")).toBe(false);
  });
});

describe("community helpers", () => {
  it("initials", () => {
    expect(initials("Ayaan Ali Khunt")).toBe("AK");
    expect(initials("  ")).toBe("?");
  });
  it("timeAgo", () => {
    expect(timeAgo(0, 30_000)).toBe("just now");
    expect(timeAgo(0, 5 * 60_000)).toBe("5m ago");
    expect(timeAgo(0, 3 * 3600_000)).toBe("3h ago");
  });
  it("splitList", () => expect(splitList("a, b ,, c")).toEqual(["a", "b", "c"]));
});

describe("fraud flags", () => {
  const c = (id: string, applicantId: string, number: number, status = "submitted") => ({ id, applicantId, number, status });
  it("flags a second open case by the same applicant, newer against older", () => {
    const f = computeFlags([c("a", "u1", 1), c("b", "u1", 2)], []);
    expect(f).toEqual([{ id: "b__a__same_applicant", kind: "same_applicant", caseId: "b", otherId: "a" }]);
  });
  it("flags two applicants in the same household, but not unlinked members", () => {
    const cases = [c("a", "u1", 1), c("b", "u2", 2)];
    expect(computeFlags(cases, [{ id: "u1", householdId: "h" }, { id: "u2", householdId: "h" }]).map((x) => x.kind)).toEqual(["same_household"]);
    expect(computeFlags(cases, [{ id: "u1" }, { id: "u2" }])).toEqual([]);
    expect(computeFlags(cases, [{ id: "u1", householdId: "h1" }, { id: "u2", householdId: "h2" }])).toEqual([]);
  });
  it("ignores cases that are paid out, closed or denied", () => {
    expect(computeFlags([c("a", "u1", 1, "disbursed"), c("b", "u1", 2)], [])).toEqual([]);
    expect(computeFlags([c("a", "u1", 1, "declined"), c("b", "u1", 2, "closed")], [])).toEqual([]);
    expect(computeFlags([c("a", "u1", 1, "published"), c("b", "u1", 2, "funded")], [])).toHaveLength(1);
  });
});

describe("education loans", () => {
  it("minimum monthly amount spreads the loan over 48 months, rounded up", () => {
    expect(minEmi(60000)).toBe(1250);
    expect(minEmi(100000)).toBe(2084);
    expect(minEmi(1)).toBe(1);
  });
  it("repayment starts six months after the course ends", () => {
    expect(firstEmiDate("2027-10-01")).toBe("2028-04-01");
    expect(firstEmiDate("2027-08-31")).toBe("2028-02-29"); // clamped to the month length (2028 is a leap year)
    expect(firstEmiDate("2027-12-15")).toBe("2028-06-15");
    expect(nextMonth("2028-01-31")).toBe("2028-02-29");
    expect(nextMonth("2028-12-05")).toBe("2029-01-05");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-10-01", "2026-10-16")).toBe(15);
    expect(daysBetween("2026-10-16", "2026-10-01")).toBe(-15);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });
  it("follow-up: reminders from day one, a person from day fifteen, none during a hardship review", () => {
    expect(followUp({ nextDue: "2026-11-20" }, "2026-10-04")).toBe("on_track");
    expect(followUp({ nextDue: "2026-10-08" }, "2026-10-04")).toBe("due_soon");
    expect(followUp({ nextDue: "2026-10-01" }, "2026-10-04")).toBe("late");
    expect(followUp({ nextDue: "2026-09-19" }, "2026-10-04")).toBe("act");
    expect(followUp({ nextDue: "2026-09-19", hardshipPending: true }, "2026-10-04")).toBe("hardship");
  });
  it("an orphan loan needs the extra checks, including a home visit", () => {
    expect(requiredChecks(false)).toEqual(["identity", "address", "income", "institution_fee"]);
    expect(requiredChecks(true)).toEqual(expect.arrayContaining(["orphan_status", "guardian", "references", "no_other_loans", "home_visit"]));
    expect(requiredChecks(true)).toHaveLength(9);
    expect(requiredLoanDocs(true)).toEqual(expect.arrayContaining(["death_certificate", "guardian_id"]));
    expect(requiredLoanDocs(false)).not.toContain("death_certificate");
  });
});

describe("dates: DD/MM/YYYY and a 12-hour clock in IST", () => {
  it("formats an instant in India time", () => {
    const d = new Date("2026-10-04T12:12:00Z"); // 5:42 pm IST
    expect(formatDate(d)).toBe("04/10/2026");
    expect(formatTime(d)).toBe("5:42 pm");
    expect(formatDateTime(d)).toBe("04/10/2026, 5:42 pm");
  });
  it("rolls into the next day when IST is past midnight, and uses 12 for noon and midnight", () => {
    expect(formatDate(new Date("2026-10-04T19:00:00Z"))).toBe("05/10/2026");
    expect(formatTime(new Date("2026-10-04T18:30:00Z"))).toBe("12:00 am");
    expect(formatTime(new Date("2026-10-04T06:30:00Z"))).toBe("12:00 pm");
    expect(formatTime(new Date("2026-10-04T03:50:00Z"))).toBe("9:20 am");
  });
  it("accepts Firestore-style timestamps and empty values", () => {
    expect(formatDate({ seconds: Date.UTC(2026, 0, 5, 10) / 1000 })).toBe("05/01/2026");
    expect(formatDate({ toDate: () => new Date("2026-01-05T10:00:00Z") })).toBe("05/01/2026");
    expect(formatDateTime(null)).toBe("");
  });
  it("converts calendar dates both ways and rejects impossible ones", () => {
    expect(isoToDmy("2028-04-01")).toBe("01/04/2028");
    expect(isoToDmy("")).toBe("");
    expect(parseDmy("01/04/2028")).toBe("2028-04-01");
    expect(parseDmy("1/4/2028")).toBe("2028-04-01");
    expect(parseDmy("29-02-2028")).toBe("2028-02-29");
    expect(parseDmy("29/02/2027")).toBeNull();
    expect(parseDmy("31/04/2026")).toBeNull();
    expect(parseDmy("2028-04-01")).toBeNull();
    expect(todayIso(new Date("2026-10-04T19:00:00Z"))).toBe("2026-10-05");
  });
});

describe("languages", () => {
  it("every language has every message, with the same placeholders", () => {
    for (const lang of LANGS) {
      for (const key of MESSAGE_KEYS) {
        const text = DICTIONARY[lang][key];
        expect(text, `${lang}:${key}`).toBeTruthy();
        const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(holes(text), `${lang}:${key} placeholders`).toEqual(holes(DICTIONARY.en[key]));
      }
    }
  });
  it("translates, fills placeholders, and reads Urdu right to left", () => {
    expect(translate("en", "home.salaam", { name: "Fatema" })).toBe("Salaam, Fatema");
    expect(translate("hi", "home.salaam", { name: "Fatema" })).toBe("सलाम, Fatema");
    expect(translate("ur", "tab.home")).toBe("ہوم");
    expect(isRtl("ur")).toBe(true);
    expect(isRtl("gu")).toBe(false);
  });
  it("non-English languages are really translated, not copies of English", () => {
    for (const lang of ["gu", "hi", "ur"] as const) {
      const same = MESSAGE_KEYS.filter((k) => DICTIONARY[lang][k] === DICTIONARY.en[k] && /[a-z]{4}/i.test(DICTIONARY.en[k]));
      // a few strings are intentionally the same (for example the site name), but never many
      expect(same.length, `${lang} untranslated: ${same.join(",")}`).toBeLessThan(4);
    }
  });
});

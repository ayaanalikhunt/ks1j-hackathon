import { describe, expect, it } from "vitest";
import {
  canApprove,
  computeFlags,
  csvRow,
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

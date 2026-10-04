import { describe, expect, it } from "vitest";
import { canApprove, emiSchedule, formatRupees, initials, isDonationAllowed, khumsDue, splitList, timeAgo } from "./index";

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

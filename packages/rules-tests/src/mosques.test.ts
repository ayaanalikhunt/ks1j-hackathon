// Mosque verification rules (pure): what a staff member may change, and what can never be marked verified.
import { describe, expect, it } from "vitest";
import * as m from "../../../functions/lib/mosques.js";

const venue = { name: "Test Masjid", type: "Masjid", area: "Dongri", address: "1 Test Road, Mumbai", jummahStatus: "UNCONFIRMED", verificationStatus: "PENDING_VERIFICATION" };
const PIN = { latitude: 18.95, longitude: 72.83 };
const run = (patch: object, current: object = venue) => m.validatePatch(current, patch);

describe("validatePatch", () => {
  it("returns only the fields that actually changed, with their old values", () => {
    const r = run({ area: "Dongri", jummahStatus: "YES" });
    expect(r.changes).toEqual({ jummahStatus: "YES" });
    expect(r.oldValue).toEqual({ jummahStatus: "UNCONFIRMED" });
  });
  it("rejects fields that are not editable and empty requests", () => {
    expect(() => run({ source: "x" })).toThrow(/cannot be changed/);
    expect(() => run({ id: "x" })).toThrow();
    expect(() => run({})).toThrow(/Nothing/);
  });
  it("cannot mark a venue verified without a map pin", () => {
    expect(() => run({ verificationStatus: "VOLUNTEER_VERIFIED" })).toThrow(/map pin/);
    expect(run({ verificationStatus: "VOLUNTEER_VERIFIED", ...PIN }).changes.verificationStatus).toBe("VOLUNTEER_VERIFIED");
    // a pin already on file is enough
    expect(run({ verificationStatus: "OFFICIALLY_VERIFIED" }, { ...venue, ...PIN }).changes.verificationStatus).toBe("OFFICIALLY_VERIFIED");
  });
  it("rejects pins that are half set, or outside greater Mumbai", () => {
    expect(() => run({ latitude: 18.95 })).toThrow(/together/);
    expect(() => run({ latitude: 28.6, longitude: 77.2 })).toThrow(/number from/);
    expect(() => run({ latitude: "18.95", longitude: 72.83 })).toThrow();
  });
  it("only accepts known statuses", () => {
    expect(() => run({ jummahStatus: "MAYBE" })).toThrow();
    expect(() => run({ verificationStatus: "DONE" })).toThrow();
  });
  it("a verified Friday time needs a 24-hour time and a source", () => {
    expect(() => run({ jummahSchedules: [{ time: "1:30pm", status: "VERIFIED", source: "called" }] })).toThrow(/13:30/);
    expect(() => run({ jummahSchedules: [{ time: "13:30", status: "VERIFIED" }] })).toThrow(/source/);
    const ok = run({ jummahSchedules: [{ time: "13:30", status: "VERIFIED", source: "Called the trustee" }] });
    expect(ok.changes.jummahSchedules).toEqual([{ day: "FRIDAY", time: "13:30", status: "VERIFIED", source: "Called the trustee" }]);
  });
  it("a venue with no Friday jamaat cannot carry a verified time", () => {
    expect(() => run({ jummahStatus: "NO" }, { ...venue, jummahSchedules: [{ day: "FRIDAY", time: "13:30", status: "VERIFIED", source: "x" }] })).toThrow(/no Friday jamaat/);
  });
  it("links must be https", () => {
    expect(() => run({ photoUrl: "http://x.test/a.jpg" })).toThrow(/https/);
    expect(() => run({ googleMapsUrl: "javascript:alert(1)" })).toThrow();
    expect(run({ photoUrl: "https://x.test/a.jpg" }).changes.photoUrl).toBe("https://x.test/a.jpg");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parsePeekaboo, parsePeekabooDays, parsePeekabooReshowAt } from "../../../src/util/peekaboo.js";

describe("peekaboo times", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes a whole number of days from 1 to 10000", () => {
    expect(parsePeekabooDays("1", "--days")).toBe(1);
    expect(parsePeekabooDays("10000", "--days")).toBe(10000);
    for (const bad of ["0", "10001", "1.5", "-3", "7d", ""]) {
      expect(() => parsePeekabooDays(bad, "--days")).toThrow(/--days must be a whole number of days from 1 to 10000/);
    }
  });

  it("passes a date only through, for Quire to read in the user's time zone", () => {
    expect(parsePeekabooReshowAt("2026-11-10", "--reshow-at")).toBe("2026-11-10");
    // Still today somewhere: 6 AM there may be ahead.
    expect(parsePeekabooReshowAt("2026-11-04", "--reshow-at")).toBe("2026-11-04");
  });

  it("turns a date and time into ms since the epoch", () => {
    expect(parsePeekabooReshowAt("2026-11-10T09:30:00Z", "--reshow-at")).toBe(Date.parse("2026-11-10T09:30:00Z"));
  });

  it("rejects a time in the past, and a date that is over everywhere", () => {
    expect(() => parsePeekabooReshowAt("2026-11-04T11:59:00Z", "--reshow-at")).toThrow(/--reshow-at must be in the future/);
    expect(() => parsePeekabooReshowAt("2026-11-03", "--reshow-at")).toThrow(/--reshow-at must be in the future/);
  });

  it("rejects what isn't a date", () => {
    expect(() => parsePeekabooReshowAt("next week", "--reshow-at")).toThrow(/--reshow-at must be a date \(2026-11-10\) or an ISO 8601/);
  });

  it("--peekaboo: no value hides indefinitely, a number is days, else a reshow time", () => {
    expect(parsePeekaboo(true, "--peekaboo")).toBe(true);
    expect(parsePeekaboo("7", "--peekaboo")).toBe(7);
    expect(parsePeekaboo("2026-11-10", "--peekaboo")).toBe("2026-11-10");
    expect(() => parsePeekaboo("20000", "--peekaboo")).toThrow(/--peekaboo must be a whole number of days/);
    expect(() => parsePeekaboo("soon", "--peekaboo")).toThrow(/--peekaboo must be a date/);
  });
});

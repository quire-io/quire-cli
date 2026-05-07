import { describe, expect, it } from "vitest";

import { parseRecurrence } from "../../../src/util/recurrence.js";

describe("parseRecurrence", () => {
  it("returns undefined when no recurrence flags are set", () => {
    expect(parseRecurrence({})).toBeUndefined();
  });

  it("requires --recurrence-freq when any other flag is set", () => {
    expect(() =>
      parseRecurrence({ recurrenceInterval: "1" }),
    ).toThrowError(/recurrence-freq is required/);
  });

  it("rejects unknown freq values", () => {
    expect(() =>
      parseRecurrence({ recurrenceFreq: "hourly", recurrenceInterval: "1" }),
    ).toThrowError(/daily \| weekly \| monthly \| yearly/);
  });

  it("requires --recurrence-interval when any other flag is set", () => {
    expect(() =>
      parseRecurrence({ recurrenceFreq: "daily" }),
    ).toThrowError(/recurrence-interval is required/);
  });

  it("rejects non-positive interval", () => {
    expect(() =>
      parseRecurrence({ recurrenceFreq: "daily", recurrenceInterval: "0" }),
    ).toThrowError(/positive integer/);
    expect(() =>
      parseRecurrence({ recurrenceFreq: "daily", recurrenceInterval: "-1" }),
    ).toThrowError(/positive integer/);
    expect(() =>
      parseRecurrence({ recurrenceFreq: "daily", recurrenceInterval: "x" }),
    ).toThrowError(/positive integer/);
  });

  it("returns the minimal happy-path shape", () => {
    expect(parseRecurrence({ recurrenceFreq: "daily", recurrenceInterval: "2" })).toEqual({
      freq: "daily",
      interval: 2,
    });
  });

  it("collapses a single byweekday integer", () => {
    expect(
      parseRecurrence({
        recurrenceFreq: "weekly",
        recurrenceInterval: "1",
        recurrenceByweekday: "3",
      }),
    ).toEqual({ freq: "weekly", interval: 1, byweekday: 3 });
  });

  it("keeps multiple byweekday integers as an array", () => {
    expect(
      parseRecurrence({
        recurrenceFreq: "weekly",
        recurrenceInterval: "1",
        recurrenceByweekday: "1,3,5",
      }),
    ).toEqual({ freq: "weekly", interval: 1, byweekday: [1, 3, 5] });
  });

  it("rejects byweekday values out of 0-6 range", () => {
    expect(() =>
      parseRecurrence({
        recurrenceFreq: "weekly",
        recurrenceInterval: "1",
        recurrenceByweekday: "1,7",
      }),
    ).toThrowError(/0-6/);
    expect(() =>
      parseRecurrence({
        recurrenceFreq: "weekly",
        recurrenceInterval: "1",
        recurrenceByweekday: "-1",
      }),
    ).toThrowError(/0-6/);
  });

  it("passes recurrenceUntil through unchanged", () => {
    expect(
      parseRecurrence({
        recurrenceFreq: "monthly",
        recurrenceInterval: "1",
        recurrenceUntil: "2027-01-01",
      }),
    ).toMatchObject({ until: "2027-01-01" });
  });

  it("normalizes freq case-insensitively", () => {
    expect(parseRecurrence({ recurrenceFreq: "WEEKLY", recurrenceInterval: "1" })).toMatchObject({
      freq: "weekly",
    });
  });
});

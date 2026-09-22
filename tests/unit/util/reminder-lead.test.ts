import { describe, expect, it } from "vitest";

import { formatLeads, parseLeads } from "../../../src/util/reminder-lead.js";

describe("parseLeads", () => {
  it("returns undefined when --lead was not passed", () => {
    expect(parseLeads(undefined)).toBeUndefined();
    expect(parseLeads([])).toBeUndefined();
  });

  it("reads a bare number as minutes", () => {
    expect(parseLeads(["30"])).toEqual([{ minutes: 30 }]);
  });

  it("reads the m and d units", () => {
    expect(parseLeads(["30m", "2d"])).toEqual([{ minutes: 30 }, { days: 2 }]);
  });

  it("accepts a zero lead (notify at the fire time)", () => {
    expect(parseLeads(["0"])).toEqual([{ minutes: 0 }]);
  });

  it("reads the @HH:mm suffix on a day lead and zero-pads the hour", () => {
    expect(parseLeads(["1d@09:00"])).toEqual([{ days: 1, at: "09:00" }]);
    expect(parseLeads(["1d@9:05"])).toEqual([{ days: 1, at: "09:05" }]);
  });

  it("rejects @HH:mm on a minute lead — Quire only allows it with days", () => {
    expect(() => parseLeads(["30m@09:00"])).toThrowError(/only valid on a day lead/);
  });

  it("rejects an out-of-range clock time", () => {
    expect(() => parseLeads(["1d@24:00"])).toThrowError(/24-hour HH:mm/);
    expect(() => parseLeads(["1d@09:60"])).toThrowError(/24-hour HH:mm/);
  });

  it("rejects units Quire's wire format does not have", () => {
    expect(() => parseLeads(["2h"])).toThrowError(/Expected <n>m/);
    expect(() => parseLeads(["1w"])).toThrowError(/Expected <n>m/);
  });

  it("rejects a negative lead — nothing fires after the fire time", () => {
    expect(() => parseLeads(["-5m"])).toThrowError(/Expected <n>m/);
  });

  it("enforces the 10,000-day ceiling on both units", () => {
    expect(() => parseLeads(["10001d"])).toThrowError(/maximum of 10000 days/);
    expect(() => parseLeads([`${String(10_000 * 24 * 60 + 1)}m`])).toThrowError(/maximum of 10000 days/);
    expect(parseLeads(["10000d"])).toEqual([{ days: 10_000 }]);
  });

  it("enforces the 30-lead ceiling", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => `${String(i)}m`);
    expect(parseLeads(thirty)).toHaveLength(30);
    expect(() => parseLeads([...thirty, "31m"])).toThrowError(/at most 30 leads/);
  });
});

describe("formatLeads", () => {
  it("round-trips the --lead grammar", () => {
    expect(formatLeads([{ minutes: 30 }, { days: 2 }, { days: 1, at: "09:00" }])).toBe("30m, 2d, 1d@09:00");
  });

  it("returns undefined for an absent or empty list", () => {
    expect(formatLeads(undefined)).toBeUndefined();
    expect(formatLeads([])).toBeUndefined();
  });
});

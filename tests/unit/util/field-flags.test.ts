import { describe, expect, it } from "vitest";

import { buildFieldBody } from "../../../src/util/field-flags.js";

describe("buildFieldBody", () => {
  it("returns an empty object for empty flags", () => {
    expect(buildFieldBody({})).toEqual({});
  });

  it("includes name and type when present", () => {
    expect(buildFieldBody({ name: "x", type: "number" })).toEqual({
      name: "x",
      type: "number",
    });
  });

  it("only includes boolean flags when set to true (not just defined)", () => {
    expect(
      buildFieldBody({
        hidden: false,
        private: false,
        percent: false,
        multiple: false,
        clearOnDup: false,
      }),
    ).toEqual({});
    expect(
      buildFieldBody({
        hidden: true,
        private: true,
        percent: true,
        multiple: true,
        clearOnDup: true,
      }),
    ).toEqual({
      hidden: true,
      private: true,
      percent: true,
      multiple: true,
      clearOnDup: true,
    });
  });

  it("parses --extra key=value as JSON when possible", () => {
    expect(
      buildFieldBody({
        extra: ['count=5', 'enabled=true', 'tags=["a","b"]', "label=hello"],
      }),
    ).toEqual({
      count: 5,
      enabled: true,
      tags: ["a", "b"],
      label: "hello",
    });
  });

  it("falls back to raw string when JSON.parse fails", () => {
    expect(buildFieldBody({ extra: ["formula=SUM(x, y)"] })).toEqual({
      formula: "SUM(x, y)",
    });
  });

  it("rejects malformed --extra entries (no =)", () => {
    expect(() => buildFieldBody({ extra: ["nokey"] })).toThrowError(/Expected key=value/);
  });

  it("rejects --extra entries starting with =", () => {
    expect(() => buildFieldBody({ extra: ["=value"] })).toThrowError(/Expected key=value/);
  });
});

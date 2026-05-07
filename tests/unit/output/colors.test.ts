import { describe, expect, it } from "vitest";

import { friendlyColor, longColor, shortColor } from "../../../src/output/colors.js";

// Tests target the stdout-non-TTY path (vitest captures stdout, so
// stdoutTty is false in this environment). That means the swatch is
// suppressed and we get the plain text form, which is what scripts /
// jq consumers see.

describe("friendlyColor", () => {
  it("returns the canonical name for a known code", () => {
    expect(friendlyColor("06")).toBe("red");
    expect(friendlyColor("42")).toBe("green");
    expect(friendlyColor("34")).toBe("blue");
  });

  it("prefers the canonical name over aliases (gray, not grey)", () => {
    expect(friendlyColor("52")).toBe("gray");
  });

  it("returns undefined for codes without a friendly name", () => {
    expect(friendlyColor("13")).toBeUndefined();
    expect(friendlyColor("50")).toBeUndefined();
  });

  it("returns undefined for empty / undefined input", () => {
    expect(friendlyColor("")).toBeUndefined();
    expect(friendlyColor(undefined)).toBeUndefined();
  });
});

describe("shortColor", () => {
  it("returns the friendly name when known", () => {
    expect(shortColor("06")).toBe("red");
  });

  it("falls back to the code when no friendly name exists", () => {
    expect(shortColor("13")).toBe("13");
  });

  it("returns empty string for missing input", () => {
    expect(shortColor(undefined)).toBe("");
    expect(shortColor("")).toBe("");
  });
});

describe("longColor", () => {
  it("renders 'name (code, hex)' when both are known", () => {
    expect(longColor("06")).toBe("red (06, #D81F1E)");
  });

  it("renders 'code (hex)' when only the hex is known", () => {
    expect(longColor("13")).toBe("13 (#EB425E)");
  });

  it("returns undefined for missing input", () => {
    expect(longColor(undefined)).toBeUndefined();
  });
});

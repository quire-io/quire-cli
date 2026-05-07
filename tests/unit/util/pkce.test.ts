import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { generatePkce, generateState } from "../../../src/oauth/pkce.js";

describe("generatePkce", () => {
  it("returns 43-char base64url verifier and challenge", () => {
    const { codeVerifier, codeChallenge } = generatePkce();
    // 32 bytes of entropy → 43 base64url chars (ceil(32 * 4 / 3) - padding).
    expect(codeVerifier).toHaveLength(43);
    expect(codeChallenge).toHaveLength(43);
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("computes the challenge as base64url(sha256(verifier))", () => {
    const { codeVerifier, codeChallenge } = generatePkce();
    const expected = createHash("sha256").update(codeVerifier).digest("base64url");
    expect(codeChallenge).toBe(expected);
  });

  it("returns a different verifier on each call", () => {
    const a = generatePkce();
    const b = generatePkce();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});

describe("generateState", () => {
  it("returns a 43-char base64url string", () => {
    const state = generateState();
    expect(state).toHaveLength(43);
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns different values on each call", () => {
    expect(generateState()).not.toBe(generateState());
  });
});

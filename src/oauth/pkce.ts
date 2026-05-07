import { createHash, randomBytes } from "node:crypto";

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Generate a PKCE verifier + S256 challenge per RFC 7636. 32 bytes of
 * entropy → 43 base64url chars (the lower bound the spec allows; well
 * above 256 bits of unpredictability).
 */
export function generatePkce(): PkcePair {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

/** Generate an opaque OAuth `state` value to bind the redirect to this flow. */
export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

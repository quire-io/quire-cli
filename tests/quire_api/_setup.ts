import { QuireClient } from "@quire-io/api-client";

import { createQuireClient } from "../../src/quire-client.js";
import { NotLoggedInError } from "../../src/errors.js";

/**
 * Resolve a live `QuireClient` for the live-test suite.
 *
 * Two paths, checked in order:
 *   1. `QUIRE_TEST_TOKEN` — a raw access token. Builds a client directly
 *      with no refresh callback (best for CI: short-lived, scope-limited
 *      tokens). The test will fail naturally if the token expires
 *      mid-run — set a fresh one.
 *   2. `QUIRE_TEST_PROFILE` (default `testdev`) — reuses a local CLI
 *      profile via `createQuireClient`. Best for local dev: refreshes
 *      automatically using the stored refresh token.
 *
 * If neither path yields a client, returns `{ skip: true }` with a reason.
 * Tests use `describe.skipIf(skip)` so `npm run test:live` doesn't
 * spuriously fail on a clean checkout.
 */
export interface LiveClientResult {
  client?: QuireClient;
  skip: boolean;
  reason?: string;
}

export function resolveLiveClient(): LiveClientResult {
  const apiServer = process.env.QUIRE_API_SERVER ?? "https://quire.io";

  const token = process.env.QUIRE_TEST_TOKEN?.trim();
  if (token) {
    return {
      client: new QuireClient({
        tokens: { accessToken: token, refreshToken: "", expiresAt: 0 },
        apiServer,
      }),
      skip: false,
    };
  }

  const profile = process.env.QUIRE_TEST_PROFILE?.trim() || "testdev";
  try {
    return { client: createQuireClient({ profile }), skip: false };
  } catch (err) {
    if (err instanceof NotLoggedInError) {
      return {
        skip: true,
        reason: `No QUIRE_TEST_TOKEN set and profile "${profile}" is not logged in. Run: quire login --profile ${profile}`,
      };
    }
    throw err;
  }
}

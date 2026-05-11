import { QuireClient, refreshTokens as apiRefreshTokens } from "@quire-io/api-client";

import { createQuireClient } from "../../src/quire-client.js";
import { NotLoggedInError } from "../../src/errors.js";
import { QUIRE_CLI_CLIENT_ID } from "../../src/oauth/config.js";

/**
 * Resolve a live `QuireClient` for the live-test suite.
 *
 * Auth precedence (first match wins):
 *   1. `QUIRE_TEST_REFRESH_TOKEN` — long-lived refresh token (180 days).
 *      The client refreshes on first request, so a stale or absent
 *      `QUIRE_TEST_TOKEN` is fine. Best for CI: stash the refresh token
 *      once, the access token rotates automatically.
 *      *** CI auth model: Quire's PKCE flow does not issue refresh
 *      tokens (https://quire.io/dev/api/#pkce-support). The CI suite
 *      bypasses PKCE and uses an OAuth app in confidential mode —
 *      `QUIRE_TEST_CLIENT_SECRET` carries that app's client_secret so
 *      `/oauth/token` (refresh grant) accepts the request. Set
 *      `QUIRE_TEST_CLIENT_ID` when the test OAuth app is *not* the
 *      published CLI app — its client_id must match the one that
 *      issued the refresh token, or `/oauth/token` returns
 *      `invalid_client` (which the client surfaces as revoked). This
 *      is a CI-only setup; the distributed CLI uses PKCE and MUST NOT
 *      ship a client_secret. ***
 *   2. `QUIRE_TEST_TOKEN` — raw access token (1 hour TTL). No refresh.
 *      Best for one-off local runs and ad-hoc debugging.
 *   3. `QUIRE_TEST_PROFILE` (default `testdev`) — reuse a local CLI
 *      profile via `createQuireClient`. Best for local dev — refreshes
 *      automatically and persists rotated tokens to disk.
 *
 * If none yields a client, returns `{ skip: true }` with a reason.
 * Tests use `describe.skipIf(skip)` so `npm run test:live` doesn't
 * spuriously fail on a clean checkout.
 *
 * If Quire rotates refresh tokens, `onTokenRefresh` logs a warning with
 * the new token's prefix so CI logs surface the rotation. Whether
 * rotation happens is server-side; we discover it on first refresh.
 */
export interface LiveClientResult {
  client?: QuireClient;
  skip: boolean;
  reason?: string;
}

export function resolveLiveClient(): LiveClientResult {
  const apiServer = process.env.QUIRE_API_SERVER ?? "https://quire.io";
  const accessToken = process.env.QUIRE_TEST_TOKEN?.trim();
  const refreshToken = process.env.QUIRE_TEST_REFRESH_TOKEN?.trim();
  // CI-only: the OAuth app's client_secret. Used so the refresh grant
  // succeeds in CI (Quire's PKCE flow doesn't issue refresh tokens).
  // Never set this for the distributed CLI — see docstring above.
  const clientSecret = process.env.QUIRE_TEST_CLIENT_SECRET?.trim();
  // CI-only: client_id of the OAuth app that issued the refresh token.
  // Defaults to the published CLI client. Override when CI uses a
  // separate test-only OAuth app — the refresh grant must be sent to
  // the same client_id that minted the token, otherwise `/oauth/token`
  // returns `invalid_client`.
  const clientId = process.env.QUIRE_TEST_CLIENT_ID?.trim() || QUIRE_CLI_CLIENT_ID;

  if (refreshToken) {
    // Force refresh on first request: even if a fresh access token was
    // also provided, refreshing once is cheap and proves the refresh
    // path works in the current environment.
    return {
      client: new QuireClient({
        tokens: {
          accessToken: accessToken ?? "",
          refreshToken,
          expiresAt: 0,
        },
        apiServer,
        refreshTokens: (rt) =>
          apiRefreshTokens({
            apiServer,
            clientId,
            clientSecret,
            refreshToken: rt,
          }),
        onTokenRefresh: async (tokens) => {
          if (tokens.refreshToken !== refreshToken) {
            console.warn(
              `[live] refresh token rotated; update QUIRE_TEST_REFRESH_TOKEN secret. New prefix: ${tokens.refreshToken.slice(0, 8)}…`,
            );
          }
        },
      }),
      skip: false,
    };
  }

  if (accessToken) {
    return {
      client: new QuireClient({
        tokens: {
          accessToken,
          refreshToken: "",
          expiresAt: Number.MAX_SAFE_INTEGER,
        },
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
        reason: `No QUIRE_TEST_REFRESH_TOKEN / QUIRE_TEST_TOKEN set and profile "${profile}" is not logged in. Run: quire login --profile ${profile}`,
      };
    }
    throw err;
  }
}

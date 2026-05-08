import {
  QuireClient,
  refreshTokens as apiRefreshTokens,
} from "@quire-io/api-client";
import type { QuireTokens } from "@quire-io/api-client";

import { getApiServer } from "./config.js";
import {
  deleteCredentials,
  readCredentials,
  writeCredentials,
} from "./credentials.js";
import { NotLoggedInError } from "./errors.js";
import { QUIRE_CLI_CLIENT_ID } from "./oauth/config.js";
import { withRetryOn429 } from "./util/retry-after.js";
import { readVersion } from "./version.js";

export interface CreateQuireClientOptions {
  profile?: string;
}

/**
 * Wrap every async method on a QuireClient with `withRetryOn429`. A
 * Proxy intercepts each call once and returns a thin retrying shim;
 * non-function properties (the client's internal state, anything
 * accessed for inspection) pass through untouched.
 *
 * The original client is still usable directly if a caller needs the
 * raw error path (e.g. live tests asserting a specific 429 message).
 */
function wrapWithRetry(client: QuireClient): QuireClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) =>
        withRetryOn429(
          () => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args),
          {
            onRetry: (waitSec) => {
              process.stderr.write(
                `Quire API rate limited; retrying in ${waitSec}s…\n`,
              );
            },
          },
        );
    },
  });
}

/**
 * Build a `QuireClient` for the signed-in user on this machine. Reads
 * credentials from the configured profile; throws `NotLoggedInError` if
 * none exist.
 *
 * The returned client auto-refreshes on 401s using the refresh token in
 * the public-PKCE flow (no client_secret), persists rotated tokens back
 * to disk atomically, and deletes the credentials file if the refresh
 * token is dead so the next command surfaces a clean "run quire login"
 * message.
 */
export function createQuireClient(opts: CreateQuireClientOptions = {}): QuireClient {
  const stored = readCredentials(opts.profile);
  if (!stored) throw new NotLoggedInError();

  const apiServer = getApiServer();

  const client = new QuireClient({
    tokens: {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      expiresAt: stored.expiresAt,
    },
    apiServer,
    headers: { "User-Agent": `quire-cli/${readVersion()}` },
    refreshTokens: (refreshToken) =>
      apiRefreshTokens({
        apiServer,
        clientId: QUIRE_CLI_CLIENT_ID,
        refreshToken,
      }),
    onTokenRefresh: async (tokens: QuireTokens) => {
      writeCredentials(
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          userOid: stored.userOid,
        },
        opts.profile,
      );
    },
    onAuthRevoked: async () => {
      deleteCredentials(opts.profile);
    },
  });
  return wrapWithRetry(client);
}

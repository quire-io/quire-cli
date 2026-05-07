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

export interface CreateQuireClientOptions {
  profile?: string;
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

  return new QuireClient({
    tokens: {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      expiresAt: stored.expiresAt,
    },
    apiServer,
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
}

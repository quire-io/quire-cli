import { exchangeCode, QuireClient } from "@quire-io/api-client";
import { Command } from "commander";
import open from "open";

import { getApiServer, resolveConfigPaths } from "../config.js";
import { writeCredentials } from "../credentials.js";
import { CliError, ExitCode } from "../errors.js";
import { createLogger } from "../log.js";
import { QUIRE_CLI_CLIENT_ID, QUIRE_CLI_LOOPBACK_PORT } from "../oauth/config.js";
import { startLoopbackServer } from "../oauth/loopback.js";
import { generatePkce, generateState } from "../oauth/pkce.js";

interface GlobalOpts {
  verbose?: boolean;
  json?: boolean;
  quiet?: boolean;
  colorMode?: "always" | "never" | "auto";
  profile?: string;
}

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Sign in to Quire via OAuth (loopback redirect + PKCE).")
    .action(async () => {
      const root = program.opts<GlobalOpts>();
      const log = createLogger({ verbose: root.verbose === true, color: root.colorMode });

      const apiServer = getApiServer();
      const { codeVerifier, codeChallenge } = generatePkce();
      const state = generateState();
      const server = await startLoopbackServer({ port: QUIRE_CLI_LOOPBACK_PORT });

      try {
        const authorizeUrl = new URL(`${apiServer}/oauth`);
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("client_id", QUIRE_CLI_CLIENT_ID);
        authorizeUrl.searchParams.set("redirect_uri", server.redirectUri);
        authorizeUrl.searchParams.set("code_challenge", codeChallenge);
        authorizeUrl.searchParams.set("code_challenge_method", "S256");
        authorizeUrl.searchParams.set("state", state);
        const url = authorizeUrl.toString();

        log.info("Opening your browser to authorize the Quire CLI…");
        log.info(`If the browser does not open, paste this URL:\n  ${url}`);

        try {
          await open(url);
        } catch (err) {
          // Headless / no browser available — the URL was already printed.
          log.debug(`open() failed: ${(err as Error).message}`);
        }

        const result = await server.waitForCallback();
        if (result.state !== state) {
          throw new CliError(
            "OAuth state mismatch — refusing to exchange code. This usually means the redirect was tampered with or arrived from a different login attempt.",
            ExitCode.Validation,
          );
        }

        const tokens = await exchangeCode({
          apiServer,
          clientId: QUIRE_CLI_CLIENT_ID,
          code: result.code,
          redirectUri: server.redirectUri,
          codeVerifier,
        });

        // Capture userOid + display name from /me before persisting, so the
        // credentials file is complete on first write.
        const probe = new QuireClient({ tokens, apiServer });
        const me = await probe.getMe();

        writeCredentials(
          {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            userOid: me.oid,
          },
          root.profile,
        );

        const { credentialsPath } = resolveConfigPaths(root.profile);
        const displayName = me.nameText ?? me.name;
        const emailSuffix = me.email ? ` (${me.email})` : "";

        if (root.json === true) {
          process.stdout.write(`${JSON.stringify(me)}\n`);
        } else if (root.quiet === true) {
          process.stdout.write(`${me.oid}\n`);
        } else {
          log.info(`Logged in as ${displayName}${emailSuffix} — credentials saved to ${credentialsPath}`);
        }
      } finally {
        server.close();
      }
    });
}

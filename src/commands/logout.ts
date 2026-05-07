import { Command } from "commander";

import { resolveConfigPaths } from "../config.js";
import { deleteCredentials, readCredentials } from "../credentials.js";
import { createLogger } from "../log.js";

interface GlobalOpts {
  verbose?: boolean;
  quiet?: boolean;
  colorMode?: "always" | "never" | "auto";
  profile?: string;
}

export function registerLogoutCommand(program: Command): void {
  program
    .command("logout")
    .description(
      "Delete the local credentials file. Note: this does not revoke the token server-side — to fully revoke, remove the app at https://quire.io/apps.",
    )
    .action(() => {
      const root = program.opts<GlobalOpts>();
      const log = createLogger({ verbose: root.verbose === true, color: root.colorMode });

      const stored = readCredentials(root.profile);
      const { credentialsPath } = resolveConfigPaths(root.profile);

      if (!stored) {
        if (root.quiet !== true) {
          log.info(`No credentials found at ${credentialsPath} — already logged out.`);
        }
        return;
      }

      deleteCredentials(root.profile);
      if (root.quiet !== true) {
        log.info(
          `Logged out — removed ${credentialsPath}. To revoke the token on the Quire server, remove the app at https://quire.io/apps.`,
        );
      }
    });
}

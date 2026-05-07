import { Command } from "commander";

import { createQuireClient } from "../quire-client.js";
import { createLogger } from "../log.js";

interface GlobalOpts {
  verbose?: boolean;
  json?: boolean;
  quiet?: boolean;
  colorMode?: "always" | "never" | "auto";
  profile?: string;
}

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("Show the signed-in Quire user and the orgs they belong to.")
    .action(async () => {
      const root = program.opts<GlobalOpts>();
      const log = createLogger({ verbose: root.verbose === true, color: root.colorMode });

      const client = createQuireClient({ profile: root.profile });
      const [me, orgs] = await Promise.all([client.getMe(), client.listOrganizations()]);

      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ ...me, organizations: orgs })}\n`);
        return;
      }

      if (root.quiet === true) {
        process.stdout.write(`${me.oid}\n`);
        return;
      }

      const displayName = me.nameText ?? me.name;
      const emailSuffix = me.email ? ` <${me.email}>` : "";
      log.info(`${displayName}${emailSuffix}`);
      if (orgs.length === 0) {
        log.info("  (no organizations)");
        return;
      }
      log.info("  Organizations:");
      for (const org of orgs) {
        const name = org.nameText ?? org.name;
        log.info(`    - ${name}  ${org.oid}`);
      }
    });
}

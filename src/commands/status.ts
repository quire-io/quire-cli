import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderList } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

export function registerStatusCommand(program: Command): void {
  const status = program.command("status").description("Quire workflow statuses.");

  status
    .command("list <project>")
    .description("List custom workflow statuses on a project. <project> = OID, slug, or URL.")
    .action(async (project: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(project);
      const statuses = await client.listStatuses(oid);
      renderList(statuses, root, {
        columns: [
          { header: "VALUE", get: (s) => String(s.value) },
          { header: "NAME", get: (s) => s.name },
          { header: "COLOR", get: (s) => s.color ?? "" },
          { header: "OID", get: (s) => s.oid ?? "" },
        ],
        toId: (s) => s.oid ?? String(s.value),
      });
    });
}

import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderList } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

export function registerSublistCommand(program: Command): void {
  const sublist = program.command("sublist").description("Quire sublists.");

  sublist
    .command("list <project>")
    .description("List sublists defined on a project. <project> = OID, slug, or URL.")
    .action(async (project: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(project);
      const sublists = await client.listSublists("project", oid);
      renderList(sublists, root, {
        columns: [
          { header: "ID", get: (s) => s.id },
          { header: "NAME", get: (s) => s.nameText ?? s.name },
          { header: "OID", get: (s) => s.oid },
        ],
        toId: (s) => s.oid,
      });
    });
}

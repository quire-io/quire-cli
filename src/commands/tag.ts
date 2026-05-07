import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderList } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

export function registerTagCommand(program: Command): void {
  const tag = program.command("tag").description("Quire tags.");

  tag
    .command("list <project>")
    .description("List tags defined on a project. <project> = OID, slug, or URL.")
    .action(async (project: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(project);
      const tags = await client.listTags(oid);
      renderList(tags, root, {
        columns: [
          { header: "NAME", get: (t) => t.nameText ?? t.name },
          { header: "COLOR", get: (t) => t.color ?? "" },
          { header: "OID", get: (t) => t.oid },
        ],
        toId: (t) => t.oid,
      });
    });
}

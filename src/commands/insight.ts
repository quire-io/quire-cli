import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

export function registerInsightCommand(program: Command): void {
  const insight = program.command("insight").description("Quire insights.");

  insight
    .command("list <project>")
    .description("List insights on a project. <project> = OID, slug, or URL.")
    .action(async (project: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(project);
      const insights = await client.listInsights(oid);
      renderList(insights, root, {
        columns: [
          { header: "ID", get: (i) => i.id },
          { header: "NAME", get: (i) => i.nameText ?? i.name },
          { header: "OID", get: (i) => i.oid },
        ],
        toId: (i) => i.oid,
      });
    });

  insight
    .command("get <id>")
    .description("Show insight details. <id> = insight OID.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const i = await client.getInsight(id);
      renderObject(i, root, {
        fields: [
          { label: "Name", get: (i) => i.nameText ?? i.name },
          { label: "ID", get: (i) => i.id },
          { label: "OID", get: (i) => i.oid },
          { label: "Description", get: (i) => i.descriptionText },
          { label: "URL", get: (i) => i.url },
        ],
        toId: (i) => i.oid,
      });
    });
}

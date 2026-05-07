import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderList } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { resolveTaskOid } from "../util/task-id.js";

export function registerCommentCommand(program: Command): void {
  const comment = program.command("comment").description("Quire task comments.");

  comment
    .command("list <task-id>")
    .description("List comments on a task. <task-id> = OID, project-slug/#408, or URL.")
    .action(async (taskId: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, taskId);
      const comments = await client.getTaskComments(oid);
      renderList(comments, root, {
        columns: [
          {
            header: "WHEN",
            get: (c) => (c as { createdAt?: string }).createdAt ?? "",
          },
          { header: "WHO", get: (c) => c.createdBy?.name ?? "" },
          {
            header: "TEXT",
            get: (c) => (c.descriptionText ?? "").replace(/\s+/g, " ").trim(),
          },
          { header: "OID", get: (c) => c.oid },
        ],
        toId: (c) => c.oid,
      });
    });
}

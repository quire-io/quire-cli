import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

export function registerProjectCommand(program: Command): void {
  const project = program.command("project").description("Quire projects.");

  project
    .command("list")
    .description("List projects you can see, optionally scoped to one organization.")
    .option("--org <id>", "Restrict to one organization (id = OID, slug, or URL).")
    .action(async (cmdOpts: { org?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projects = cmdOpts.org
        ? await client.listProjectsByOrg(await client.resolveOrgOid(cmdOpts.org))
        : await client.listProjects();
      renderList(projects, root, {
        columns: [
          { header: "ID", get: (p) => p.id },
          { header: "NAME", get: (p) => p.nameText ?? p.name },
          { header: "OID", get: (p) => p.oid },
        ],
        toId: (p) => p.oid,
      });
    });

  project
    .command("get <id>")
    .description("Show project details. <id> = OID, slug, or full URL.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(id);
      const p = await client.getProject(oid);
      renderObject(p, root, {
        fields: [
          { label: "Name", get: (p) => p.nameText ?? p.name },
          { label: "ID", get: (p) => p.id },
          { label: "OID", get: (p) => p.oid },
          { label: "Description", get: (p) => p.descriptionText },
          { label: "URL", get: (p) => p.url },
          { label: "Start", get: (p) => p.start },
          { label: "Due", get: (p) => p.due },
          { label: "Archived at", get: (p) => p.archivedAt },
          { label: "Public at", get: (p) => p.publicAt },
        ],
        toId: (p) => p.oid,
      });
    });

  project
    .command("members <id>")
    .description("List members of a project. <id> = OID, slug, or URL.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(id);
      const members = await client.listProjectMembers(oid);
      renderList(members, root, {
        columns: [
          { header: "NAME", get: (m) => m.nameText ?? m.name },
          { header: "EMAIL", get: (m) => m.email ?? "" },
          { header: "OID", get: (m) => m.oid },
        ],
        toId: (m) => m.oid,
      });
    });
}

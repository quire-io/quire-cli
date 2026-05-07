import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

export function registerOrgCommand(program: Command): void {
  const org = program.command("org").description("Quire organizations.");

  org
    .command("list")
    .description("List organizations you belong to.")
    .action(async () => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const orgs = await client.listOrganizations();
      renderList(orgs, root, {
        columns: [
          { header: "ID", get: (o) => o.id },
          { header: "NAME", get: (o) => o.nameText ?? o.name },
          { header: "OID", get: (o) => o.oid },
        ],
        toId: (o) => o.oid,
      });
    });

  org
    .command("get <id>")
    .description("Show details for one organization. <id> = OID, slug, or full URL.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveOrgOid(id);
      const o = await client.getOrganization(oid);
      renderObject(o, root, {
        fields: [
          { label: "Name", get: (o) => o.nameText ?? o.name },
          { label: "ID", get: (o) => o.id },
          { label: "OID", get: (o) => o.oid },
          { label: "Email", get: (o) => o.email },
          { label: "Website", get: (o) => o.website },
          { label: "Description", get: (o) => o.descriptionText },
          { label: "URL", get: (o) => o.url },
          { label: "Plan", get: (o) => o.subscription?.plan },
          { label: "Created at", get: (o) => o.createdAt },
        ],
        toId: (o) => o.oid,
      });
    });
}

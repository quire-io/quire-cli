import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

const PARTNER_FIELDS = [
  { label: "Name", get: (p: { name: string }) => p.name },
  { label: "OID", get: (p: { oid: string }) => p.oid },
  { label: "Color", get: (p: { color?: number }) => p.color === undefined ? undefined : String(p.color) },
];

export function registerPartnerCommand(program: Command): void {
  const partner = program.command("partner").description("Quire partner organizations (external teams).");

  partner
    .command("list <project>")
    .description("List partner organizations on a project. <project> = OID, slug, or URL.")
    .action(async (project: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const partners = await client.listPartners(projectOid);
      renderList(partners, root, {
        columns: [
          { header: "NAME", get: (p) => p.name },
          { header: "OID", get: (p) => p.oid },
        ],
        toId: (p) => p.oid,
      });
    });

  partner
    .command("get <oid>")
    .description("Show one partner organization.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const p = await client.getPartner(oid);
      renderObject(p, root, { fields: PARTNER_FIELDS, toId: (p) => p.oid });
    });
}

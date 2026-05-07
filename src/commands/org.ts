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
    .command("limit <id>")
    .description("Show API rate-limit usage for an organization.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveOrgOid(id);
      const limit = await client.getRateLimit(oid);

      const formatBucket = (b: { limit: number; used: number; remaining: number; reset: number }): string => {
        // Quire's `expiresAt` is documented in epoch ms; assume `reset` follows
        // the same convention. If a Date round-trips to year 1970, fall back to
        // treating the number as seconds.
        const isoMs = new Date(b.reset).toISOString();
        const iso = isoMs.startsWith("1970") ? new Date(b.reset * 1000).toISOString() : isoMs;
        return `${b.used} / ${b.limit} used (${b.remaining} remaining, resets ${iso})`;
      };

      renderObject(limit, root, {
        fields: [
          { label: "Organization", get: (l) => l.organization },
          { label: "Plan", get: (l) => l.plan },
          { label: "Per minute", get: (l) => formatBucket(l.minute) },
          { label: "Per hour", get: (l) => formatBucket(l.hour) },
        ],
        toId: (l) => l.organization,
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

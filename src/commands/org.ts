import { Command } from "commander";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { resolveTextInput } from "../util/text-input.js";

const ORG_GET_FIELDS = [
  { label: "Name", get: (o: { nameText?: string; name: string }) => o.nameText ?? o.name },
  { label: "ID", get: (o: { id: string }) => o.id },
  { label: "OID", get: (o: { oid: string }) => o.oid },
  { label: "Email", get: (o: { email?: string }) => o.email },
  { label: "Website", get: (o: { website?: string }) => o.website },
  { label: "Description", get: (o: { descriptionText?: string }) => o.descriptionText },
  { label: "URL", get: (o: { url?: string }) => o.url },
  { label: "Plan", get: (o: { subscription?: { plan?: string } }) => o.subscription?.plan },
  { label: "Created at", get: (o: { createdAt?: string }) => o.createdAt },
];

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

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
      renderObject(o, root, { fields: ORG_GET_FIELDS, toId: (o) => o.oid });
    });

  org
    .command("update <id>")
    .description("Update organization metadata.")
    .option("--name <name>", "New name")
    .option("--description <text>", "New description ('-' = stdin, '@file' = file)")
    .option("--add-follower <user>", "Add follower; repeat for multiple", append, [] as string[])
    .option("--remove-follower <user>", "Remove follower; repeat for multiple", append, [] as string[])
    .action(async (id: string, cmdOpts: {
      name?: string; description?: string;
      addFollower?: string[]; removeFollower?: string[];
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveOrgOid(id);
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const body: {
        name?: string; description?: string;
        addFollowers?: string[]; removeFollowers?: string[];
      } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (description !== undefined) body.description = description;
      if ((cmdOpts.addFollower?.length ?? 0) > 0) body.addFollowers = cmdOpts.addFollower;
      if ((cmdOpts.removeFollower?.length ?? 0) > 0) body.removeFollowers = cmdOpts.removeFollower;
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`org update` requires at least one of --name / --description / --add-follower / --remove-follower.");
      }
      const o = await client.updateOrganization(oid, body);
      renderObject(o, root, { fields: ORG_GET_FIELDS, toId: (o) => o.oid });
    });
}

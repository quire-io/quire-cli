import { Command } from "commander";
import { resolveColor } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { longColor, shortColor } from "../output/colors.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";

function normalizeColor(input: string | undefined): string | undefined {
  if (input === undefined) return undefined;
  const code = resolveColor(input);
  if (code === undefined) {
    throw new ValidationError(
      `Color "${input}" is not a recognized palette name or code. Use a name like 'red'/'blue'/'green' or a 2-digit code '00'..'57'.`,
    );
  }
  return code;
}

const TAG_FIELDS = [
  { label: "Name", get: (t: { nameText?: string; name: string }) => t.nameText ?? t.name },
  { label: "Color", get: (t: { color?: string }) => longColor(t.color) },
  { label: "OID", get: (t: { oid: string }) => t.oid },
  { label: "URL", get: (t: { url?: string }) => t.url },
];

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
          { header: "COLOR", get: (t) => shortColor(t.color) },
          { header: "OID", get: (t) => t.oid },
        ],
        toId: (t) => t.oid,
      });
    });

  tag
    .command("get <oid>")
    .description("Show one tag.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const t = await client.getTag(oid);
      renderObject(t, root, { fields: TAG_FIELDS, toId: (t) => t.oid });
    });

  tag
    .command("create <project>")
    .description("Create a tag in a project.")
    .requiredOption("--name <name>", "Tag name (required)")
    .option("--color <color>", "Color: name like 'red'/'blue' or 2-digit code '00'..'57'")
    .action(async (project: string, cmdOpts: { name: string; color?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const color = normalizeColor(cmdOpts.color);
      const t = await client.createTag(projectOid, {
        name: cmdOpts.name,
        ...(color !== undefined ? { color } : {}),
      });
      renderObject(t, root, { fields: TAG_FIELDS, toId: (t) => t.oid });
    });

  tag
    .command("update <oid>")
    .description("Update a tag's name and/or color.")
    .option("--name <name>", "New name")
    .option("--color <color>", "New color: name or 2-digit code")
    .action(async (oid: string, cmdOpts: { name?: string; color?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const color = normalizeColor(cmdOpts.color);
      const body: { name?: string; color?: string } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (color !== undefined) body.color = color;
      if (body.name === undefined && body.color === undefined) {
        throw new ValidationError("`tag update` requires at least one of --name or --color.");
      }
      const t = await client.updateTag(oid, body);
      renderObject(t, root, { fields: TAG_FIELDS, toId: (t) => t.oid });
    });

  tag
    .command("delete <oid>")
    .description("Delete a tag. Prompts for confirmation unless --yes is set.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      await confirmDestructive({
        question: `Delete tag ${oid}? This removes the tag from every task that uses it.`,
        yes: root.yes,
      });
      await client.deleteTag(oid);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Deleted tag ${oid}.\n`);
      }
    });
}

import { Command } from "commander";
import { resolveColor } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";
import type { FieldFlags } from "../util/field-flags.js";
import { buildFieldBody, FIELD_FIELDS } from "../util/field-flags.js";
import { resolveTextInput } from "../util/text-input.js";

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

function normalizeInsightColor(input: string | undefined): string | undefined {
  if (input === undefined) return undefined;
  const code = resolveColor(input);
  if (code === undefined) {
    throw new ValidationError(
      `Color "${input}" is not a recognized palette name or code. Use a name like 'red'/'blue' or a 2-digit code '00'..'57'.`,
    );
  }
  return code;
}

const INSIGHT_FIELDS = [
  { label: "Name", get: (i: { nameText?: string; name: string }) => i.nameText ?? i.name },
  { label: "ID", get: (i: { id: string }) => i.id },
  { label: "OID", get: (i: { oid: string }) => i.oid },
  { label: "Description", get: (i: { descriptionText?: string }) => i.descriptionText },
  { label: "Icon color", get: (i: { iconColor?: string }) => i.iconColor },
  { label: "URL", get: (i: { url?: string }) => i.url },
];

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
      renderObject(i, root, { fields: INSIGHT_FIELDS, toId: (i) => i.oid });
    });

  insight
    .command("create <project>")
    .description("Create an insight inside a project.")
    .requiredOption("--name <name>", "Insight name (required)")
    .option("--id <id>", "Caller-supplied id (must pass Quire's isValidId)")
    .option("--description <text>", "Description; '-' for stdin or '@file' for a file")
    .option("--icon-color <color>", "Color: name like 'red'/'blue' or 2-digit code")
    .option("--image <url>", "Icon image URL")
    .action(async (project: string, cmdOpts: {
      name: string; id?: string; description?: string; iconColor?: string; image?: string;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const iconColor = cmdOpts.iconColor !== undefined ? normalizeInsightColor(cmdOpts.iconColor) : undefined;
      const i = await client.createInsight("project", projectOid, {
        name: cmdOpts.name,
        ...(cmdOpts.id !== undefined ? { id: cmdOpts.id } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(iconColor !== undefined ? { iconColor } : {}),
        ...(cmdOpts.image !== undefined ? { image: cmdOpts.image } : {}),
      });
      renderObject(i, root, { fields: INSIGHT_FIELDS, toId: (i) => i.oid });
    });

  insight
    .command("update <oid>")
    .description("Update an insight.")
    .option("--name <name>")
    .option("--description <text>", "'-' = stdin, '@file' = file")
    .option("--icon-color <color>")
    .option("--image <url>")
    .option("--archive", "Archive the insight")
    .option("--unarchive", "Unarchive the insight")
    .action(async (oid: string, cmdOpts: {
      name?: string; description?: string; iconColor?: string; image?: string;
      archive?: boolean; unarchive?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      if (cmdOpts.archive === true && cmdOpts.unarchive === true) {
        throw new ValidationError("Cannot combine --archive and --unarchive.");
      }
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const iconColor = cmdOpts.iconColor !== undefined ? normalizeInsightColor(cmdOpts.iconColor) : undefined;
      const body: { name?: string; description?: string; iconColor?: string; image?: string; archived?: boolean } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (description !== undefined) body.description = description;
      if (iconColor !== undefined) body.iconColor = iconColor;
      if (cmdOpts.image !== undefined) body.image = cmdOpts.image;
      if (cmdOpts.archive === true) body.archived = true;
      if (cmdOpts.unarchive === true) body.archived = false;
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`insight update` requires at least one change-flag.");
      }
      const i = await client.updateInsight(oid, body);
      renderObject(i, root, { fields: INSIGHT_FIELDS, toId: (i) => i.oid });
    });

  insight
    .command("delete <oid>")
    .description("Delete an insight. Prompts unless --yes.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      await confirmDestructive({
        question: `Delete insight ${oid}? Run \`quire insight undo-remove ${oid}\` (or \`quire undo insight ${oid}\`) to restore.`,
        yes: root.yes,
      });
      await client.deleteInsight(oid);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Deleted insight ${oid}.\n`);
      }
    });

  insight
    .command("undo-remove <oid>")
    .description("Restore a deleted insight.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const i = await client.undoRemoveInsight(oid);
      renderObject(i, root, { fields: INSIGHT_FIELDS, toId: (i) => i.oid });
    });

  // -------- Custom field definitions on insights (Phase 5.3 slice C) --------
  // Insights only support `formula` and `lookup` field types per the plan;
  // the api accepts the body and lets the server validate.

  const field = insight
    .command("field")
    .description("Manage custom-field definitions on an insight (formula / lookup types).");

  field
    .command("add <insight-oid>")
    .description("Add a custom-field to an insight. Insights only allow formula / lookup types.")
    .requiredOption("--name <name>", "Field name (required)")
    .requiredOption("--type <type>", "Field type (insights: formula | lookup)")
    .option("--hidden")
    .option("--private")
    .option("--percent")
    .option("--multiple")
    .option("--clear-on-dup")
    .option("--extra <kv>", "key=value; repeat for type-specific config", append, [] as string[])
    .action(async (insightOid: string, cmdOpts: FieldFlags) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const body = buildFieldBody(cmdOpts);
      const f = await client.addInsightField(insightOid, body as { name: string; type: string });
      renderObject(f, root, { fields: FIELD_FIELDS, toId: (f) => f.name });
    });

  field
    .command("update <insight-oid> <field-name>")
    .description("Update a custom-field definition on an insight.")
    .option("--type <type>", "New type")
    .option("--hidden")
    .option("--private")
    .option("--percent")
    .option("--multiple")
    .option("--clear-on-dup")
    .option("--extra <kv>", "key=value; repeat", append, [] as string[])
    .action(async (insightOid: string, fieldName: string, cmdOpts: Omit<FieldFlags, "name">) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const body = buildFieldBody(cmdOpts);
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`insight field update` requires at least one of --type / --hidden / --private / --percent / --multiple / --clear-on-dup / --extra.");
      }
      const f = await client.updateInsightField(insightOid, fieldName, body);
      renderObject(f, root, { fields: FIELD_FIELDS, toId: (f) => f.name });
    });

  field
    .command("rename <insight-oid> <field-name>")
    .description("Rename an insight custom-field.")
    .requiredOption("--new-name <new-name>", "New field name")
    .action(async (insightOid: string, fieldName: string, cmdOpts: { newName: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const f = await client.renameInsightField(insightOid, fieldName, cmdOpts.newName);
      renderObject(f, root, { fields: FIELD_FIELDS, toId: (f) => f.name });
    });

  field
    .command("move <insight-oid> <field-name>")
    .description("Reorder an insight custom-field.")
    .option("--before <field-name>", "Move just before this field")
    .option("--to-end", "Move to the end of the field list")
    .action(async (insightOid: string, fieldName: string, cmdOpts: { before?: string; toEnd?: boolean }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      if (cmdOpts.before !== undefined && cmdOpts.toEnd === true) {
        throw new ValidationError("Cannot combine --before and --to-end.");
      }
      const before = cmdOpts.toEnd === true ? null : cmdOpts.before;
      const f = await client.moveInsightField(insightOid, fieldName, before);
      renderObject(f, root, { fields: FIELD_FIELDS, toId: (f) => f.name });
    });

  field
    .command("remove <insight-oid> <field-name>")
    .description("Remove a custom-field from an insight. Prompts unless --yes.")
    .action(async (insightOid: string, fieldName: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      await confirmDestructive({
        question: `Remove custom-field "${fieldName}" from insight ${insightOid}?`,
        yes: root.yes,
      });
      await client.removeInsightField(insightOid, fieldName);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ insight: insightOid, field: fieldName, removed: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${fieldName}\n`);
      } else {
        process.stderr.write(`Removed custom-field "${fieldName}" from insight ${insightOid}.\n`);
      }
    });
}

import { Command } from "commander";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";
import type { FieldFlags } from "../util/field-flags.js";
import { buildFieldBody, FIELD_FIELDS } from "../util/field-flags.js";

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

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

import { writeFileSync } from "node:fs";

import { Command } from "commander";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";
import type { FieldFlags } from "../util/field-flags.js";
import { buildFieldBody, FIELD_FIELDS } from "../util/field-flags.js";
import { resolveTextInput } from "../util/text-input.js";

const PROJECT_GET_FIELDS = [
  { label: "Name", get: (p: { nameText?: string; name: string }) => p.nameText ?? p.name },
  { label: "ID", get: (p: { id: string }) => p.id },
  { label: "OID", get: (p: { oid: string }) => p.oid },
  { label: "Description", get: (p: { descriptionText?: string }) => p.descriptionText },
  { label: "URL", get: (p: { url?: string }) => p.url },
  { label: "Start", get: (p: { start?: string }) => p.start },
  { label: "Due", get: (p: { due?: string }) => p.due },
  { label: "Archived at", get: (p: { archivedAt?: string }) => p.archivedAt },
  { label: "Public at", get: (p: { publicAt?: string }) => p.publicAt },
];

const APPROVAL_CATEGORY_FIELDS = [
  { label: "ID", get: (c: { id: string }) => c.id },
  { label: "Name", get: (c: { name: string }) => c.name },
  {
    label: "Claimers",
    get: (c: { claimers?: string[] }) =>
      c.claimers === undefined ? "(anyone)" : c.claimers.length === 0 ? "(admins only)" : c.claimers.join(", "),
  },
  {
    label: "Approvers",
    get: (c: { approvers?: string[] }) =>
      c.approvers === undefined ? "(anyone)" : c.approvers.length === 0 ? "(admins only)" : c.approvers.join(", "),
  },
];

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

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
      renderObject(p, root, { fields: PROJECT_GET_FIELDS, toId: (p) => p.oid });
    });

  project
    .command("update <id>")
    .description("Update project metadata. Pass 'null' to --start / --due to clear.")
    .option("--name <name>", "New name")
    .option("--description <text>", "New description ('-' = stdin, '@file' = file)")
    .option("--start <date>", "Start date or 'null' to clear")
    .option("--due <date>", "Due date or 'null' to clear")
    .option("--archive", "Archive the project")
    .option("--unarchive", "Unarchive the project")
    .option("--public", "Make the project public to the organization")
    .option("--private", "Make the project private")
    .option("--add-follower <user>", "Add follower; repeat for multiple", append, [] as string[])
    .option("--remove-follower <user>", "Remove follower; repeat for multiple", append, [] as string[])
    .action(async (id: string, cmdOpts: {
      name?: string; description?: string;
      start?: string; due?: string;
      archive?: boolean; unarchive?: boolean;
      public?: boolean; private?: boolean;
      addFollower?: string[]; removeFollower?: string[];
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      if (cmdOpts.archive === true && cmdOpts.unarchive === true) {
        throw new ValidationError("Cannot combine --archive and --unarchive.");
      }
      if (cmdOpts.public === true && cmdOpts.private === true) {
        throw new ValidationError("Cannot combine --public and --private.");
      }
      const oid = await client.resolveProjectOid(id);
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const body: {
        name?: string; description?: string;
        start?: string | null; due?: string | null;
        archived?: boolean; public?: boolean;
        addFollowers?: string[]; removeFollowers?: string[];
      } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (description !== undefined) body.description = description;
      if (cmdOpts.start !== undefined) body.start = cmdOpts.start === "null" ? null : cmdOpts.start;
      if (cmdOpts.due !== undefined) body.due = cmdOpts.due === "null" ? null : cmdOpts.due;
      if (cmdOpts.archive === true) body.archived = true;
      if (cmdOpts.unarchive === true) body.archived = false;
      if (cmdOpts.public === true) body.public = true;
      if (cmdOpts.private === true) body.public = false;
      if ((cmdOpts.addFollower?.length ?? 0) > 0) body.addFollowers = cmdOpts.addFollower;
      if ((cmdOpts.removeFollower?.length ?? 0) > 0) body.removeFollowers = cmdOpts.removeFollower;
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`project update` requires at least one of --name / --description / --start / --due / --archive / --unarchive / --public / --private / --add-follower / --remove-follower.");
      }
      const p = await client.updateProject(oid, body);
      renderObject(p, root, { fields: PROJECT_GET_FIELDS, toId: (p) => p.oid });
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

  project
    .command("export <id>")
    .description("Export the entire project as CSV (default) or JSON. Writes to stdout unless --output is set.")
    .option("--format <fmt>", "Export format: csv | json", "csv")
    .option("--output <file>", "Write to this path instead of stdout (use '-' for stdout, the default)")
    .action(async (id: string, cmdOpts: { format: string; output?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      if (cmdOpts.format !== "csv" && cmdOpts.format !== "json") {
        throw new ValidationError("--format must be one of: csv, json");
      }
      const oid = await client.resolveProjectOid(id);
      const body = cmdOpts.format === "csv"
        ? await client.exportProjectCsv(oid)
        : await client.exportProjectJson(oid);
      if (cmdOpts.output !== undefined && cmdOpts.output !== "-") {
        writeFileSync(cmdOpts.output, body);
        if (root.quiet === true) {
          process.stdout.write(`${cmdOpts.output}\n`);
        } else if (root.json !== true) {
          process.stderr.write(`Wrote ${body.length} bytes to ${cmdOpts.output}.\n`);
        }
      } else {
        process.stdout.write(body);
        if (!body.endsWith("\n")) process.stdout.write("\n");
      }
    });

  // -------- Approval categories (Phase 5.3 slice B) --------

  const approvalCategory = project
    .command("approval-category")
    .description("Manage approval categories (gates that group approvers / claimers per project).");

  approvalCategory
    .command("add <project>")
    .description("Add an approval category to a project.")
    .requiredOption("--id <id>", "Caller-supplied id (must pass Quire's isValidId; '' is the implicit Default)")
    .requiredOption("--name <name>", "Category name")
    .option("--claimer <user>", "Claimer (OID, id, or email); repeat for multiple. Omit for 'anyone'.", append, [] as string[])
    .option("--approver <user>", "Approver; repeat for multiple. Omit for 'anyone'.", append, [] as string[])
    .option("--claimers-admins-only", "Restrict claimers to admins (overrides --claimer)")
    .option("--approvers-admins-only", "Restrict approvers to admins (overrides --approver)")
    .action(async (projectInput: string, cmdOpts: {
      id: string; name: string;
      claimer?: string[]; approver?: string[];
      claimersAdminsOnly?: boolean; approversAdminsOnly?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);
      const claimers = cmdOpts.claimersAdminsOnly === true
        ? []
        : (cmdOpts.claimer?.length ?? 0) > 0 ? cmdOpts.claimer : undefined;
      const approvers = cmdOpts.approversAdminsOnly === true
        ? []
        : (cmdOpts.approver?.length ?? 0) > 0 ? cmdOpts.approver : undefined;
      const c = await client.addProjectApprovalCategory(projectOid, {
        id: cmdOpts.id,
        name: cmdOpts.name,
        ...(claimers !== undefined ? { claimers } : {}),
        ...(approvers !== undefined ? { approvers } : {}),
      });
      renderObject(c, root, { fields: APPROVAL_CATEGORY_FIELDS, toId: (c) => c.id });
    });

  approvalCategory
    .command("update <project> <category-id>")
    .description("Update an approval category. --claimers-anyone / --approvers-anyone resets to 'anyone'.")
    .option("--name <name>", "New name")
    .option("--claimer <user>", "Replace claimer list; repeat for multiple", append, [] as string[])
    .option("--approver <user>", "Replace approver list; repeat for multiple", append, [] as string[])
    .option("--claimers-admins-only", "Restrict claimers to admins (empty list)")
    .option("--approvers-admins-only", "Restrict approvers to admins (empty list)")
    .option("--claimers-anyone", "Reset claimers to anyone (clears the list)")
    .option("--approvers-anyone", "Reset approvers to anyone (clears the list)")
    .action(async (projectInput: string, categoryId: string, cmdOpts: {
      name?: string;
      claimer?: string[]; approver?: string[];
      claimersAdminsOnly?: boolean; approversAdminsOnly?: boolean;
      claimersAnyone?: boolean; approversAnyone?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);

      let claimers: string[] | null | undefined;
      if (cmdOpts.claimersAnyone === true) claimers = null;
      else if (cmdOpts.claimersAdminsOnly === true) claimers = [];
      else if ((cmdOpts.claimer?.length ?? 0) > 0) claimers = cmdOpts.claimer;

      let approvers: string[] | null | undefined;
      if (cmdOpts.approversAnyone === true) approvers = null;
      else if (cmdOpts.approversAdminsOnly === true) approvers = [];
      else if ((cmdOpts.approver?.length ?? 0) > 0) approvers = cmdOpts.approver;

      const body: { name?: string; claimers?: string[] | null; approvers?: string[] | null } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (claimers !== undefined) body.claimers = claimers;
      if (approvers !== undefined) body.approvers = approvers;

      const c = await client.updateProjectApprovalCategory(projectOid, categoryId, body);
      renderObject(c, root, { fields: APPROVAL_CATEGORY_FIELDS, toId: (c) => c.id });
    });

  approvalCategory
    .command("remove <project> <category-id>")
    .description("Remove an approval category from a project. Prompts unless --yes.")
    .action(async (projectInput: string, categoryId: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);
      await confirmDestructive({
        question: `Remove approval category "${categoryId}" from project ${projectOid}? Tasks using this category will fall back to the default.`,
        yes: root.yes,
      });
      await client.removeProjectApprovalCategory(projectOid, categoryId);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ project: projectOid, category: categoryId, removed: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${categoryId}\n`);
      } else {
        process.stderr.write(`Removed approval category "${categoryId}" from project ${projectOid}.\n`);
      }
    });

  // -------- Custom field definitions (Phase 5.3 slice C) --------

  const field = project
    .command("field")
    .description("Manage custom-field definitions on a project.");

  field
    .command("add <project>")
    .description("Add a custom-field definition. Use --extra for type-specific config (JSON-parsed when possible).")
    .requiredOption("--name <name>", "Field name (required)")
    .requiredOption("--type <type>", "Field type: text|number|money|date|duration|select|checkbox|user|task|hyperlink|email|formula|file|lookup")
    .option("--hidden", "Hide the field by default")
    .option("--private", "Mark as private (visible only to admins)")
    .option("--percent", "Format numeric values as percentage")
    .option("--multiple", "Allow multiple values")
    .option("--clear-on-dup", "Clear value when a task is duplicated")
    .option("--extra <kv>", "key=value; repeat for type-specific config (e.g. --extra options='[{...}]')", append, [] as string[])
    .action(async (projectInput: string, cmdOpts: FieldFlags) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);
      const body = buildFieldBody(cmdOpts);
      const f = await client.addProjectField(projectOid, body as { name: string; type: string });
      renderObject(f, root, { fields: FIELD_FIELDS, toId: (f) => f.name });
    });

  field
    .command("update <project> <field-name>")
    .description("Update a custom-field definition. Use --rename for renaming (or `field rename` for the dedicated command).")
    .option("--type <type>", "New type")
    .option("--hidden")
    .option("--private")
    .option("--percent")
    .option("--multiple")
    .option("--clear-on-dup")
    .option("--extra <kv>", "key=value; repeat for type-specific config", append, [] as string[])
    .action(async (projectInput: string, fieldName: string, cmdOpts: Omit<FieldFlags, "name">) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);
      const body = buildFieldBody(cmdOpts);
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`field update` requires at least one of --type / --hidden / --private / --percent / --multiple / --clear-on-dup / --extra.");
      }
      const f = await client.updateProjectField(projectOid, fieldName, body);
      renderObject(f, root, { fields: FIELD_FIELDS, toId: (f) => f.name });
    });

  field
    .command("rename <project> <field-name>")
    .description("Rename a custom-field definition.")
    .requiredOption("--new-name <new-name>", "New field name")
    .action(async (projectInput: string, fieldName: string, cmdOpts: { newName: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);
      const f = await client.renameProjectField(projectOid, fieldName, cmdOpts.newName);
      renderObject(f, root, { fields: FIELD_FIELDS, toId: (f) => f.name });
    });

  field
    .command("move <project> <field-name>")
    .description("Reorder a custom-field definition. --before <field-name> places it just before that field; --to-end puts it at the end.")
    .option("--before <field-name>", "Move just before this field")
    .option("--to-end", "Move to the end of the field list")
    .action(async (projectInput: string, fieldName: string, cmdOpts: { before?: string; toEnd?: boolean }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);
      if (cmdOpts.before !== undefined && cmdOpts.toEnd === true) {
        throw new ValidationError("Cannot combine --before and --to-end.");
      }
      const before = cmdOpts.toEnd === true ? null : cmdOpts.before;
      const f = await client.moveProjectField(projectOid, fieldName, before);
      renderObject(f, root, { fields: FIELD_FIELDS, toId: (f) => f.name });
    });

  field
    .command("remove <project> <field-name>")
    .description("Remove a custom-field definition. Prompts unless --yes.")
    .action(async (projectInput: string, fieldName: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);
      await confirmDestructive({
        question: `Remove custom-field "${fieldName}" from project ${projectOid}? Existing values on tasks will be dropped.`,
        yes: root.yes,
      });
      await client.removeProjectField(projectOid, fieldName);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ project: projectOid, field: fieldName, removed: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${fieldName}\n`);
      } else {
        process.stderr.write(`Removed custom-field "${fieldName}" from project ${projectOid}.\n`);
      }
    });
}

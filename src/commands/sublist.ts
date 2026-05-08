import { Command } from "commander";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";
import { resolveTaskOid } from "../util/task-id.js";

const SUBLIST_FIELDS = [
  { label: "Name", get: (s: { nameText?: string; name: string }) => s.nameText ?? s.name },
  { label: "ID", get: (s: { id: string }) => s.id },
  { label: "OID", get: (s: { oid: string }) => s.oid },
  { label: "Description", get: (s: { descriptionText?: string }) => s.descriptionText },
  { label: "Start", get: (s: { start?: string }) => s.start },
  { label: "Due", get: (s: { due?: string }) => s.due },
  { label: "URL", get: (s: { url?: string }) => s.url },
];

export function registerSublistCommand(program: Command): void {
  const sublist = program.command("sublist").description("Quire sublists.");

  sublist
    .command("list <project>")
    .description("List sublists defined on a project. <project> = OID, slug, or URL.")
    .action(async (project: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(project);
      const sublists = await client.listSublists("project", oid);
      renderList(sublists, root, {
        columns: [
          { header: "ID", get: (s) => s.id },
          { header: "NAME", get: (s) => s.nameText ?? s.name },
          { header: "OID", get: (s) => s.oid },
        ],
        toId: (s) => s.oid,
      });
    });

  sublist
    .command("create <project>")
    .description("Create a sublist in a project.")
    .requiredOption("--name <name>", "Sublist name (required)")
    .option("--description <text>", "Sublist description")
    .action(async (project: string, cmdOpts: { name: string; description?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const s = await client.createSublist("project", projectOid, {
        name: cmdOpts.name,
        ...(cmdOpts.description !== undefined ? { description: cmdOpts.description } : {}),
      });
      renderObject(s, root, { fields: SUBLIST_FIELDS, toId: (s) => s.oid });
    });

  sublist
    .command("update <oid>")
    .description("Update a sublist's fields.")
    .option("--name <name>")
    .option("--description <text>")
    .option("--start <date>")
    .option("--due <date>")
    .option("--archive", "Archive the sublist")
    .option("--unarchive", "Unarchive the sublist")
    .action(async (oid: string, cmdOpts: {
      name?: string; description?: string; start?: string; due?: string;
      archive?: boolean; unarchive?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });

      if (cmdOpts.archive === true && cmdOpts.unarchive === true) {
        throw new ValidationError("Cannot combine --archive and --unarchive.");
      }

      const body: { name?: string; description?: string; start?: string; due?: string; archived?: boolean } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (cmdOpts.description !== undefined) body.description = cmdOpts.description;
      if (cmdOpts.start !== undefined) body.start = cmdOpts.start;
      if (cmdOpts.due !== undefined) body.due = cmdOpts.due;
      if (cmdOpts.archive === true) body.archived = true;
      if (cmdOpts.unarchive === true) body.archived = false;

      if (Object.keys(body).length === 0) {
        throw new ValidationError("`sublist update` requires at least one of --name / --description / --start / --due / --archive / --unarchive.");
      }

      const s = await client.updateSublist(oid, body);
      renderObject(s, root, { fields: SUBLIST_FIELDS, toId: (s) => s.oid });
    });

  sublist
    .command("add-task <sublist-oid> <task>")
    .description("Add a task to a sublist. <task> = OID, slug/#N, or URL.")
    .action(async (sublistOid: string, taskInput: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const taskOid = await resolveTaskOid(client, taskInput);
      const s = await client.updateSublistMembership(sublistOid, [{ task: taskOid }]);
      renderObject(s, root, { fields: SUBLIST_FIELDS, toId: (s) => s.oid });
    });

  sublist
    .command("remove-task <sublist-oid> <task>")
    .description("Remove a task from a sublist. <task> = OID, slug/#N, or URL.")
    .action(async (sublistOid: string, taskInput: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const taskOid = await resolveTaskOid(client, taskInput);
      const s = await client.updateSublistMembership(sublistOid, [{ task: taskOid, exclude: true }]);
      renderObject(s, root, { fields: SUBLIST_FIELDS, toId: (s) => s.oid });
    });

  sublist
    .command("delete <oid>")
    .description("Delete a sublist. Prompts for confirmation unless --yes is set.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      await confirmDestructive({
        question: `Delete sublist ${oid}? Run \`quire sublist undo-remove ${oid}\` to restore.`,
        yes: root.yes,
      });
      await client.deleteSublist(oid);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Deleted sublist ${oid}.\n`);
      }
    });

  sublist
    .command("undo-remove <oid>")
    .description("Restore a deleted sublist.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const s = await client.undoRemoveSublist(oid);
      renderObject(s, root, { fields: SUBLIST_FIELDS, toId: (s) => s.oid });
    });
}

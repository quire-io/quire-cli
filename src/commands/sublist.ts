import { Command } from "commander";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import {
  addMemberOptions, addPrivateOption, addPrivateToggle, formatMembers, formatPrivate, resolveMembers,
} from "../util/member-flags.js";
import type { MemberFlags } from "../util/member-flags.js";
import { confirmDestructive } from "../util/confirm.js";
import { resolveTaskOid } from "../util/task-id.js";

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

const SUBLIST_FIELDS = [
  { label: "Name", get: (s: { nameText?: string; name: string }) => s.nameText ?? s.name },
  { label: "ID", get: (s: { id: string }) => s.id },
  { label: "OID", get: (s: { oid: string }) => s.oid },
  { label: "Description", get: (s: { descriptionText?: string }) => s.descriptionText },
  { label: "Start", get: (s: { start?: string }) => s.start },
  { label: "Due", get: (s: { due?: string }) => s.due },
  { label: "Members", get: (s: { members?: ({ name?: string; oid: string } | string)[] | null }) => formatMembers(s.members) },
  { label: "Private", get: (s: { private?: boolean }) => formatPrivate(s.private) },
  { label: "All tasks", get: (s: { all?: boolean }) => (s.all === true ? "yes" : undefined) },
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
    .command("get <oid>")
    .description("Show one sublist.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const s = await client.getSublist(oid);
      renderObject(s, root, { fields: SUBLIST_FIELDS, toId: (s) => s.oid });
    });

  addPrivateOption(addMemberOptions(sublist
    .command("create <project>")
    .description("Create a sublist in a project.")
    .requiredOption("--name <name>", "Sublist name (required)")
    .option("--description <text>", "Sublist description")
    .option("--start <date>", "Start date (YYYY-MM-DD; a time of day is rejected)")
    .option("--due <date>", "Due date (YYYY-MM-DD; a time of day is rejected)")
    .option("--include <task>", "Put this task, with all its subtasks, in the new sublist (OID, slug/#N, or URL); repeat for multiple", append, [] as string[])
    .option("--all", "Put every task of the project in the new sublist; take some out with remove-task. Can't be changed later")))
    .action(async (project: string, cmdOpts: {
      name: string; description?: string; start?: string; due?: string; include?: string[]; all?: boolean; private?: boolean;
    } & MemberFlags) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const members = resolveMembers(cmdOpts);
      const projectOid = await client.resolveProjectOid(project);
      const includes = await Promise.all((cmdOpts.include ?? []).map((t) => resolveTaskOid(client, t)));
      const s = await client.createSublist("project", projectOid, {
        name: cmdOpts.name,
        ...(cmdOpts.description !== undefined ? { description: cmdOpts.description } : {}),
        ...(cmdOpts.start !== undefined ? { start: cmdOpts.start } : {}),
        ...(cmdOpts.due !== undefined ? { due: cmdOpts.due } : {}),
        ...(includes.length > 0 ? { includes } : {}),
        ...(cmdOpts.all === true ? { all: true } : {}),
        ...(members !== undefined ? { members } : {}),
        ...(cmdOpts.private === true ? { private: true } : {}),
      });
      renderObject(s, root, { fields: SUBLIST_FIELDS, toId: (s) => s.oid });
    });

  addPrivateToggle(sublist
    .command("update <oid>")
    .description("Update a sublist's fields.")
    .option("--name <name>")
    .option("--description <text>")
    .option("--start <date>", "Start date (YYYY-MM-DD; a time of day is rejected)")
    .option("--due <date>", "Due date (YYYY-MM-DD; a time of day is rejected)")
    .option("--archive", "Archive the sublist")
    .option("--unarchive", "Unarchive the sublist"))
    .action(async (oid: string, cmdOpts: {
      name?: string; description?: string; start?: string; due?: string;
      archive?: boolean; unarchive?: boolean; private?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });

      if (cmdOpts.archive === true && cmdOpts.unarchive === true) {
        throw new ValidationError("Cannot combine --archive and --unarchive.");
      }

      const body: { name?: string; description?: string; start?: string; due?: string; archived?: boolean; private?: boolean } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (cmdOpts.description !== undefined) body.description = cmdOpts.description;
      if (cmdOpts.start !== undefined) body.start = cmdOpts.start;
      if (cmdOpts.due !== undefined) body.due = cmdOpts.due;
      if (cmdOpts.archive === true) body.archived = true;
      if (cmdOpts.unarchive === true) body.archived = false;
      if (cmdOpts.private !== undefined) body.private = cmdOpts.private;

      if (Object.keys(body).length === 0) {
        throw new ValidationError("`sublist update` requires at least one of --name / --description / --start / --due / --archive / --unarchive / --private / --no-private.");
      }

      const s = await client.updateSublist(oid, body);
      renderObject(s, root, { fields: SUBLIST_FIELDS, toId: (s) => s.oid });
    });

  sublist
    .command("add-task <sublist-oid> <task>")
    .description("Add a task, with its subtasks, to a sublist. <task> = OID, slug/#N, or URL.")
    .option("--single", "Add the task alone, without its subtasks")
    .action(async (sublistOid: string, taskInput: string, cmdOpts: { single?: boolean }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const taskOid = await resolveTaskOid(client, taskInput);
      const s = await client.updateSublistMembership(sublistOid, [
        { task: taskOid, ...(cmdOpts.single === true ? { single: true } : {}) },
      ]);
      renderObject(s, root, { fields: SUBLIST_FIELDS, toId: (s) => s.oid });
    });

  sublist
    .command("remove-task <sublist-oid> <task>")
    .description("Remove a task, with its subtasks, from a sublist. <task> = OID, slug/#N, or URL.")
    .option("--single", "Remove the task alone; its subtasks stay")
    .action(async (sublistOid: string, taskInput: string, cmdOpts: { single?: boolean }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const taskOid = await resolveTaskOid(client, taskInput);
      const s = await client.updateSublistMembership(sublistOid, [
        { task: taskOid, exclude: true, ...(cmdOpts.single === true ? { single: true } : {}) },
      ]);
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

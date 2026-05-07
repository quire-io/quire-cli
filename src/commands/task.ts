import { Command } from "commander";
import type { QuireApproval, QuireTask, QuireTaskSearchParams, QuireTimelog } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { TASK_GET_FIELDS, TASK_LIST_COLUMNS } from "../output/columns.js";
import { renderList, renderObject } from "../output/render.js";
import { printTable } from "../output/table.js";
import { createQuireClient } from "../quire-client.js";
import { readBulkItems, readBulkRefs } from "../util/bulk-input.js";
import { confirmDestructive } from "../util/confirm.js";
import { parseRecurrence } from "../util/recurrence.js";
import type { RecurrenceFlags } from "../util/recurrence.js";
import { resolveTaskOid } from "../util/task-id.js";

/** Adds the four shared `--recurrence-*` options to a command. */
function addRecurrenceOptions(cmd: Command): Command {
  return cmd
    .option("--recurrence-freq <freq>", "Recurrence: daily | weekly | monthly | yearly")
    .option("--recurrence-interval <n>", "Recurrence: positive integer (every N freq-units)")
    .option("--recurrence-byweekday <days>", "Recurrence: comma-separated day numbers 0-6 (0=Sun)")
    .option("--recurrence-until <date>", "Recurrence: ISO 8601 / YYYY-MM-DD end date");
}

const APPROVAL_FIELDS = [
  { label: "State", get: (a: QuireApproval) => a.state },
  { label: "Category", get: (a: QuireApproval) => a.category || "(default)" },
  { label: "Requester", get: (a: QuireApproval) => a.requesterRef?.id ?? a.requester },
  { label: "Approver", get: (a: QuireApproval) => a.approverRef?.id ?? a.approver },
];

const TIMELOG_COLUMNS = [
  { header: "START", get: (t: QuireTimelog) => t.start },
  { header: "END", get: (t: QuireTimelog) => t.end },
  { header: "USER", get: (t: QuireTimelog) => t.user.name ?? t.user.id ?? t.user.oid },
  { header: "BILLABLE", get: (t: QuireTimelog) => (t.billable === true ? "yes" : "") },
  { header: "NOTE", get: (t: QuireTimelog) => (t.note ?? "").replace(/\s+/g, " ").trim() },
];

type BulkResultRow = null | {
  oid: string;
  id?: number | string;
  name?: string;
  nameText?: string;
  status?: { name: string };
};

/**
 * Bulk endpoints can return mixed shapes: full `QuireTask` (with --return
 * full / when the server happens to send it), `{oid, id?}` compact rows,
 * or `null` for items that failed individually inside an atomic call. One
 * column set covers all three; absent fields render as empty cells.
 */
function renderBulkResults(results: readonly unknown[], root: GlobalOpts): void {
  if (root.json === true) {
    process.stdout.write(`${JSON.stringify(results)}\n`);
    return;
  }
  if (root.quiet === true) {
    for (const r of results) {
      const oid = (r as { oid?: string } | null)?.oid;
      process.stdout.write(`${oid ?? ""}\n`);
    }
    return;
  }
  const rows = results as readonly BulkResultRow[];
  printTable(rows, [
    { header: "ID", get: (r) => (r?.id !== undefined ? `#${r.id}` : "") },
    { header: "NAME", get: (r) => (r ? (r.nameText ?? r.name ?? "") : "") },
    { header: "STATUS", get: (r) => r?.status?.name ?? "" },
    { header: "OID", get: (r) => (r ? r.oid : "(failed)") },
  ]);
}

interface ListOpts {
  limit?: string;
  cursor?: string;
}

interface TreeOpts {
  depth: string;
}

interface SearchOpts {
  project?: string;
  org?: string;
  folder?: string;
  mine?: boolean;
  assignee?: string;
  tag?: string;
  status?: string;
  priority?: string;
  limit?: string;
}

function parseLimit(input: string | undefined): number | "no" | undefined {
  if (input === undefined) return undefined;
  if (input === "no") return "no";
  const n = Number.parseInt(input, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(`--limit must be a positive integer or 'no'; got "${input}"`);
  }
  return n;
}

export function registerTaskCommand(program: Command): void {
  const task = program.command("task").description("Quire tasks.");

  task
    .command("list <project>")
    .description("List tasks in a project. <project> = OID, slug, or URL.")
    .option("--limit <n>", "Page size; positive integer or 'no' for unlimited.")
    .option("--cursor <token>", "Cursor token from a previous page (Apr 2026 cursor pagination).")
    .action(async (project: string, cmdOpts: ListOpts) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(project);
      const tasks = await client.listTasks(oid, {
        limit: parseLimit(cmdOpts.limit),
        cursor: cmdOpts.cursor,
      });
      renderList(tasks, root, { columns: TASK_LIST_COLUMNS, toId: (t) => t.oid });
    });

  task
    .command("get <id>")
    .description("Show task details. <id> = OID, project-slug/#408, or full URL.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);
      const t = await client.getTask(oid);
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  task
    .command("tree <id>")
    .description("Render the recursive subtree under a task.")
    .option("--depth <n>", "Tree depth; positive integer (default 3) or 'full'.", "3")
    .action(async (id: string, cmdOpts: TreeOpts) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);
      const depth = cmdOpts.depth === "full" ? "full" : Number.parseInt(cmdOpts.depth, 10);
      if (depth !== "full" && (!Number.isInteger(depth) || depth <= 0)) {
        throw new ValidationError(`--depth must be a positive integer or 'full'; got "${cmdOpts.depth}"`);
      }
      const tree = await client.listTaskTree(oid, { depth });

      if (root.json === true) {
        process.stdout.write(`${JSON.stringify(tree)}\n`);
        return;
      }
      if (root.quiet === true) {
        const visit = (nodes: typeof tree): void => {
          for (const node of nodes) {
            process.stdout.write(`${node.oid}\n`);
            if (node.tasks) visit(node.tasks);
          }
        };
        visit(tree);
        return;
      }
      const printNodes = (nodes: typeof tree, level: number): void => {
        for (const node of nodes) {
          const name = node.nameText ?? node.name;
          const cropped = node.cropped ? "  …(cropped)" : "";
          process.stdout.write(`${"  ".repeat(level)}#${node.id}  ${name}${cropped}\n`);
          if (node.tasks) printNodes(node.tasks, level + 1);
        }
      };
      printNodes(tree, 0);
    });

  task
    .command("search <query>")
    .description("Search tasks by text. Scope with --project, --org, or --folder (one is required).")
    .option("--project <id>", "Search within one project.")
    .option("--org <id>", "Search within one organization (no project required).")
    .option("--folder <id>", "Search within one folder OID.")
    .option("--mine", "Restrict to tasks assigned to me.")
    .option("--assignee <user>", "Filter by assignee (OID, id, or email).")
    .option("--tag <tag>", "Filter by tag.")
    .option("--status <status>", "Filter: 'active' / 'completed' / numeric 0-100.")
    .option("--priority <priority>", "Filter: low / medium / high / urgent or -1 / 0 / 1 / 2.")
    .option("--limit <n>", "Page size.")
    .action(async (query: string, cmdOpts: SearchOpts) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const params: QuireTaskSearchParams = {
        text: query,
        ...(cmdOpts.mine ? { mine: true } : {}),
        ...(cmdOpts.assignee ? { assignee: cmdOpts.assignee } : {}),
        ...(cmdOpts.tag ? { tag: cmdOpts.tag } : {}),
        ...(cmdOpts.status ? { status: cmdOpts.status } : {}),
        ...(cmdOpts.priority ? { priority: cmdOpts.priority } : {}),
        ...(cmdOpts.limit ? { limit: parseLimit(cmdOpts.limit) } : {}),
      };

      let tasks;
      if (cmdOpts.project) {
        const oid = await client.resolveProjectOid(cmdOpts.project);
        tasks = await client.searchTasks(oid, params);
      } else if (cmdOpts.org) {
        const oid = await client.resolveOrgOid(cmdOpts.org);
        tasks = await client.searchTasksInOrganization(oid, params);
      } else if (cmdOpts.folder) {
        tasks = await client.searchTasksInFolder(cmdOpts.folder, params);
      } else {
        throw new ValidationError("`task search` requires one of --project, --org, or --folder.");
      }

      renderList(tasks, root, { columns: TASK_LIST_COLUMNS, toId: (t) => t.oid });
    });

  task
    .command("subtasks <id>")
    .description("List a task's direct subtasks.")
    .option("--limit <n>", "Page size.")
    .option("--cursor <token>", "Cursor from a previous page.")
    .action(async (id: string, cmdOpts: ListOpts) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);
      const subs = await client.listSubtasks(oid, {
        limit: parseLimit(cmdOpts.limit),
        cursor: cmdOpts.cursor,
      });
      renderList(subs, root, { columns: TASK_LIST_COLUMNS, toId: (t) => t.oid });
    });

  task
    .command("comments <id>")
    .description("List a task's comments.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);
      const comments = await client.getTaskComments(oid);
      renderList(comments, root, {
        columns: [
          {
            header: "WHEN",
            get: (c) => (c as { createdAt?: string }).createdAt ?? "",
          },
          { header: "WHO", get: (c) => c.createdBy?.name ?? "" },
          {
            header: "TEXT",
            get: (c) => (c.descriptionText ?? "").replace(/\s+/g, " ").trim(),
          },
          { header: "OID", get: (c) => c.oid },
        ],
        toId: (c) => c.oid,
      });
    });

  // -------- Write commands (Phase 5.1) --------

  // Accumulator for repeated CLI flags (e.g. `--tag a --tag b` → ["a","b"]).
  const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

  function parseCustomFields(pairs: string[] | undefined): Record<string, string> | undefined {
    if (!pairs?.length) return undefined;
    const result: Record<string, string> = {};
    for (const pair of pairs) {
      const eq = pair.indexOf("=");
      if (eq <= 0) {
        throw new ValidationError(`Invalid --custom-field "${pair}". Expected key=value.`);
      }
      result[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    return result;
  }

  function parsePosition(input: string | undefined, allowed: ReadonlyArray<"parent" | "before" | "after">): "parent" | "before" | "after" | undefined {
    if (input === undefined) return undefined;
    if (!(allowed as readonly string[]).includes(input)) {
      throw new ValidationError(`--position must be one of ${allowed.join(", ")}; got "${input}"`);
    }
    return input as "parent" | "before" | "after";
  }

  addRecurrenceOptions(task
    .command("create <project>")
    .description("Create a task in a project. Combine with --parent or --sibling+--position to nest / position.")
    .requiredOption("--name <name>", "Task name (required)")
    .option("--description <text>", "Task description")
    .option("--priority <priority>", "low|medium|high|urgent")
    .option("--due <date>", "Due date (YYYY-MM-DD or ISO 8601)")
    .option("--start <date>", "Start date")
    .option("--assignee <user>", "Assignee (OID, id, or email); repeat for multiple", append, [] as string[])
    .option("--tag <tag>", "Tag; repeat for multiple", append, [] as string[])
    .option("--parent <id>", "Create as a subtask of this parent task")
    .option("--sibling <id>", "Create relative to this sibling task (use with --position)")
    .option("--position <pos>", "Used with --sibling: 'before' or 'after'"))
    .action(async (project: string, cmdOpts: {
      name: string; description?: string; priority?: string; due?: string; start?: string;
      assignee?: string[]; tag?: string[]; parent?: string; sibling?: string; position?: string;
    } & RecurrenceFlags) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });

      if (cmdOpts.parent !== undefined && cmdOpts.sibling !== undefined) {
        throw new ValidationError("Cannot combine --parent and --sibling.");
      }

      const recurrence = parseRecurrence(cmdOpts);
      const body = {
        name: cmdOpts.name,
        ...(cmdOpts.description !== undefined ? { description: cmdOpts.description } : {}),
        ...(cmdOpts.priority !== undefined ? { priority: cmdOpts.priority } : {}),
        ...(cmdOpts.due !== undefined ? { due: cmdOpts.due } : {}),
        ...(cmdOpts.start !== undefined ? { start: cmdOpts.start } : {}),
        ...((cmdOpts.assignee?.length ?? 0) > 0 ? { assignees: cmdOpts.assignee } : {}),
        ...((cmdOpts.tag?.length ?? 0) > 0 ? { tags: cmdOpts.tag } : {}),
        ...(recurrence !== undefined ? { recurrence } : {}),
      };

      let created: QuireTask;
      if (cmdOpts.parent !== undefined) {
        const parentOid = await resolveTaskOid(client, cmdOpts.parent);
        created = await client.createSubtask(parentOid, body);
      } else if (cmdOpts.sibling !== undefined) {
        const pos = parsePosition(cmdOpts.position, ["before", "after"]);
        if (pos !== "before" && pos !== "after") {
          throw new ValidationError("--sibling requires --position before|after.");
        }
        const siblingOid = await resolveTaskOid(client, cmdOpts.sibling);
        created = await client.createTaskRelative(siblingOid, body, pos);
      } else {
        const projectOid = await client.resolveProjectOid(project);
        created = await client.createTask(projectOid, body);
      }

      renderObject(created, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  addRecurrenceOptions(task
    .command("subtask <parent-id>")
    .description("Create a subtask of an existing task. Alias for `task create --parent`.")
    .requiredOption("--name <name>", "Task name (required)")
    .option("--description <text>")
    .option("--priority <priority>", "low|medium|high|urgent")
    .option("--due <date>")
    .option("--start <date>")
    .option("--assignee <user>", "Repeat for multiple", append, [] as string[])
    .option("--tag <tag>", "Repeat for multiple", append, [] as string[]))
    .action(async (parentId: string, cmdOpts: {
      name: string; description?: string; priority?: string; due?: string; start?: string;
      assignee?: string[]; tag?: string[];
    } & RecurrenceFlags) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const parentOid = await resolveTaskOid(client, parentId);
      const recurrence = parseRecurrence(cmdOpts);
      const t = await client.createSubtask(parentOid, {
        name: cmdOpts.name,
        ...(cmdOpts.description !== undefined ? { description: cmdOpts.description } : {}),
        ...(cmdOpts.priority !== undefined ? { priority: cmdOpts.priority } : {}),
        ...(cmdOpts.due !== undefined ? { due: cmdOpts.due } : {}),
        ...(cmdOpts.start !== undefined ? { start: cmdOpts.start } : {}),
        ...((cmdOpts.assignee?.length ?? 0) > 0 ? { assignees: cmdOpts.assignee } : {}),
        ...((cmdOpts.tag?.length ?? 0) > 0 ? { tags: cmdOpts.tag } : {}),
        ...(recurrence !== undefined ? { recurrence } : {}),
      });
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  addRecurrenceOptions(task
    .command("update <id>")
    .description("Update task fields. Pass any subset of flags.")
    .option("--name <name>")
    .option("--description <text>")
    .option("--status <value>", "Numeric 0-100 (see `quire status list`)")
    .option("--priority <priority>", "low|medium|high|urgent")
    .option("--due <date>")
    .option("--start <date>")
    .option("--add-tag <tag>", "Repeat for multiple", append, [] as string[])
    .option("--remove-tag <tag>", "Repeat for multiple", append, [] as string[])
    .option("--add-assignee <user>", "Repeat for multiple", append, [] as string[])
    .option("--remove-assignee <user>", "Repeat for multiple", append, [] as string[])
    .option("--add-successor <id>", "Repeat for multiple", append, [] as string[])
    .option("--remove-successor <id>", "Repeat for multiple", append, [] as string[])
    .option("--custom-field <kv>", "key=value; repeat for multiple", append, [] as string[]))
    .action(async (id: string, cmdOpts: {
      name?: string; description?: string; status?: string; priority?: string;
      due?: string; start?: string;
      addTag?: string[]; removeTag?: string[];
      addAssignee?: string[]; removeAssignee?: string[];
      addSuccessor?: string[]; removeSuccessor?: string[];
      customField?: string[];
    } & RecurrenceFlags) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);

      let status: number | undefined;
      if (cmdOpts.status !== undefined) {
        const n = Number.parseInt(cmdOpts.status, 10);
        if (!Number.isInteger(n) || n < 0 || n > 100) {
          throw new ValidationError(`--status must be an integer 0-100; got "${cmdOpts.status}"`);
        }
        status = n;
      }

      const recurrence = parseRecurrence(cmdOpts);
      const body = {
        ...(cmdOpts.name !== undefined ? { name: cmdOpts.name } : {}),
        ...(cmdOpts.description !== undefined ? { description: cmdOpts.description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(cmdOpts.priority !== undefined ? { priority: cmdOpts.priority } : {}),
        ...(cmdOpts.due !== undefined ? { due: cmdOpts.due } : {}),
        ...(cmdOpts.start !== undefined ? { start: cmdOpts.start } : {}),
        ...((cmdOpts.addTag?.length ?? 0) > 0 ? { addTags: cmdOpts.addTag } : {}),
        ...((cmdOpts.removeTag?.length ?? 0) > 0 ? { removeTags: cmdOpts.removeTag } : {}),
        ...((cmdOpts.addAssignee?.length ?? 0) > 0 ? { addAssignees: cmdOpts.addAssignee } : {}),
        ...((cmdOpts.removeAssignee?.length ?? 0) > 0 ? { removeAssignees: cmdOpts.removeAssignee } : {}),
        ...((cmdOpts.addSuccessor?.length ?? 0) > 0 ? { addSuccessors: cmdOpts.addSuccessor } : {}),
        ...((cmdOpts.removeSuccessor?.length ?? 0) > 0 ? { removeSuccessors: cmdOpts.removeSuccessor } : {}),
        ...((cmdOpts.customField?.length ?? 0) > 0 ? { customFields: parseCustomFields(cmdOpts.customField) } : {}),
        ...(recurrence !== undefined ? { recurrence } : {}),
      };

      const t = await client.updateTask(oid, body);
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  task
    .command("complete <id>")
    .description("Mark a task complete.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);
      const t = await client.completeTask(oid);
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  task
    .command("uncomplete <id>")
    .description("Re-open a completed task (sets status to 0 / active).")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);
      const t = await client.updateTask(oid, { status: 0 });
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  task
    .command("move <id>")
    .description("Re-parent a task within the same project.")
    .option("--to <id>", "New parent task ID, or 'root' to move under the project root")
    .option("--position <pos>", "'parent', 'before', or 'after'")
    .action(async (id: string, cmdOpts: { to?: string; position?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);

      let parentOid: string | undefined;
      if (cmdOpts.to !== undefined && cmdOpts.to !== "root") {
        parentOid = await resolveTaskOid(client, cmdOpts.to);
      }
      const position = parsePosition(cmdOpts.position, ["parent", "before", "after"]);
      const t = await client.moveTask(oid, parentOid, position);
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  task
    .command("transfer <id>")
    .description("Transfer a task to a different project (cross-project move).")
    .requiredOption("--to <project>", "Target project (OID, slug, or URL)")
    .option("--task <id>", "Anchor task within the target project (use with --position)")
    .option("--position <pos>", "'parent', 'before', or 'after' relative to --task")
    .option("--keep-tags", "Preserve tags during transfer")
    .option("--keep-status", "Preserve status during transfer")
    .option("--keep-custom-fields", "Preserve custom fields during transfer")
    .option("--invite", "Invite the assignees to the target project")
    .action(async (id: string, cmdOpts: {
      to: string; task?: string; position?: string;
      keepTags?: boolean; keepStatus?: boolean; keepCustomFields?: boolean; invite?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);
      const projectOid = await client.resolveProjectOid(cmdOpts.to);
      const taskAnchor = cmdOpts.task !== undefined ? await resolveTaskOid(client, cmdOpts.task) : undefined;
      const position = parsePosition(cmdOpts.position, ["parent", "before", "after"]);

      const t = await client.transferTask(oid, {
        project: projectOid,
        ...(taskAnchor !== undefined ? { task: taskAnchor } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(cmdOpts.invite === true ? { invite: true } : {}),
        ...(cmdOpts.keepTags === true ? { tag: true } : {}),
        ...(cmdOpts.keepStatus === true ? { status: true } : {}),
        ...(cmdOpts.keepCustomFields === true ? { customField: true } : {}),
      });
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  task
    .command("dates <id>")
    .description("Set or clear task start / due dates. Pass 'null' to clear a date.")
    .option("--start <date>", "Start date or 'null' to clear")
    .option("--due <date>", "Due date or 'null' to clear")
    .action(async (id: string, cmdOpts: { start?: string; due?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);

      const body: { start?: string | null; due?: string | null } = {};
      if (cmdOpts.start !== undefined) body.start = cmdOpts.start === "null" ? null : cmdOpts.start;
      if (cmdOpts.due !== undefined) body.due = cmdOpts.due === "null" ? null : cmdOpts.due;

      if (body.start === undefined && body.due === undefined) {
        throw new ValidationError("`task dates` requires at least one of --start or --due.");
      }

      const t = await client.updateTask(oid, body);
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  task
    .command("peekaboo <id>")
    .description("Hide (peekaboo) a task. --reshow-at <ISO 8601> sets a re-show time.")
    .option("--reshow-at <iso8601>", "Reshow at this ISO 8601 timestamp (omit to hide indefinitely)")
    .action(async (id: string, cmdOpts: { reshowAt?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);

      let peekaboo: boolean | number = true;
      if (cmdOpts.reshowAt !== undefined) {
        const ms = Date.parse(cmdOpts.reshowAt);
        if (Number.isNaN(ms)) {
          throw new ValidationError(`--reshow-at must be ISO 8601 (e.g. 2026-05-08T12:00:00Z); got "${cmdOpts.reshowAt}"`);
        }
        peekaboo = ms;
      }
      const t = await client.updateTask(oid, { peekaboo });
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  task
    .command("delete <id>")
    .description("Delete a task. Prompts for confirmation unless --yes is set.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);

      await confirmDestructive({
        question: `Delete task ${oid}? Run \`quire task undo-remove ${oid}\` to restore.`,
        yes: root.yes,
      });

      await client.deleteTask(oid);

      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Deleted task ${oid}.\n`);
      }
    });

  task
    .command("undo-remove <id>")
    .description("Restore a deleted task. Requires the task OID — slug/#N forms cannot address deleted tasks.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const t = await client.undoRemoveTask(id);
      renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
    });

  // -------- Bulk operations (Phase 5.3 slice A; Apr 27 2026 endpoints) --------

  task
    .command("bulk-create <project>")
    .description("Create many tasks atomically (max 300/call). --from-file accepts a JSON array of task objects; '-' reads stdin.")
    .requiredOption("--from-file <file>", "JSON array of task objects (or '-' for stdin)")
    .action(async (project: string, cmdOpts: { fromFile: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const items = await readBulkItems(cmdOpts.fromFile);
      const results = await client.bulkCreateTasks(projectOid, items);
      renderBulkResults(results, root);
    });

  task
    .command("bulk-update <project>")
    .description("Update many tasks atomically. Each item must include `oid`.")
    .requiredOption("--from-file <file>", "JSON array of update objects (or '-' for stdin)")
    .action(async (project: string, cmdOpts: { fromFile: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const items = await readBulkItems(cmdOpts.fromFile);
      const results = await client.bulkUpdateTasks(projectOid, items);
      renderBulkResults(results, root);
    });

  task
    .command("bulk-delete <project>")
    .description("Delete many tasks. Refs are OIDs or numeric IDs; one per line, blank / '#'-comment lines OK, JSON array also accepted.")
    .requiredOption("--from-file <file>", "Ref list (one per line) or JSON array (or '-' for stdin)")
    .action(async (project: string, cmdOpts: { fromFile: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const refs = await readBulkRefs(cmdOpts.fromFile);
      await confirmDestructive({
        question: `Delete ${refs.length} task(s) from project ${projectOid}? Restore individually with \`quire task undo-remove\`.`,
        yes: root.yes,
      });
      const results = await client.bulkRemoveTasks(projectOid, refs);
      renderBulkResults(results, root);
    });

  task
    .command("bulk-move <project>")
    .description("Re-parent many tasks within the same project.")
    .requiredOption("--from-file <file>", "Ref list (one per line) or JSON array (or '-' for stdin)")
    .requiredOption("--to <id>", "New parent task OID, or 'root' to move under the project root")
    .option("--position <pos>", "'parent', 'before', or 'after'")
    .action(async (project: string, cmdOpts: { fromFile: string; to: string; position?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const refs = await readBulkRefs(cmdOpts.fromFile);
      const parent = cmdOpts.to === "root" ? "root" : await resolveTaskOid(client, cmdOpts.to);
      const position = parsePosition(cmdOpts.position, ["parent", "before", "after"]);
      const results = await client.bulkMoveTasks(projectOid, refs, {
        task: parent,
        ...(position !== undefined ? { position } : {}),
      });
      renderBulkResults(results, root);
    });

  task
    .command("bulk-transfer <project>")
    .description("Transfer many tasks from <project> to another project.")
    .requiredOption("--from-file <file>", "Ref list (one per line) or JSON array (or '-' for stdin)")
    .requiredOption("--to <project>", "Target project (OID, slug, or URL)")
    .option("--task <id>", "Anchor task in the target project")
    .option("--position <pos>", "'parent', 'before', or 'after'")
    .option("--keep-tags", "Preserve tags during transfer")
    .option("--keep-status", "Preserve status during transfer")
    .option("--keep-custom-fields", "Preserve custom fields during transfer")
    .option("--invite", "Invite the assignees to the target project")
    .action(async (project: string, cmdOpts: {
      fromFile: string; to: string; task?: string; position?: string;
      keepTags?: boolean; keepStatus?: boolean; keepCustomFields?: boolean; invite?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const sourceOid = await client.resolveProjectOid(project);
      const targetOid = await client.resolveProjectOid(cmdOpts.to);
      const refs = await readBulkRefs(cmdOpts.fromFile);
      const taskAnchor = cmdOpts.task !== undefined ? await resolveTaskOid(client, cmdOpts.task) : undefined;
      const position = parsePosition(cmdOpts.position, ["parent", "before", "after"]);
      const results = await client.bulkTransferTasks(sourceOid, refs, {
        project: targetOid,
        ...(taskAnchor !== undefined ? { task: taskAnchor } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(cmdOpts.invite === true ? { invite: true } : {}),
        ...(cmdOpts.keepTags === true ? { tag: true } : {}),
        ...(cmdOpts.keepStatus === true ? { status: true } : {}),
        ...(cmdOpts.keepCustomFields === true ? { customField: true } : {}),
      });
      renderBulkResults(results, root);
    });

  task
    .command("bulk-approve <project>")
    .description("Apply an approval state to many tasks at once.")
    .requiredOption("--from-file <file>", "Ref list (one per line) or JSON array (or '-' for stdin)")
    .requiredOption("--state <state>", "'request' | 'approve' | 'reject' | 'change'")
    .option("--category <id>", "Approval category (only used when --state request)")
    .action(async (project: string, cmdOpts: { fromFile: string; state: string; category?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const refs = await readBulkRefs(cmdOpts.fromFile);
      const validStates = ["request", "approve", "reject", "change"] as const;
      if (!(validStates as readonly string[]).includes(cmdOpts.state)) {
        throw new ValidationError(`--state must be one of ${validStates.join(", ")}; got "${cmdOpts.state}"`);
      }
      const results = await client.bulkApproveTasks(projectOid, refs, {
        state: cmdOpts.state as (typeof validStates)[number],
        ...(cmdOpts.category !== undefined ? { category: cmdOpts.category } : {}),
      });
      renderBulkResults(results, root);
    });

  // -------- Approval (Phase 5.3 slice B) --------

  task
    .command("approve <id>")
    .description("Set a task's approval state.")
    .requiredOption("--state <state>", "request | approve | reject | change")
    .option("--category <id>", "Approval category id (only meaningful for --state request)")
    .action(async (id: string, cmdOpts: { state: string; category?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);
      const validStates = ["request", "approve", "reject", "change"] as const;
      if (!(validStates as readonly string[]).includes(cmdOpts.state)) {
        throw new ValidationError(`--state must be one of ${validStates.join(", ")}; got "${cmdOpts.state}"`);
      }
      const a = await client.approveTask(oid, {
        state: cmdOpts.state as (typeof validStates)[number],
        ...(cmdOpts.category !== undefined ? { category: cmdOpts.category } : {}),
      });
      renderObject(a, root, { fields: APPROVAL_FIELDS, toId: () => oid });
    });

  task
    .command("revoke-approval <id>")
    .description("Revoke any approval state on a task.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, id);
      await client.revokeTaskApproval(oid);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, revoked: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Revoked approval on task ${oid}.\n`);
      }
    });

  // -------- Timelogs (Phase 5.3 slice B; Apr 27 2026 endpoints) --------

  const timelog = task.command("timelog").description("Quire task time tracking.");

  timelog
    .command("add <task-id>")
    .description("Add a timelog entry to a task.")
    .requiredOption("--start <iso8601>", "Start timestamp (ISO 8601)")
    .requiredOption("--end <iso8601>", "End timestamp (ISO 8601)")
    .option("--user <user>", "Log against another user (OID, id, or email; default: self)")
    .option("--billable", "Mark as billable")
    .option("--note <text>", "Optional note")
    .action(async (taskId: string, cmdOpts: {
      start: string; end: string; user?: string; billable?: boolean; note?: string;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, taskId);
      const logs = await client.addTaskTimelog(oid, {
        start: cmdOpts.start,
        end: cmdOpts.end,
        ...(cmdOpts.user !== undefined ? { user: cmdOpts.user } : {}),
        ...(cmdOpts.billable === true ? { billable: true } : {}),
        ...(cmdOpts.note !== undefined ? { note: cmdOpts.note } : {}),
      });
      renderList(logs, root, { columns: TIMELOG_COLUMNS, toId: (l) => `${l.start}/${l.end}` });
    });

  timelog
    .command("update <task-id>")
    .description("Update a timelog entry. Use --start / --end / --user to identify the row; --new-* and --note / --billable to change it.")
    .requiredOption("--start <iso8601>", "Existing start timestamp")
    .requiredOption("--end <iso8601>", "Existing end timestamp")
    .option("--user <user>", "User on the existing row (when not self)")
    .option("--new-start <iso8601>", "Replace the start timestamp")
    .option("--new-end <iso8601>", "Replace the end timestamp")
    .option("--new-user <user>", "Replace the user")
    .option("--billable", "Mark billable")
    .option("--no-billable", "Clear the billable flag")
    .option("--note <text>", "Replace the note (pass an empty string to clear)")
    .action(async (taskId: string, cmdOpts: {
      start: string; end: string; user?: string;
      newStart?: string; newEnd?: string; newUser?: string;
      billable?: boolean;
      note?: string;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, taskId);
      const target: { start: string; end: string; user?: string } = { start: cmdOpts.start, end: cmdOpts.end };
      if (cmdOpts.user !== undefined) target.user = cmdOpts.user;
      const body: { start?: string; end?: string; user?: string; billable?: boolean | null; note?: string | null } = {};
      if (cmdOpts.newStart !== undefined) body.start = cmdOpts.newStart;
      if (cmdOpts.newEnd !== undefined) body.end = cmdOpts.newEnd;
      if (cmdOpts.newUser !== undefined) body.user = cmdOpts.newUser;
      if (cmdOpts.billable === true) body.billable = true;
      else if (cmdOpts.billable === false) body.billable = false;
      if (cmdOpts.note !== undefined) body.note = cmdOpts.note === "" ? null : cmdOpts.note;
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`task timelog update` requires at least one of --new-start / --new-end / --new-user / --billable / --no-billable / --note.");
      }
      const logs = await client.updateTaskTimelog(oid, target, body);
      renderList(logs, root, { columns: TIMELOG_COLUMNS, toId: (l) => `${l.start}/${l.end}` });
    });

  timelog
    .command("remove <task-id>")
    .description("Remove a timelog entry. Identify the row via --start / --end (and --user if not self).")
    .requiredOption("--start <iso8601>", "Existing start timestamp")
    .requiredOption("--end <iso8601>", "Existing end timestamp")
    .option("--user <user>", "User on the row (when not self)")
    .action(async (taskId: string, cmdOpts: { start: string; end: string; user?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, taskId);
      await confirmDestructive({
        question: `Remove timelog ${cmdOpts.start} → ${cmdOpts.end} from task ${oid}?`,
        yes: root.yes,
      });
      const logs = await client.removeTaskTimelog(oid, {
        start: cmdOpts.start,
        end: cmdOpts.end,
        ...(cmdOpts.user !== undefined ? { user: cmdOpts.user } : {}),
      });
      renderList(logs, root, { columns: TIMELOG_COLUMNS, toId: (l) => `${l.start}/${l.end}` });
    });
}

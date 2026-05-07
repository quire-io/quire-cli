import { Command } from "commander";
import type { QuireTaskSearchParams } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { TASK_LIST_COLUMNS } from "../output/columns.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { resolveTaskOid } from "../util/task-id.js";

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
      renderObject(t, root, {
        fields: [
          { label: "Name", get: (t) => t.nameText ?? t.name },
          { label: "ID", get: (t) => `#${t.id}` },
          { label: "OID", get: (t) => t.oid },
          { label: "Status", get: (t) => t.status?.name },
          { label: "Priority", get: (t) => t.priority?.name },
          { label: "Start", get: (t) => t.start },
          { label: "Due", get: (t) => t.due },
          { label: "Description", get: (t) => t.descriptionText },
          { label: "URL", get: (t) => t.url },
          { label: "Created at", get: (t) => t.createdAt },
          { label: "Edited at", get: (t) => t.editedAt },
          { label: "Archived at", get: (t) => t.archivedAt },
        ],
        toId: (t) => t.oid,
      });
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
}

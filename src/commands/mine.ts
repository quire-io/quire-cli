import { Command } from "commander";
import type { QuireTask, QuireTaskSearchParams } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import { createLogger } from "../log.js";
import type { GlobalOpts } from "../options.js";
import { TASK_LIST_COLUMNS } from "../output/columns.js";
import { renderList } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

interface MineOpts {
  project?: string;
  org?: string;
  allOrgs?: boolean;
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

export function registerMineCommand(program: Command): void {
  program
    .command("mine")
    .description("List tasks assigned to me. Scope with --project, --org, or --all-orgs.")
    .option("--project <id>", "Restrict to one project.")
    .option("--org <id>", "Restrict to one organization.")
    .option("--all-orgs", "Fan out across every organization you belong to.")
    .option("--limit <n>", "Page size.")
    .action(async (cmdOpts: MineOpts) => {
      const root = program.opts<GlobalOpts>();
      const log = createLogger({ verbose: root.verbose === true, color: root.color });
      const client = createQuireClient({ profile: root.profile });
      const params: QuireTaskSearchParams = {
        mine: true,
        ...(cmdOpts.limit ? { limit: parseLimit(cmdOpts.limit) } : {}),
      };

      let tasks: QuireTask[];
      if (cmdOpts.project) {
        const oid = await client.resolveProjectOid(cmdOpts.project);
        tasks = await client.searchTasks(oid, params);
      } else if (cmdOpts.org) {
        const oid = await client.resolveOrgOid(cmdOpts.org);
        tasks = await client.searchTasksInOrganization(oid, params);
      } else if (cmdOpts.allOrgs === true) {
        const orgs = await client.listOrganizations();
        if (orgs.length === 0) {
          tasks = [];
        } else {
          if (orgs.length > 1) {
            log.info(`Searching ${orgs.length} organizations…`);
          }
          const lists = await Promise.all(
            orgs.map((o) => client.searchTasksInOrganization(o.oid, params)),
          );
          tasks = lists.flat();
        }
      } else {
        throw new ValidationError(
          "`quire mine` requires one of --project, --org, or --all-orgs.",
        );
      }

      renderList(tasks, root, { columns: TASK_LIST_COLUMNS, toId: (t) => t.oid });
    });
}

import { Command } from "commander";
import type { QuireMyTasksFilter, QuireMyTasksScope } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { TASK_LIST_COLUMNS } from "../output/columns.js";
import { renderList } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

interface MineOpts {
  project?: string;
  inbox?: boolean;
  org?: string;
  allOrgs?: boolean;
  skipInbox?: boolean;
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
    .description(
      "List tasks assigned to me. Scope with --project, --inbox, --org, or --all-orgs.",
    )
    .option("--project <id>", "Restrict to one project.")
    .option("--inbox", "Restrict to my private Inbox.")
    .option("--org <id>", "Restrict to one organization.")
    .option(
      "--all-orgs",
      "Fan out across every organization you belong to (includes Inbox; pass --skip-inbox to exclude).",
    )
    .option("--skip-inbox", "With --all-orgs, exclude the private Inbox from the fan-out.")
    .option("--limit <n>", "Page size (positive integer or 'no' for unlimited).")
    .action(async (cmdOpts: MineOpts) => {
      const root = program.opts<GlobalOpts>();

      const scopeFlagCount =
        (cmdOpts.project ? 1 : 0) +
        (cmdOpts.inbox === true ? 1 : 0) +
        (cmdOpts.org ? 1 : 0) +
        (cmdOpts.allOrgs === true ? 1 : 0);
      if (scopeFlagCount === 0) {
        throw new ValidationError(
          "`quire mine` requires exactly one of --project, --inbox, --org, or --all-orgs.",
        );
      }
      if (scopeFlagCount > 1) {
        throw new ValidationError(
          "`quire mine`: --project, --inbox, --org, and --all-orgs are mutually exclusive.",
        );
      }
      if (cmdOpts.skipInbox === true && cmdOpts.allOrgs !== true) {
        throw new ValidationError("--skip-inbox only applies with --all-orgs.");
      }

      const client = createQuireClient({ profile: root.profile });

      let scope: QuireMyTasksScope;
      if (cmdOpts.project) {
        const oid = await client.resolveProjectOid(cmdOpts.project);
        scope = { project: oid };
      } else if (cmdOpts.inbox === true) {
        scope = { project: "-" };
      } else if (cmdOpts.org) {
        const oid = await client.resolveOrgOid(cmdOpts.org);
        scope = { organization: oid };
      } else {
        scope = { allOrganizations: true, inbox: cmdOpts.skipInbox !== true };
      }

      const filter: QuireMyTasksFilter = cmdOpts.limit
        ? { limit: parseLimit(cmdOpts.limit) }
        : {};

      const tasks = await client.getMyTasks(scope, filter);

      renderList(tasks, root, { columns: TASK_LIST_COLUMNS, toId: (t) => t.oid });
    });
}

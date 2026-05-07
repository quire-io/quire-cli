#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "commander";

import { registerChatCommand } from "./commands/chat.js";
import { registerCommentCommand } from "./commands/comment.js";
import { registerDocCommand } from "./commands/doc.js";
import { registerInsightCommand } from "./commands/insight.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { registerMineCommand } from "./commands/mine.js";
import { registerOrgCommand } from "./commands/org.js";
import { registerProjectCommand } from "./commands/project.js";
import { registerResolveCommand } from "./commands/resolve.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerSublistCommand } from "./commands/sublist.js";
import { registerTagCommand } from "./commands/tag.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerWhoamiCommand } from "./commands/whoami.js";
import { handleError } from "./errors.js";
import { createLogger } from "./log.js";

// Exit cleanly when the downstream pipe consumer dies (e.g. `quire … | head`).
// Without this, the next stdout.write throws an unhandled EPIPE and Node
// crashes loudly with a stack trace — bad UX for a CLI built to compose with
// shell pipelines (Phase 6 stdout discipline).
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

function readVersion(): string {
  // package.json sits one level up from dist/cli.js (built) or src/cli.ts (dev via tsx).
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}

const program = new Command();

program
  .name("quire")
  .description("Command-line interface for the Quire API.")
  .version(readVersion(), "-v, --version", "Print the CLI version")
  .option("--verbose", "Enable verbose (debug) logging on stderr")
  .option("--json", "Emit raw API JSON (no human formatting)")
  .option("-q, --quiet", "Print only IDs (one per line) — designed for xargs pipelines")
  .option("--color-mode <mode>", "Color output mode: always|never|auto", "auto")
  .option(
    "--profile <name>",
    "Use a named credential profile (default: $QUIRE_PROFILE or 'default')",
  )
  .option("--yes", "Auto-confirm destructive prompts (required for non-interactive mutating commands)")
  .option("--no-truncate", "Disable per-cell truncation in human-readable tables");

registerLoginCommand(program);
registerLogoutCommand(program);
registerWhoamiCommand(program);
registerOrgCommand(program);
registerProjectCommand(program);
registerTaskCommand(program);
registerMineCommand(program);
registerTagCommand(program);
registerSublistCommand(program);
registerStatusCommand(program);
registerCommentCommand(program);
registerChatCommand(program);
registerDocCommand(program);
registerInsightCommand(program);
registerResolveCommand(program);

program.addHelpText(
  "after",
  `
Auth:
  quire login                  Sign in via OAuth (loopback + PKCE)
  quire logout                 Remove the local credentials file
  quire whoami                 Show the signed-in user

Orgs / projects:
  quire org list               List your organizations
  quire org get <id>           Show one organization
  quire org limit <id>         Show API rate-limit usage for an organization
  quire project list           List projects you can see (or --org <id> to scope)
  quire project get <id>       Show one project
  quire project members <id>   List a project's members

Tasks (read):
  quire task list <project>    List tasks in a project
  quire task get <id>          Show task details (id = OID, slug/#N, or URL)
  quire task tree <id>         Render the recursive subtree (default depth 3)
  quire task search <query>    Search tasks; scope with --project / --org / --folder
  quire task subtasks <id>     List a task's direct subtasks
  quire task comments <id>     List a task's comments
  quire mine                   List tasks assigned to me; scope with --project / --org / --all-orgs

Tasks (write):
  quire task create <project> --name "..."   Create a new task (--parent / --sibling+--position to nest)
  quire task subtask <parent> --name "..."   Shorthand for "task create --parent"
  quire task update <id>                     Update fields: --name / --status / --priority / --add-tag / etc.
  quire task complete <id> / uncomplete <id> Toggle status to 100 / 0
  quire task move <id> --to <id|root>        Re-parent within the same project
  quire task transfer <id> --to <project>    Cross-project transfer (--keep-tags / --keep-status / --invite)
  quire task dates <id> --start ... --due ... Set / clear dates (pass 'null' to clear)
  quire task peekaboo <id> [--reshow-at ISO] Hide a task; optional auto-reshow time
  quire task delete <id>                     Delete a task (prompts unless --yes)
  quire task undo-remove <oid>               Restore a deleted task

Project metadata (read):
  quire tag list <project>     List tags defined on a project
  quire sublist list <project> List sublists on a project
  quire status list <project>  List custom statuses on a project

Project metadata (write):
  quire tag create <project>      Create a tag (--name / --color)
  quire tag update <oid>          Update tag --name / --color
  quire tag delete <oid>          Delete a tag (prompts unless --yes)
  quire sublist create <project>  Create a sublist (--name / --description)
  quire sublist update <oid>      Update sublist (--name / --description / --start / --due / --archive / --unarchive)
  quire sublist delete <oid>      Delete a sublist (prompts unless --yes)
  quire sublist undo-remove <oid> Restore a deleted sublist
  quire status create <project>   Create a status (--name / --value / --color)
  quire status update <project> <value>  Update a status (--name / --color / --new-value)
  quire status delete <project> <value>  Delete a status (prompts unless --yes)

Comments / chats / docs / insights (read):
  quire comment list <task>    List comments on a task (alias for "quire task comments")
  quire chat list <project>    List chats / chat get <id> / chat comments <id>
  quire doc list <project>     List documents / doc get <id>
  quire insight list <project> List insights / insight get <id>

Comments (write):
  quire comment add <task> --text "..."   Add a comment ('-' = stdin, '@file' = read file)
  quire comment update <oid>              Update --text and/or --pin / --unpin
  quire comment delete <oid>              Delete a comment (prompts unless --yes)

URL resolver:
  quire resolve <url>          Paste any Quire URL, get the typed resource back

Write commands (Phase 5) are TODO — see PLAN.md.
`,
);

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const log = createLogger({
    verbose: program.opts().verbose === true,
    color: program.opts().colorMode as "always" | "never" | "auto" | undefined,
  });
  handleError(err, log);
});

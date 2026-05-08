#!/usr/bin/env node
import { Command } from "commander";

import { registerChatCommand } from "./commands/chat.js";
import { registerColorsCommand } from "./commands/colors.js";
import { registerCommentCommand } from "./commands/comment.js";
import { registerDocCommand } from "./commands/doc.js";
import { registerInsightCommand } from "./commands/insight.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { registerMineCommand } from "./commands/mine.js";
import { registerNotifyCommand } from "./commands/notify.js";
import { registerOrgCommand } from "./commands/org.js";
import { registerPartnerCommand } from "./commands/partner.js";
import { registerProjectCommand } from "./commands/project.js";
import { registerResolveCommand } from "./commands/resolve.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerSublistCommand } from "./commands/sublist.js";
import { registerTagCommand } from "./commands/tag.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerUndoCommand } from "./commands/undo.js";
import { registerWhoamiCommand } from "./commands/whoami.js";
import { handleError } from "./errors.js";
import { createLogger } from "./log.js";
import { readVersion } from "./version.js";

// Exit cleanly when the downstream pipe consumer dies (e.g. `quire … | head`).
// Without this, the next stdout.write throws an unhandled EPIPE and Node
// crashes loudly with a stack trace — bad UX for a CLI built to compose with
// shell pipelines (Phase 6 stdout discipline).
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

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
registerPartnerCommand(program);
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
registerColorsCommand(program);
registerNotifyCommand(program);
registerUndoCommand(program);

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
  quire org update <id>        Update name / description / followers
  quire org limit <id>         Show API rate-limit usage for an organization
  quire project list           List projects you can see (or --org <id> to scope)
  quire project get <id>       Show one project
  quire project update <id>    Update name / description / dates / archive / public / followers
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

Tasks (bulk):
  quire task bulk-create <project>     --from-file tasks.json   Create up to 300 tasks atomically
  quire task bulk-update <project>     --from-file updates.json Update many tasks atomically (each item needs an oid)
  quire task bulk-delete <project>     --from-file ids.txt      Delete many (prompts unless --yes); refs one per line or JSON array
  quire task bulk-move <project>       --to <id|root> --from-file ids.txt
  quire task bulk-transfer <project>   --to <project> --from-file ids.txt
  quire task bulk-approve <project>    --state request|approve|reject|change --from-file ids.txt

Tasks (approval / timelogs / recurrence):
  quire task approve <id> --state ...           Set a task's approval state
  quire task revoke-approval <id>               Revoke any approval state
  quire task timelog add <id>     --start --end [--user / --billable / --note]
  quire task timelog update <id>  --start --end [--new-start / --new-end / --note / ...]
  quire task timelog remove <id>  --start --end                                (prompts unless --yes)
  --recurrence-freq / --recurrence-interval / --recurrence-byweekday / --recurrence-until
                                                Add / clear recurrence on "task create" / "task subtask" / "task update"

Project metadata (approval categories):
  quire project approval-category add <project>          --id ... --name ... [--claimer / --approver]
  quire project approval-category update <project> <id>  [--name / --claimer / --approver / --claimers-anyone / --claimers-admins-only / ...]
  quire project approval-category remove <project> <id>  (prompts unless --yes)

Project metadata (custom-field definitions):
  quire project field add <project>          --name --type [--hidden / --private / --percent / --multiple / --clear-on-dup / --extra k=v]
  quire project field update <project> <name>  [--type / --hidden / --private / --percent / --multiple / --extra k=v]
  quire project field rename <project> <name> --new-name ...
  quire project field move <project> <name>   [--before <name>] [--to-end]
  quire project field remove <project> <name> (prompts unless --yes)
  quire insight field add <insight-oid>       --name --type [...]   (formula / lookup only)
  quire insight field {update / rename / move / remove}              (same flag shape as project field)

Project metadata (read):
  quire tag list <project>      List tags defined on a project
  quire sublist list <project>  List sublists on a project
  quire status list <project>   List custom statuses on a project
  quire partner list <project>  List partner orgs (external teams) on a project
  quire partner get <oid>       Show one partner organization

Project metadata (write):
  quire tag create <project>      Create a tag (--name / --color)
  quire tag update <oid>          Update tag --name / --color
  quire tag delete <oid>          Delete a tag (prompts unless --yes)
  quire sublist create <project>      Create a sublist (--name / --description)
  quire sublist update <oid>          Update sublist (--name / --description / --start / --due / --archive / --unarchive)
  quire sublist add-task <oid> <task> Add a task to a sublist
  quire sublist remove-task <oid> <task>  Remove a task from a sublist
  quire sublist delete <oid>          Delete a sublist (prompts unless --yes)
  quire sublist undo-remove <oid>     Restore a deleted sublist
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

Chats / docs / insights (write):
  quire chat create <project>             --name [--description / --partner]
  quire chat update <oid>                 [--name / --description / --archive / --unarchive / --add-follower / --remove-follower]
  quire chat delete <oid>                 (prompts unless --yes)
  quire chat undo-remove <oid>
  quire chat comment add <chat-id>        --text [--pin]
  quire doc create <project>              --name [--description]
  quire doc update <oid>                  [--name / --description / --archive / --unarchive]
  quire doc delete <oid>                  (prompts unless --yes)
  quire doc undo-remove <oid>
  quire insight create <project>          --name [--id / --description / --icon-color / --image]
  quire insight update <oid>              [--name / --description / --icon-color / --image / --archive / --unarchive]
  quire insight delete <oid>              (prompts unless --yes)
  quire insight undo-remove <oid>

Generic undo:
  quire undo <kind> <oid>                 kind = task | chat | comment | document | insight | sublist

URL resolver:
  quire resolve <url>          Paste any Quire URL, get the typed resource back

Notifications:
  quire notify --message ...   Send an in-app notification to yourself ('-' / '@file' for stdin / file)

Reference:
  quire colors                 List Quire's 48-slot palette (code, hex, name)

Bulk / approval / custom-fields / recurrence / timelogs / docs / chats / insights writes (Phase 5.3+) are TODO — see PLAN.md.
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

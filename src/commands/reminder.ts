import { Command } from "commander";
import { looksLikeOid } from "@quire-io/api-client";
import type {
  QuireClient, QuireRecurrence, QuireReminder, QuireReminderLead, QuireReminderOwnerType,
} from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";
import { addMemberOptions, formatMembers, resolveMembers } from "../util/member-flags.js";
import type { MemberFlags } from "../util/member-flags.js";
import { parseRecurrence } from "../util/recurrence.js";
import type { RecurrenceFlags } from "../util/recurrence.js";
import { formatLeads, parseLeads } from "../util/reminder-lead.js";
import { resolveTaskOid } from "../util/task-id.js";
import { resolveTextInput } from "../util/text-input.js";

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

// Unlike sublist / doc / chat / insight / dashboard, the reminder endpoints
// have no implied owner — `--owner-type` is always part of the address, and
// `task` is a type of its own here.
const OWNER_TYPES = ["project", "organization", "folder", "smart-folder", "task"] as const;

function parseOwnerType(input: string | undefined): QuireReminderOwnerType {
  const type = input ?? "project";
  if (!(OWNER_TYPES as readonly string[]).includes(type)) {
    throw new ValidationError(
      `--owner-type must be one of ${OWNER_TYPES.join(", ")}; got "${type}".`,
    );
  }
  return type as QuireReminderOwnerType;
}

// Folders and smart-folders have no slug-resolution endpoint, so those owners
// must be passed as OIDs. `-` is the caller's own Inbox and is passed through
// verbatim on a project owner.
async function resolveOwnerOid(
  client: QuireClient,
  ownerType: QuireReminderOwnerType,
  input: string,
): Promise<string> {
  if (ownerType === "project") return input === "-" ? "-" : client.resolveProjectOid(input);
  if (ownerType === "organization") return client.resolveOrgOid(input);
  if (ownerType === "task") return resolveTaskOid(client, input);
  if (!looksLikeOid(input)) {
    throw new ValidationError(
      `Owner type "${ownerType}" requires an OID; got "${input}".`,
    );
  }
  return input;
}

const REMINDER_FIELDS = [
  { label: "OID", get: (r: QuireReminder) => r.oid },
  { label: "Name", get: (r: QuireReminder) => r.nameText ?? r.name ?? "(default message)" },
  { label: "Task", get: (r: QuireReminder) => (r.task ? `#${r.task.id} ${r.task.name}` : undefined) },
  // Null whenever the reminder's task carries a start or due date — it then
  // fires from the task's own schedule instead.
  { label: "When", get: (r: QuireReminder) => r.when ?? (r.task ? "(from the task's dates)" : undefined) },
  { label: "Leads", get: (r: QuireReminder) => formatLeads(r.leads) ?? "(one at the fire time)" },
  {
    label: "Recurrence",
    get: (r: QuireReminder) =>
      r.recurrence ? `${r.recurrence.freq} every ${String(r.recurrence.interval)}` : undefined,
  },
  { label: "Members", get: (r: QuireReminder) => formatMembers(r.members) },
  { label: "Created by", get: (r: QuireReminder) => r.createdBy?.name },
  { label: "Created at", get: (r: QuireReminder) => r.createdAt },
  { label: "URL", get: (r: QuireReminder) => r.url },
];

const REMINDER_COLUMNS = [
  { header: "OID", get: (r: QuireReminder) => r.oid },
  { header: "NAME", get: (r: QuireReminder) => (r.nameText ?? r.name ?? "").replace(/\s+/g, " ").trim() },
  { header: "TASK", get: (r: QuireReminder) => (r.task ? `#${r.task.id}` : "") },
  { header: "WHEN", get: (r: QuireReminder) => r.when ?? "" },
  { header: "LEADS", get: (r: QuireReminder) => formatLeads(r.leads) ?? "" },
];

function parseLimit(input: string): number | "no" {
  if (input === "no") return "no";
  const n = Number.parseInt(input, 10);
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    throw new ValidationError(`--limit must be an integer 1-1000 or 'no'; got "${input}"`);
  }
  return n;
}

export function registerReminderCommand(program: Command): void {
  const reminder = program
    .command("reminder")
    .description("Quire reminders. --owner-type is always required for create / list (default: project).");

  reminder
    .command("list <owner>")
    .description(
      "List reminders on an owner. A project's list includes the reminders on its tasks — pass --owner-type task to narrow to one task. Use '-' as <owner> for your own Inbox.",
    )
    .option("--owner-type <type>", `Owner type: ${OWNER_TYPES.join(" | ")} (default: project)`)
    .option("--limit <n>", "Page size; 1-1000 or 'no' for every reminder in one call.")
    .option("--cursor <token>", "Cursor from the last item of a previous page.")
    .action(async (owner: string, cmdOpts: { ownerType?: string; limit?: string; cursor?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const ownerType = parseOwnerType(cmdOpts.ownerType);
      const ownerOid = await resolveOwnerOid(client, ownerType, owner);
      const reminders = await client.listReminders(ownerType, ownerOid, {
        ...(cmdOpts.limit !== undefined ? { limit: parseLimit(cmdOpts.limit) } : {}),
        ...(cmdOpts.cursor !== undefined ? { cursor: cmdOpts.cursor } : {}),
      });
      // Quire orders these by OID — stable, but not chronological. Say so
      // rather than letting the reader assume the top row fires next.
      if (root.json !== true && root.quiet !== true && reminders.length > 1) {
        process.stderr.write("Ordered by OID, not by fire time.\n");
      }
      renderList(reminders, root, { columns: REMINDER_COLUMNS, toId: (r) => r.oid });
    });

  reminder
    .command("get <oid>")
    .description("Show one reminder.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const r = await client.getReminder(oid);
      renderObject(r, root, { fields: REMINDER_FIELDS, toId: (r) => r.oid });
    });

  addMemberOptions(reminder
    .command("create <owner>")
    .description(
      "Create a reminder. --when is required unless the reminder is on a task that already has a start or due date — that task's schedule supplies the fire time, and passing --when / --recurrence-* then is rejected with 400.",
    )
    .option("--owner-type <type>", `Owner type: ${OWNER_TYPES.join(" | ")} (default: project)`)
    .option("--when <iso8601>", "Fire time (UTC, ISO 8601). A bare YYYY-MM-DD means midnight UTC — there is no all-day reminder.")
    .option("--lead <spec>", "Notify this far ahead: '<n>m' minutes, '<n>d' days, or '<n>d@HH:mm'; repeat for multiple (max 30). Omit for one notification at the fire time.", append, [] as string[])
    .option("--name <text>", "Message shown instead of the default (Markdown); '-' for stdin or '@file' for a file")
    .option("--partner <oid>", "Share with an external team. Project reminders only; cannot be combined with --member.")
    .option("--recurrence-freq <freq>", "Recurrence: daily | weekly | monthly | yearly")
    .option("--recurrence-interval <n>", "Recurrence: positive integer (every N freq-units)")
    .option("--recurrence-byweekday <days>", "Recurrence: comma-separated day numbers 0-6 (0=Sun)")
    .option("--recurrence-until <date>", "Recurrence: ISO 8601 / YYYY-MM-DD end date"))
    .action(async (owner: string, cmdOpts: {
      ownerType?: string; when?: string; lead?: string[]; name?: string; partner?: string;
    } & RecurrenceFlags & MemberFlags) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });

      const members = resolveMembers(cmdOpts);
      if (members !== undefined && cmdOpts.partner !== undefined) {
        throw new ValidationError("Cannot combine --member / --members-admins-only with --partner — Quire rejects the pair with 400.");
      }

      const ownerType = parseOwnerType(cmdOpts.ownerType);
      const ownerOid = await resolveOwnerOid(client, ownerType, owner);
      const leads = parseLeads(cmdOpts.lead);
      const recurrence = parseRecurrence(cmdOpts);
      const name = cmdOpts.name !== undefined ? await resolveTextInput(cmdOpts.name) : undefined;

      const r = await client.createReminder(ownerType, ownerOid, {
        ...(cmdOpts.when !== undefined ? { when: cmdOpts.when } : {}),
        ...(recurrence !== undefined ? { recurrence } : {}),
        ...(leads !== undefined ? { leads } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(cmdOpts.partner !== undefined ? { partner: cmdOpts.partner } : {}),
        ...(members !== undefined ? { members } : {}),
      });
      renderObject(r, root, { fields: REMINDER_FIELDS, toId: (r) => r.oid });
    });

  reminder
    .command("update <oid>")
    .description(
      "Update a reminder. Only --when / --recurrence-* / --lead / --name can be changed — members and partner are create-only, so recreate the reminder to change who can see it.",
    )
    .option("--when <iso8601>", "New fire time, or 'null' to clear it")
    .option("--lead <spec>", "Replace the whole lead list; repeat for multiple (max 30)", append, [] as string[])
    .option("--name <text>", "New message, or 'null' to fall back to the default; '-' for stdin or '@file' for a file")
    .option("--clear-recurrence", "Stop the reminder repeating")
    .option("--recurrence-freq <freq>", "Recurrence: daily | weekly | monthly | yearly")
    .option("--recurrence-interval <n>", "Recurrence: positive integer (every N freq-units)")
    .option("--recurrence-byweekday <days>", "Recurrence: comma-separated day numbers 0-6 (0=Sun)")
    .option("--recurrence-until <date>", "Recurrence: ISO 8601 / YYYY-MM-DD end date")
    .action(async (oid: string, cmdOpts: {
      when?: string; lead?: string[]; name?: string; clearRecurrence?: boolean;
    } & RecurrenceFlags) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });

      const recurrence = parseRecurrence(cmdOpts);
      if (cmdOpts.clearRecurrence === true && recurrence !== undefined) {
        throw new ValidationError("Cannot combine --clear-recurrence with the --recurrence-* flags.");
      }

      const leads = parseLeads(cmdOpts.lead);
      // `null` clears the custom message and falls back to Quire's default —
      // same literal-'null' convention as `task dates` / `dashboard update`.
      let name: string | null | undefined;
      if (cmdOpts.name === "null") name = null;
      else if (cmdOpts.name !== undefined) name = await resolveTextInput(cmdOpts.name);

      const body: {
        when?: string | null;
        recurrence?: QuireRecurrence | null;
        leads?: QuireReminderLead[];
        name?: string | null;
      } = {};
      if (cmdOpts.when !== undefined) body.when = cmdOpts.when === "null" ? null : cmdOpts.when;
      if (cmdOpts.clearRecurrence === true) body.recurrence = null;
      else if (recurrence !== undefined) body.recurrence = recurrence;
      if (leads !== undefined) body.leads = leads;
      if (name !== undefined) body.name = name;

      if (Object.keys(body).length === 0) {
        throw new ValidationError(
          "`reminder update` requires at least one of --when / --lead / --name / --clear-recurrence / --recurrence-*.",
        );
      }

      const r = await client.updateReminder(oid, body);
      renderObject(r, root, { fields: REMINDER_FIELDS, toId: (r) => r.oid });
    });

  reminder
    .command("delete <oid>")
    .description("Delete a reminder permanently. Prompts unless --yes.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      // Reminders don't go to the trash — there is no undo-remove endpoint,
      // so the prompt must not promise one the way `chat delete` does.
      await confirmDestructive({
        question: `Delete reminder ${oid}? This is permanent — reminders are not moved to the trash and cannot be restored.`,
        yes: root.yes,
      });
      await client.deleteReminder(oid);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Deleted reminder ${oid}.\n`);
      }
    });
}

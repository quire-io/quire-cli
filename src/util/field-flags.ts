import { Command } from "commander";

import { ValidationError } from "../errors.js";

export interface FieldFlags {
  name?: string;
  type?: string;
  hidden?: boolean;
  /** `--private` / `--no-private` (the latter on update only). */
  private?: boolean;
  percent?: boolean;
  multiple?: boolean;
  clearOnDup?: boolean;
  viewMember?: string[];
  viewMembersAdminsOnly?: boolean;
  viewMembersAnyone?: boolean;
  editMember?: string[];
  editMembersAdminsOnly?: boolean;
  editMembersAnyone?: boolean;
  /** `--locked` / `--no-locked` (the latter on update only). */
  locked?: boolean;
  /** `--extra key=value`, repeatable. Value is JSON-parsed when possible. */
  extra?: string[];
}

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

const PRIVATE_HELP = "Hide the values from guests and from visitors of a public project or share link";

/**
 * The boolean flags and the Oct 15 2026 access flags shared by `project field`
 * and `insight field`. `update` adds the ways back: `--no-private`,
 * `--no-locked`, and `--{view,edit}-members-anyone` to lift a restriction.
 */
export function addFieldFlagOptions(cmd: Command, mode: "add" | "update"): Command {
  cmd
    .option("--hidden", "Hide the field by default")
    .option("--private", PRIVATE_HELP);
  if (mode === "update") cmd.option("--no-private", "Show the values to guests and visitors again (rejected while view members are set)");
  cmd
    .option("--percent", "Format numeric values as percentage")
    .option("--multiple", "Allow multiple values")
    .option("--clear-on-dup", "Clear value when a task is duplicated")
    .option(
      "--view-member <user>",
      "Only these users can view the values (OID, ID, email, or 'me'); repeat for multiple. An admin not named sees the field but not its values. Makes the field private.",
      append,
      [] as string[],
    )
    .option("--view-members-admins-only", "Only the admins can view the values");
  if (mode === "update") cmd.option("--view-members-anyone", "Lift the view restriction (the field stays private)");
  cmd
    .option(
      "--edit-member <user>",
      "Only these users can edit the values, in Quire and through the API (OID, ID, email, or 'me'); repeat for multiple",
      append,
      [] as string[],
    )
    .option("--edit-members-admins-only", "Only the admins can edit the values");
  if (mode === "update") cmd.option("--edit-members-anyone", "Lift the edit restriction");
  cmd.option("--locked", "Stop everyone, admins included, editing the values in Quire (API writes still go through)");
  if (mode === "update") cmd.option("--no-locked", "Allow editing the values in Quire again");
  return cmd;
}

/**
 * Tri-state like a record's `--member`: a list for just those users, `[]` for
 * the admins only, `null` to lift the restriction, `undefined` to leave it
 * off the request. The flags are rejected together rather than one winning.
 */
function resolveAccessList(
  list: string[] | undefined,
  adminsOnly: boolean | undefined,
  anyone: boolean | undefined,
  flag: "view" | "edit",
): string[] | null | undefined {
  const hasList = (list?.length ?? 0) > 0;
  const given = [hasList, adminsOnly === true, anyone === true].filter(Boolean).length;
  if (given > 1) {
    throw new ValidationError(
      `Use only one of --${flag}-member / --${flag}-members-admins-only / --${flag}-members-anyone.`,
    );
  }
  if (anyone === true) return null;
  if (adminsOnly === true) return [];
  return hasList ? list : undefined;
}

/**
 * Build a Quire field-definition body from CLI flags. The api-client's body
 * type for `addProjectField` / `addInsightField` etc. is `{ name, type,
 * [key: string]: unknown }`, so we let the user pass arbitrary type-specific
 * config via `--extra key=value` (JSON-parsed when possible — so
 * `--extra options='[{"label":"red"}]'` works for select-type fields).
 */
export function buildFieldBody(flags: FieldFlags): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (flags.name !== undefined) body.name = flags.name;
  if (flags.type !== undefined) body.type = flags.type;
  if (flags.hidden === true) body.hidden = true;
  if (flags.private !== undefined) body.private = flags.private;
  if (flags.percent === true) body.percent = true;
  if (flags.multiple === true) body.multiple = true;
  if (flags.clearOnDup === true) body.clearOnDup = true;
  const viewMembers = resolveAccessList(flags.viewMember, flags.viewMembersAdminsOnly, flags.viewMembersAnyone, "view");
  const editMembers = resolveAccessList(flags.editMember, flags.editMembersAdminsOnly, flags.editMembersAnyone, "edit");
  // Quire 400s on `private: false` for a field with view members.
  if (flags.private === false && Array.isArray(viewMembers)) {
    throw new ValidationError("Cannot combine --no-private with --view-member / --view-members-admins-only — a field with view members is always private.");
  }
  if (viewMembers !== undefined) body.viewMembers = viewMembers;
  if (editMembers !== undefined) body.editMembers = editMembers;
  if (flags.locked !== undefined) body.locked = flags.locked;
  if (flags.extra) {
    for (const pair of flags.extra) {
      const eq = pair.indexOf("=");
      if (eq <= 0) {
        throw new ValidationError(`Invalid --extra "${pair}". Expected key=value.`);
      }
      const key = pair.slice(0, eq);
      const raw = pair.slice(eq + 1);
      try {
        body[key] = JSON.parse(raw);
      } catch {
        body[key] = raw;
      }
    }
  }
  return body;
}

// Absent in a response means no restriction; `[]` means the admins only.
function formatAccessList(users: { name: string }[] | undefined): string | undefined {
  if (users === undefined) return undefined;
  if (users.length === 0) return "(admins only)";
  return users.map((u) => u.name).join(", ");
}

export const FIELD_FIELDS = [
  { label: "Name", get: (f: { name: string }) => f.name },
  { label: "Type", get: (f: { type: string }) => f.type },
  { label: "Hidden", get: (f: { hidden?: boolean }) => (f.hidden === true ? "yes" : undefined) },
  { label: "Private", get: (f: { private?: boolean }) => (f.private === true ? "yes" : undefined) },
  { label: "Percent", get: (f: { percent?: boolean }) => (f.percent === true ? "yes" : undefined) },
  { label: "Multiple", get: (f: { multiple?: boolean }) => (f.multiple === true ? "yes" : undefined) },
  { label: "Clear on dup", get: (f: { clearOnDup?: boolean }) => (f.clearOnDup === true ? "yes" : undefined) },
  { label: "View members", get: (f: { viewMembers?: { name: string }[] }) => formatAccessList(f.viewMembers) },
  { label: "Edit members", get: (f: { editMembers?: { name: string }[] }) => formatAccessList(f.editMembers) },
  { label: "Locked", get: (f: { locked?: boolean }) => (f.locked === true ? "yes" : undefined) },
];

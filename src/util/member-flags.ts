/**
 * Shared `--member` / `--members-admins-only` handling for the five records
 * that accept a visibility list at creation time: sublist, doc, chat, insight
 * and dashboard (api-client 1.0.0).
 *
 * The field is tri-state and **create-only** — Quire has no endpoint to change
 * it afterwards, so a mistake here can only be fixed by deleting and recreating
 * the record:
 *
 *   omitted  -> visible to every member of the owner (the default)
 *   []       -> visible to the owner's admins only  (`--members-admins-only`)
 *   [a, b]   -> visible to just those users         (`--member`, repeatable)
 *
 * Quire rejects a listed non-member with 400 rather than silently dropping it
 * (unlike a task's `assignees`), and a non-empty list must include the caller.
 */
import { Command } from "commander";

import { ValidationError } from "../errors.js";

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

export interface MemberFlags {
  member?: string[];
  membersAdminsOnly?: boolean;
}

/** Adds the two shared member options to a `create` command. */
export function addMemberOptions(cmd: Command): Command {
  return cmd
    .option(
      "--member <user>",
      "Restrict visibility to this user (OID, ID, email, or 'me'); repeat for multiple. Omit for every member of the owner. Cannot be changed after creation.",
      append,
      [] as string[],
    )
    .option("--members-admins-only", "Restrict visibility to the owner's admins (empty member list). Cannot be changed after creation.");
}

/**
 * Resolve the flags to the wire value, or `undefined` when the field should be
 * left off the request entirely. Unlike `project approval-category add` — where
 * `--claimers-admins-only` silently overrides `--claimer` — combining the two
 * is an error here, because the result is immutable once created.
 */
export function resolveMembers(flags: MemberFlags): string[] | undefined {
  const hasList = (flags.member?.length ?? 0) > 0;
  if (flags.membersAdminsOnly === true) {
    if (hasList) {
      throw new ValidationError("Cannot combine --member with --members-admins-only.");
    }
    return [];
  }
  return hasList ? flags.member : undefined;
}

/**
 * Render a record's `members` for `… get` output. The server returns all three
 * states explicitly, so `null` (everyone) and `[]` (admins only) are told
 * apart the same way `project approval-category` renders claimers / approvers.
 *
 * As of the Sep 21 2026 server release these are user objects; older servers
 * sent bare OID strings, so both shapes are accepted.
 */
export function formatMembers(members: ({ name?: string; oid: string } | string)[] | null | undefined): string {
  if (members === null || members === undefined) return "(everyone)";
  if (members.length === 0) return "(admins only)";
  return members.map((m) => (typeof m === "string" ? m : (m.name ?? m.oid))).join(", ");
}

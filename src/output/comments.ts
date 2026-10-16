/**
 * Shared rendering for task and chat comments: `comment list` / `get` /
 * `add` / `update`, `task comments`, `chat comments` and `chat comment add`.
 *
 * A comment's `createdBy` is the author's user OID, not the `{oid, id, name}`
 * object other records carry — the server keeps the string for compatibility
 * (api-client 1.2.0). So the WHO column looks each distinct author up once,
 * and falls back to the OID when that fails. A comment posted as the app
 * carries the app's agent OID (`ap|…`), which is no user and is shown as
 * `(app)`.
 */
import type { QuireClient, QuireComment, QuireCommentEmoji } from "@quire-io/api-client";

import type { GlobalOpts } from "../options.js";
import type { KeyValueField } from "./keyvalue.js";
import type { TableColumn } from "./table.js";

export type AuthorNames = ReadonlyMap<string, string>;

const APP_AGENT_PREFIX = "ap|";

/**
 * Look up the names of the comments' authors. Skipped under `--json` /
 * `--quiet`, which never print them.
 */
export async function lookupAuthors(
  client: QuireClient,
  comments: readonly QuireComment[],
  root: GlobalOpts,
): Promise<AuthorNames> {
  const names = new Map<string, string>();
  if (root.json === true || root.quiet === true) return names;
  const oids = new Set<string>();
  for (const c of comments) {
    if (c.createdBy !== undefined && !c.createdBy.startsWith(APP_AGENT_PREFIX)) oids.add(c.createdBy);
  }
  await Promise.all(
    [...oids].map(async (oid) => {
      try {
        const user = await client.getUser(oid);
        names.set(oid, user.nameText ?? user.name);
      } catch {
        // Not visible to the caller (e.g. left the organization): show the OID.
      }
    }),
  );
  return names;
}

function authorOf(c: QuireComment, names: AuthorNames): string | undefined {
  if (c.createdBy === undefined) return undefined;
  if (c.createdBy.startsWith(APP_AGENT_PREFIX)) return "(app)";
  return names.get(c.createdBy) ?? c.createdBy;
}

/** `👍 Alice, Bob · 🎉 Carol` — who reacted with what, for `get`. */
export function formatReactions(emojis: readonly QuireCommentEmoji[] | undefined): string | undefined {
  if (emojis === undefined || emojis.length === 0) return undefined;
  return emojis.map((e) => `${e.emoji} ${e.users.map((u) => u.name).join(", ")}`).join(" · ");
}

/** `👍2 🎉1` — reaction counts, for a list's REACTIONS column. */
export function formatReactionCounts(emojis: readonly QuireCommentEmoji[] | undefined): string {
  return (emojis ?? []).map((e) => `${e.emoji}${String(e.users.length)}`).join(" ");
}

export function commentFields(names: AuthorNames): KeyValueField<QuireComment>[] {
  return [
    { label: "OID", get: (c) => c.oid },
    { label: "When", get: (c) => c.createdAt },
    { label: "Who", get: (c) => authorOf(c, names) },
    { label: "Pinned at", get: (c) => c.pinAt },
    { label: "Text", get: (c) => c.descriptionText },
    { label: "Reactions", get: (c) => formatReactions(c.emojis) },
    { label: "URL", get: (c) => c.url },
  ];
}

export function commentColumns(names: AuthorNames): TableColumn<QuireComment>[] {
  return [
    { header: "WHEN", get: (c) => c.createdAt ?? "" },
    { header: "WHO", get: (c) => authorOf(c, names) ?? "" },
    { header: "TEXT", get: (c) => (c.descriptionText ?? "").replace(/\s+/g, " ").trim() },
    { header: "REACTIONS", get: (c) => formatReactionCounts(c.emojis) },
    { header: "OID", get: (c) => c.oid },
  ];
}

/**
 * Shared rendering for task and chat comments: `comment list` / `get` /
 * `add` / `update`, `task comments`, `chat comments` and `chat comment add`.
 *
 * A comment's `createdBy` is the author's `{oid, id, name}` user object, as
 * on other records (api-client 1.2.2). A comment posted as the app carries
 * the app, with the app's name.
 */
import type { QuireComment, QuireCommentEmoji } from "@quire-io/api-client";

import type { KeyValueField } from "./keyvalue.js";
import type { TableColumn } from "./table.js";

/** `👍 Alice, Bob · 🎉 Carol` — who reacted with what, for `get`. */
export function formatReactions(emojis: readonly QuireCommentEmoji[] | undefined): string | undefined {
  if (emojis === undefined || emojis.length === 0) return undefined;
  return emojis.map((e) => `${e.emoji} ${e.users.map((u) => u.name).join(", ")}`).join(" · ");
}

/** `👍2 🎉1` — reaction counts, for a list's REACTIONS column. */
export function formatReactionCounts(emojis: readonly QuireCommentEmoji[] | undefined): string {
  return (emojis ?? []).map((e) => `${e.emoji}${String(e.users.length)}`).join(" ");
}

export const COMMENT_FIELDS: KeyValueField<QuireComment>[] = [
  { label: "OID", get: (c) => c.oid },
  { label: "When", get: (c) => c.createdAt },
  { label: "Who", get: (c) => c.createdBy?.name },
  { label: "Pinned at", get: (c) => c.pinAt },
  { label: "Text", get: (c) => c.descriptionText },
  { label: "Reactions", get: (c) => formatReactions(c.emojis) },
  { label: "URL", get: (c) => c.url },
];

export const COMMENT_COLUMNS: TableColumn<QuireComment>[] = [
  { header: "WHEN", get: (c) => c.createdAt ?? "" },
  { header: "WHO", get: (c) => c.createdBy?.name ?? "" },
  { header: "TEXT", get: (c) => (c.descriptionText ?? "").replace(/\s+/g, " ").trim() },
  { header: "REACTIONS", get: (c) => formatReactionCounts(c.emojis) },
  { header: "OID", get: (c) => c.oid },
];

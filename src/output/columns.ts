/**
 * Shared `TableColumn` and `KeyValueField` definitions used by multiple
 * commands. Keeping them in one place means `task list`, `task search`,
 * `task subtasks`, `quire mine`, and every task-write command (`create` /
 * `update` / `complete` / …) render the same columns / fields.
 */
import type { QuireTask } from "@quire-io/api-client";

import type { KeyValueField } from "./keyvalue.js";
import type { TableColumn } from "./table.js";

export const TASK_LIST_COLUMNS: TableColumn<QuireTask>[] = [
  { header: "ID", get: (t) => `#${t.id}` },
  { header: "NAME", get: (t) => t.nameText ?? t.name },
  { header: "STATUS", get: (t) => t.status?.name ?? "" },
  { header: "DUE", get: (t) => t.due ?? "" },
  { header: "OID", get: (t) => t.oid },
];

// The `{oid, id}` companions of `predecessors` / `successors` (api-client 1.2.0).
function formatTaskRefs(refs: { id: number }[] | undefined): string | undefined {
  if (refs === undefined || refs.length === 0) return undefined;
  return refs.map((r) => `#${String(r.id)}`).join(", ");
}

export const TASK_GET_FIELDS: KeyValueField<QuireTask>[] = [
  { label: "Name", get: (t) => t.nameText ?? t.name },
  { label: "ID", get: (t) => `#${t.id}` },
  { label: "OID", get: (t) => t.oid },
  { label: "Status", get: (t) => t.status?.name },
  { label: "Priority", get: (t) => t.priority?.name },
  { label: "Start", get: (t) => t.start },
  { label: "Due", get: (t) => t.due },
  { label: "Predecessors", get: (t) => formatTaskRefs(t.predecessorRefs) },
  { label: "Successors", get: (t) => formatTaskRefs(t.successorRefs) },
  { label: "Followers", get: (t) => t.followers?.map((f) => f.name).join(", ") },
  { label: "Partner", get: (t) => t.partner?.name },
  // A JSON object (api-client 1.2.6), shown as stored.
  { label: "Source ref", get: (t) => (t.sourceRef !== undefined ? JSON.stringify(t.sourceRef) : undefined) },
  { label: "Description", get: (t) => t.descriptionText },
  { label: "URL", get: (t) => t.url },
  { label: "Created at", get: (t) => t.createdAt },
  { label: "Edited at", get: (t) => t.editedAt },
  { label: "Archived at", get: (t) => t.archivedAt },
];

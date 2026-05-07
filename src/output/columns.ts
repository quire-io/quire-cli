/**
 * Shared `TableColumn` definitions used by multiple commands. Keeping them
 * in one place means `task list`, `task search`, `task subtasks`, and
 * `quire mine` all render the same columns in the same order.
 */
import type { QuireTask } from "@quire-io/api-client";

import type { TableColumn } from "./table.js";

export const TASK_LIST_COLUMNS: TableColumn<QuireTask>[] = [
  { header: "ID", get: (t) => `#${t.id}` },
  { header: "NAME", get: (t) => t.nameText ?? t.name },
  { header: "STATUS", get: (t) => t.status?.name ?? "" },
  { header: "DUE", get: (t) => t.due ?? "" },
  { header: "OID", get: (t) => t.oid },
];
